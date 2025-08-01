import React, { useState } from "react";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import Tesseract from "tesseract.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@2.16.105/legacy/build/pdf.worker.min.js`;

export default function MVRApprovalForm() {
  const [driverType, setDriverType] = useState("essential");
  const [driverName, setDriverName] = useState("");
  const [mvrFile, setMvrFile] = useState(null);
  const [insuranceFile, setInsuranceFile] = useState(null);
  const [dob, setDob] = useState("");
  const [result, setResult] = useState(null);

  const readTextFromPDF = async (file) => {
    try {
      const reader = new FileReader();
      return new Promise((resolve, reject) => {
        reader.onload = async () => {
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

  const evaluateMVR = (text) => {
    const dobMatch = dob.match(/(\d{4})-(\d{2})-(\d{2})/);
    const birthYear = dobMatch ? parseInt(dobMatch[1], 10) : null;
    const age = birthYear ? new Date().getFullYear() - birthYear : null;

    const majorConvictions = [
      "DUI", "DWI", "reckless driving", "vehicular assault", "homicide",
      "hit and run", "leaving the scene", "driving while suspended", "open container"
    ];
    const foundConvictions = majorConvictions.filter(term => text.toLowerCase().includes(term.toLowerCase()));

    const violations = (text.match(/violation/gi) || []).length;
    const accidents = (text.match(/accident/gi) || []).length;

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
    if (!mvrFile) return;
    const text = await readTextFromPDF(mvrFile);
    const evaluation = evaluateMVR(text);
    setResult(evaluation);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded shadow-md">
      <h2 className="text-2xl font-bold mb-6">MVR Evaluation Form</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-semibold mb-1">Driver Name:</label>
          <input
            type="text"
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="Enter driver's full name"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1">Driver Type:</label>
          <label className="mr-4">
            <input type="radio" value="essential" checked={driverType === "essential"} onChange={() => setDriverType("essential")} className="mr-1" /> Essential
          </label>
          <label>
            <input type="radio" value="non-essential" checked={driverType === "non-essential"} onChange={() => setDriverType("non-essential")} className="mr-1" /> Non-Essential
          </label>
        </div>

        <div>
          <label htmlFor="dob" className="block font-semibold mb-1">Date of Birth:</label>
          <input type="date" id="dob" value={dob} onChange={(e) => setDob(e.target.value)} required className="w-full border border-gray-300 rounded px-3 py-2" />
        </div>

        <div>
          <label htmlFor="mvr" className="block font-semibold mb-1">Upload MVR:</label>
          <input type="file" id="mvr" accept="application/pdf,image/*" onChange={(e) => setMvrFile(e.target.files[0])} className="w-full" />
        </div>

        {driverType === "non-essential" && (
          <div>
            <label htmlFor="insurance" className="block font-semibold mb-1">Upload Proof of Insurance:</label>
            <input type="file" id="insurance" accept="application/pdf,image/*" onChange={(e) => setInsuranceFile(e.target.files[0])} className="w-full" />
          </div>
        )}

        <div className="flex space-x-4">
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Submit for Evaluation</button>
          <button type="button" onClick={exportCSV} className="bg-gray-300 px-4 py-2 rounded">Export Logs as CSV</button>
        </div>
      </form>

      {result && (
        <div className="mt-6 p-4 border border-gray-300 rounded bg-gray-50">
          <h3 className="text-lg font-semibold mb-4">Evaluation Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="font-semibold">Driver Name:</span> {result.driverName}</div>
            <div><span className="font-semibold">DOB:</span> {dob}</div>
            <div><span className="font-semibold">Age:</span> {result.age}</div>
            <div><span className="font-semibold">Driver Type:</span> {driverType}</div>
            <div><span className="font-semibold">Violations:</span> {result.violations}</div>
            <div><span className="font-semibold">Accidents:</span> {result.accidents}</div>
            <div><span className="font-semibold">Major Convictions:</span> {result.majorConvictions.join(", ") || "None"}</div>
            <div><span className="font-semibold">Classification:</span> {result.classification}</div>
            <div className="col-span-2 text-lg font-bold mt-2">
              Final Verdict: <span className={result.finalVerdict === "Disqualified" ? "text-red-600" : "text-green-600"}>{result.finalVerdict}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}