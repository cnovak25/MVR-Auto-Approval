import React, { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import Tesseract from "tesseract.js";

// Configure PDF.js worker
// Use local worker file to avoid CORS issues
pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

export default function MVRApprovalForm() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [driverType, setDriverType] = useState("essential");
  const [driverName, setDriverName] = useState("");
  const [mvrFile, setMvrFile] = useState(null);
  const [insuranceFile, setInsuranceFile] = useState(null);
  const [dob, setDob] = useState("");
  const [result, setResult] = useState(null);

  const login = () => {
    if (passwordInput === "letmein") {
      setIsAuthenticated(true);
    } else {
      alert("Incorrect password");
    }
  };

  const readTextFromPDF = async (file) => {
    try {
      const reader = new FileReader();
      return new Promise((resolve, reject) => {
        reader.onload = async () => {
          try {
            const typedarray = new Uint8Array(reader.result);
            const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
            let text = "";
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const content = await page.getTextContent();
              text += content.items.map((s) => s.str).join(" ") + "\n";
            }
            const nameMatch = text.match(/Name\s*[:\-]?\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/i);
            if (nameMatch && nameMatch[1]) {
              setDriverName(nameMatch[1]);
            }
            resolve(text);
          } catch (pdfError) {
            reject(pdfError);
          }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
    } catch (err) {
      console.error("PDF parsing failed, attempting OCR", err);
      return await runOCR(file);
    }
  };

  const runOCR = async (file) => {
    const image = URL.createObjectURL(file);
    const result = await Tesseract.recognize(image, "eng");
    return result.data.text;
  };

  const classifyDriver = (violations, accidents) => {
    const total = violations + accidents;
    if (violations >= 4 || accidents >= 4 || total >= 4) return "Unacceptable";
    const matrix = {
      "0": ["Clear", "Acceptable", "Probationary", "Unacceptable"],
      "1": ["Acceptable", "Acceptable", "Probationary", "Unacceptable"],
      "2": ["Acceptable", "Probationary", "Unacceptable", "Unacceptable"],
      "3": ["Probationary", "Unacceptable", "Unacceptable", "Unacceptable"]
    };
    return matrix[violations]?.[accidents] || "Unacceptable";
  };

  const countActualViolationsAndAccidents = (text) => {
    // Improved parsing logic to avoid false positives from column headers
    const lines = text.toLowerCase().split('\n');
    let violations = 0;
    let accidents = 0;
    
    // Look for actual violation/accident entries, not just headers
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip obvious header lines
      if (line === 'violations' || line === 'accidents' || 
          line === 'violation' || line === 'accident' ||
          line.includes('violation type') || line.includes('accident type') ||
          line.includes('violation date') || line.includes('accident date')) {
        continue;
      }
      
      // Look for "None To Report" patterns
      if (line.includes('none to report') || line.includes('no violations') || 
          line.includes('no accidents') || line.includes('clean record')) {
        continue;
      }
      
      // Look for actual violation/accident entries with dates, locations, or specific details
      if (line.includes('violation') && 
          (line.match(/\d{2}\/\d{2}\/\d{4}/) || line.match(/\d{4}-\d{2}-\d{2}/) || 
           line.includes('speeding') || line.includes('parking') || 
           line.includes('moving') || line.includes('equipment'))) {
        violations++;
      }
      
      if (line.includes('accident') && 
          (line.match(/\d{2}\/\d{2}\/\d{4}/) || line.match(/\d{4}-\d{2}-\d{2}/) || 
           line.includes('collision') || line.includes('property damage') || 
           line.includes('injury') || line.includes('at fault'))) {
        accidents++;
      }
    }
    
    return { violations, accidents };
  };

  const evaluateMVR = (text) => {
    const dobMatch = dob.match(/(\d{4})-(\d{2})-(\d{2})/);
    const birthYear = dobMatch ? parseInt(dobMatch[1], 10) : null;
    const age = birthYear ? new Date().getFullYear() - birthYear : null;

    const majorConvictions = [
      "DUI", "DWI", "reckless driving", "vehicular assault", "homicide",
      "hit and run", "leaving the scene", "driving while suspended", "open container"
    ];
    const foundConvictions = majorConvictions.filter(term => text.toLowerCase().includes(term.toLowerCase()));

    // Use improved parsing logic to avoid false positives
    const { violations, accidents } = countActualViolationsAndAccidents(text);

    const classification = classifyDriver(violations, accidents);

    let disqualified = false;
    if (driverType === "essential") {
      disqualified =
        age < 21 ||
        foundConvictions.length > 0 ||
        classification === "Probationary" ||
        classification === "Unacceptable";
    } else {
      disqualified =
        age < 21 ||
        (foundConvictions.length > 0 && text.includes("2023"));
    }

    const evaluation = {
      timestamp: new Date().toISOString(),
      driverName,
      age,
      classification,
      violations,
      accidents,
      majorConvictions: foundConvictions,
      finalVerdict: disqualified ? "Disqualified" : classification
    };

    const logs = JSON.parse(localStorage.getItem("mvr_evaluation_logs") || "[]");
    logs.push(evaluation);
    localStorage.setItem("mvr_evaluation_logs", JSON.stringify(logs));

    return evaluation;
  };

  const exportCSV = () => {
    const logs = JSON.parse(localStorage.getItem("mvr_evaluation_logs") || "[]");
    const headers = [
      "timestamp",
      "driverName",
      "age",
      "classification",
      "violations",
      "accidents",
      "majorConvictions",
      "finalVerdict"
    ];
    const rows = logs.map(log => headers.map(key => {
      const val = log[key];
      if (Array.isArray(val)) return `"${val.join("; ")}"`;
      return val;
    }).join(","));
    const blob = new Blob([
      `${headers.join(",")}\n${rows.join("\n")}`
    ], { type: 'text/csv' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `mvr_evaluation_logs_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!mvrFile) {
      alert("Please select an MVR file");
      return;
    }
    
    try {
      const text = await readTextFromPDF(mvrFile);
      const evaluation = evaluateMVR(text);
      setResult(evaluation);
    } catch (error) {
      console.error("Error processing PDF:", error);
      alert("Error processing PDF. Please ensure you've uploaded a valid PDF file.");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto mt-20 p-6 border rounded shadow">
        <h2 className="text-xl font-bold mb-4">Restricted Access</h2>
        <input
          type="password"
          placeholder="Enter password"
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          className="w-full px-3 py-2 border rounded mb-4"
        />
        <button
          onClick={login}
          className="bg-blue-600 text-white px-4 py-2 rounded w-full"
        >
          Login
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">MVR Auto-Approval System</h1>
        <button
          onClick={exportCSV}
          className="bg-green-600 text-white px-4 py-2 rounded mb-4"
        >
          Export Evaluation Logs (CSV)
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Driver Type</label>
          <select
            value={driverType}
            onChange={(e) => setDriverType(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="essential">Essential Driver</option>
            <option value="non-essential">Non-Essential Driver</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Date of Birth</label>
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">MVR Document (PDF)</label>
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setMvrFile(e.target.files[0])}
            className="w-full px-3 py-2 border rounded"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Insurance Document (PDF) - Optional</label>
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setInsuranceFile(e.target.files[0])}
            className="w-full px-3 py-2 border rounded"
          />
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white px-6 py-3 rounded font-medium"
        >
          Evaluate Driver
        </button>
      </form>

      {result && (
        <div className="mt-8 p-6 border rounded bg-gray-50">
          <h2 className="text-2xl font-bold mb-4">Evaluation Result</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <strong>Driver Name:</strong> {result.driverName || "Not detected"}
            </div>
            <div>
              <strong>Age:</strong> {result.age || "Unknown"}
            </div>
            <div>
              <strong>Classification:</strong> {result.classification}
            </div>
            <div>
              <strong>Violations:</strong> {result.violations}
            </div>
            <div>
              <strong>Accidents:</strong> {result.accidents}
            </div>
            <div>
              <strong>Major Convictions:</strong> {result.majorConvictions.length > 0 ? result.majorConvictions.join(", ") : "None"}
            </div>
            <div className="md:col-span-2">
              <strong>Final Verdict:</strong> 
              <span className={`ml-2 px-3 py-1 rounded font-medium ${
                result.finalVerdict === "Disqualified" 
                  ? "bg-red-100 text-red-800" 
                  : result.finalVerdict === "Clear"
                  ? "bg-green-100 text-green-800"
                  : result.finalVerdict === "Acceptable"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}>
                {result.finalVerdict}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
