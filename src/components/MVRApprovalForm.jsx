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
    // Enhanced parsing logic for California DMV format
    const lines = text.split('\n');
    let violations = 0;
    let accidents = 0;
    let inViolationsSection = false;
    let inAccidentsSection = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lowerLine = line.toLowerCase();
      
      // Detect section headers
      if (lowerLine.includes('violations/convictions') || lowerLine.includes('violations') && lowerLine.includes('accidents')) {
        inViolationsSection = true;
        inAccidentsSection = false;
        continue;
      }
      
      if (lowerLine.includes('suspensions/revocations') || lowerLine.includes('license and permit')) {
        inViolationsSection = false;
        inAccidentsSection = false;
        continue;
      }
      
      // Skip table headers
      if (lowerLine.includes('type') && lowerLine.includes('viol') && lowerLine.includes('conv')) {
        continue;
      }
      
      // Look for actual violation entries in the violations section
      if (inViolationsSection && line.length > 0) {
        // California DMV format: ABS	08/21/2023	09/20/2023	B50	DC06	4000A1	UNREGISTERED VEHICLE...
        // Check for date patterns and violation codes
        const datePattern = /\d{2}\/\d{2}\/\d{4}/;
        const hasDate = datePattern.test(line);
        
        // Skip lines that are clearly not violation entries
        if (lowerLine.includes('description') || lowerLine.includes('location') || 
            lowerLine.includes('ticket') || lowerLine.includes('plate') ||
            line.startsWith('-') || line.length < 10) {
          continue;
        }
        
        // Look for violation entries - they typically start with a code and have dates
        if (hasDate && (
          line.includes('ABS') || line.includes('CONV') || 
          lowerLine.includes('driving') || lowerLine.includes('vehicle') ||
          lowerLine.includes('speed') || lowerLine.includes('dui') ||
          lowerLine.includes('license') || lowerLine.includes('registration') ||
          lowerLine.includes('insurance') || lowerLine.includes('equipment')
        )) {
          violations++;
        }
      }
      
      // Look for accident entries
      if (lowerLine.includes('accident') && 
          (lowerLine.includes('at fault') || lowerLine.includes('collision') ||
           lowerLine.includes('property damage') || lowerLine.includes('injury'))) {
        accidents++;
      }
      
      // Alternative accident detection - look for accident-specific codes or descriptions
      if (inViolationsSection && line.length > 0) {
        if (lowerLine.includes('accident') || lowerLine.includes('collision') ||
            lowerLine.includes('crash') || (lowerLine.includes('at fault') && lowerLine.includes('yes'))) {
          accidents++;
        }
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
      "hit and run", "leaving the scene", "driving while suspended", "open container",
      "23152B", "23152A", "BAC", "blood alcohol", "driving with bac"
    ];
    const foundConvictions = majorConvictions.filter(term => 
      text.toLowerCase().includes(term.toLowerCase())
    );

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
          <button
            type="button"
            onClick={() => {
              const sampleMVR = `Profile Information
Name:  	Edgar Navarro
Reference:	 N. Hollywood
* Document(s) Attached
 	 	 	 
 
The following are included in this report:
Search Type   	Detail   	Status   
Motor Vehicle Records Search   	California (license F7895107)    	Complete
 
Motor Vehicle Records Search
State	 	California
License	 	F7895107
Name Searched	 	Edgar Navarro
Search ID	 	2371838
Reference	 	N. Hollywood
Date Ordered	 	07/31/2025
Date Completed	 	07/31/2025
Results
CALIFORNIADriver Record - D2523	Order Date: 07/31/2025	Seq #: 0
Host Used:	Online	Bill Code:	
Rec Type:	STANDARD	Reference:	
License:	F7895107
Name:	NAVARROCARBAJAL, EDGAR ULISES
Address:	
City, St:	
Sex:	MALE	Weight:	150lbs.	DOB:	10/18/1996		
Eyes:	BROWN	Height:	5'08"	Iss Date:	10/20/2023		
Hair:	BROWN			Exp Date:	10/18/2028		
Approx. Year Lic. First Issued: 2013	STATUS:SEE BELOW
MVR Score: 1 STANDARD
Violations/ConvictionsFailures To Appear Accidents
TYPE	VIOL	CONV	ACD	AVD	V/C	DESCRIPTION	C	LOCATION	TICKET	PLATE	AT FAULT	PT
ABS	08/21/2023	09/20/2023	B50	DC06	4000A1	UNREGISTERED VEHICLE-ON/OFF HWY	N	SAN BENITO	2303291	8TRL681		0	
ABS	07/07/2024	10/16/2024	A08	CB03	23152B	DRIVING WITH BAC OF .08 OR MORE	N	SALINAS	R005603	8PNK628		2	
-	UE08	23593A	ADDITIONAL COURT-IMPOSED ORDERS	N						
Suspensions/Revocations
ACTIONS	ORD/DATE	EFF/DATE	CLEAR/DATE	END/DATE	CODE	AVD	DESCRIPTION	NEW SUSP
SUSPENSION	12/24/2024	01/02/2025		02/19/2025	96A	CA02	IMMEDIATE SUSP-EXCESSIVE BLOOD ALCH`;
              
              console.log("Testing with sample MVR data");
              const evaluation = evaluateMVR(sampleMVR);
              setResult(evaluation);
              setDriverName("Edgar Navarro");
            }}
            className="bg-purple-600 text-white px-4 py-2 rounded mb-4"
          >
            Test with Sample MVR
          </button>
        </div>
        
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
