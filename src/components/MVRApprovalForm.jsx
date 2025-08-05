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
      
      // Check for "NONE TO REPORT" patterns - this indicates clean record
      if (lowerLine.includes('*** none to report ***') || 
          lowerLine.includes('none to report') || 
          lowerLine.includes('no violations') || 
          lowerLine.includes('no accidents') ||
          lowerLine.includes('clean record')) {
        // This section has no violations/accidents
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
        // Multi-state format support
        // California: ABS	08/21/2023	09/20/2023	B50	DC06	4000A1	UNREGISTERED VEHICLE...
        // Texas: Similar tabular format
        // Arizona: ARS codes
        // Check for date patterns and violation codes
        const datePattern = /\d{2}\/\d{2}\/\d{4}/;
        const hasDate = datePattern.test(line);
        
        // Skip lines that are clearly not violation entries
        if (lowerLine.includes('description') || lowerLine.includes('location') || 
            lowerLine.includes('ticket') || lowerLine.includes('plate') ||
            lowerLine.includes('at fault') || lowerLine.includes('*** none') ||
            line.startsWith('-') || line.length < 10) {
          continue;
        }
        
        // State-specific violation code patterns
        const stateViolationPatterns = [
          // California codes
          /^(ABS|CONV|FTA|SUSP)/i,
          // Arizona codes
          /^(ARS)/i,
          // Texas codes  
          /^(TRC|TC)/i,
          // General patterns
          /^[A-Z]{2,4}\s/,  // 2-4 letter codes followed by space
          /^\d{4,6}[A-Z]/   // Numeric codes with letters
        ];
        
        // Check if line has violation indicators
        const hasViolationCode = stateViolationPatterns.some(pattern => pattern.test(line));
        
        // Look for violation entries - they typically have dates and specific patterns
        if (hasDate && (
          hasViolationCode ||
          lowerLine.includes('driving') || lowerLine.includes('vehicle') ||
          lowerLine.includes('speed') || lowerLine.includes('dui') ||
          lowerLine.includes('license') || lowerLine.includes('registration') ||
          lowerLine.includes('insurance') || lowerLine.includes('equipment') ||
          lowerLine.includes('traffic') || lowerLine.includes('violation') ||
          lowerLine.includes('moving') || lowerLine.includes('parking') ||
          lowerLine.includes('reckless') || lowerLine.includes('careless')
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

    // Moon Valley Nursery Policy - Major Convictions
    const majorConvictions = [
      // Generic terms
      "DUI", "DWI", "reckless driving", "vehicular assault", "homicide",
      "hit and run", "leaving the scene", "driving while suspended", "open container",
      "BAC", "blood alcohol", "driving with bac", "driving under influence",
      
      // California codes
      "23152A", "23152B", "23103", "23140",
      
      // Arizona codes (ARS)
      "ARS 28-1381", "ARS 28-1382", "ARS 28-1383", "28-1381", "28-1382", "28-1383",
      
      // Texas codes
      "TRC 49.04", "49.04", "TRC 49.045", "49.045", "TPC 49.04",
      
      // Florida codes
      "316.193", "322.2615",
      
      // Common patterns
      "excessive blood", "refuse breath", "refuse chemical", "implied consent"
    ];
    const foundConvictions = majorConvictions.filter(term => 
      text.toLowerCase().includes(term.toLowerCase())
    );

    // Use improved parsing logic to avoid false positives
    const { violations, accidents } = countActualViolationsAndAccidents(text);

    const classification = classifyDriver(violations, accidents);

    // Moon Valley Nursery Policy Implementation
    let disqualified = false;
    let disqualificationReasons = [];

    if (driverType === "essential") {
      // Essential Driver Requirements (MVN Policy Section 4 & 6)
      
      // Age requirement: 25 years, or 21 years with ≥3 years experience and no violations
      // Note: We can't verify driving experience from MVR, so enforcing 25 minimum for simplicity
      if (age < 25) {
        disqualificationReasons.push("Under 25 years old (Essential Driver requirement)");
      }
      
      // Major conviction in past 5 years disqualifies Essential drivers
      if (foundConvictions.length > 0) {
        disqualificationReasons.push(`Major conviction found: ${foundConvictions.join(", ")} (5-year lookback for Essential)`);
      }
      
      // Essential drivers must be Clear or Acceptable (not Probationary or Unacceptable)
      if (classification === "Probationary" || classification === "Unacceptable") {
        disqualificationReasons.push(`Classification: ${classification} (Essential drivers require Clear/Acceptable)`);
      }
      
      // ≥3 accidents or violations in past 3 years disqualifies
      if (violations + accidents >= 3) {
        disqualificationReasons.push(`${violations + accidents} violations/accidents in past 3 years (Essential limit: 2)`);
      }
      
    } else {
      // Non-Essential Driver Requirements (MVN Policy Section 4 & 6)
      
      // Age requirement: 21 years minimum
      if (age < 21) {
        disqualificationReasons.push("Under 21 years old (Non-Essential Driver requirement)");
      }
      
      // Major conviction in past 3 years disqualifies Non-Essential drivers
      // Note: We're checking if violations contain recent dates, but this is approximate
      if (foundConvictions.length > 0) {
        // For simplicity, we'll disqualify if any major conviction is found
        // In a real implementation, you'd need to parse conviction dates
        disqualificationReasons.push(`Major conviction found: ${foundConvictions.join(", ")} (3-year lookback for Non-Essential)`);
      }
      
      // Non-Essential drivers may be Clear, Acceptable, or Probationary (not Unacceptable)
      if (classification === "Unacceptable") {
        disqualificationReasons.push(`Classification: ${classification} (Non-Essential allows up to Probationary)`);
      }
    }

    disqualified = disqualificationReasons.length > 0;

    const evaluation = {
      timestamp: new Date().toISOString(),
      driverName,
      age,
      driverType,
      classification,
      violations,
      accidents,
      majorConvictions: foundConvictions,
      finalVerdict: disqualified ? "Disqualified" : classification,
      disqualificationReasons: disqualificationReasons,
      disqualificationReason: disqualificationReasons.join("; "), // For backward compatibility
      policy: "Moon Valley Nursery Driver Standards (June 2025)"
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
      "driverType",
      "age",
      "classification",
      "violations",
      "accidents",
      "majorConvictions",
      "finalVerdict",
      "disqualificationReasons",
      "disqualificationReason",
      "policy"
    ];
    const rows = logs.map(log => headers.map(key => {
      const val = log[key];
      if (Array.isArray(val)) return `"${val.join("; ")}"`;
      return val || "";
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
              
              console.log("Testing Edgar's MVR (2 violations, DUI) - MVN Policy");
              setDob("1996-10-18"); // Edgar is 28 years old (meets Essential age requirement)
              const evaluation = evaluateMVR(sampleMVR);
              setResult(evaluation);
              setDriverName("Edgar Navarro");
            }}
            className="bg-purple-600 text-white px-4 py-2 rounded mb-4"
          >
            Test Edgar (2 Violations + DUI)
          </button>
          
          <button
            type="button"
            onClick={() => {
              const cleanMVR = `Name:  	William Allen Hibbens
DOB:  	08/25/****
 	 	 	 
 
The following are included in this report:
Search Type   	Detail   	Status   
Motor Vehicle Records Search   	Texas (license 52270616)    	Complete
 
Motor Vehicle Records Search
State	 	Texas
License	 	52270616
Name Searched	 	William Allen Hibbens
DOB Searched	 	08/25/****
Search ID	 	2369990
Date Ordered	 	07/28/2025
Date Completed	 	07/28/2025
Results
TEXASDriver Record - D2523	Order Date: 07/28/2025	Seq #: 0
Host Used:	Online	Bill Code:	
Rec Type:	STANDARD	Reference:	
License:	52270616
Name:	HIBBENS, WILLIAM ALLEN
Address:	10034 COMANCHE LN
City, St:	HOUSTON, TX 77041
Sex:		Weight:		DOB:	08/25/****		
Eyes:		Height:		Iss Date:			
Hair:				Exp Date:	08/25/2033		
Year License First Issued: 06/05/2025	STATUS:VALID
MVR Score: 1 STANDARD
Violations/ConvictionsFailures To Appear Accidents
*** NONE TO REPORT ***
Suspensions/Revocations
*** NO ACTIVITY ***
License and Permit Information
License: PERSONAL	Issue:	Expire: 08/25/2033	Status: VALID		
Class: C	SINGLE VEH < 26K`;
              
              console.log("Testing William's clean MVR (0 violations) - MVN Policy");
              setDob("1985-08-25"); // William is 40 years old (meets all requirements)
              const evaluation = evaluateMVR(cleanMVR);
              setResult(evaluation);
              setDriverName("William Allen Hibbens");
            }}
            className="bg-green-600 text-white px-4 py-2 rounded mb-4 ml-2"
          >
            Test William (TX Clean)
          </button>
          
          <button
            type="button"
            onClick={() => {
              const youngDriverMVR = `Name: Sarah Young Driver
State: California
License: D987654321
DOB: 03/15/2004
Violations/ConvictionsFailures To Appear Accidents
*** NONE TO REPORT ***
License and Permit Information
License: PERSONAL	Issue: 03/15/2022	Expire: 03/15/2030	Status: VALID		
Class: C	SINGLE VEH < 26K`;
              
              console.log("Testing Young Driver (21 years old) - MVN Policy Age Test");
              setDob("2004-03-15"); // Sarah is 21 years old
              const evaluation = evaluateMVR(youngDriverMVR);
              setResult(evaluation);
              setDriverName("Sarah Young Driver");
            }}
            className="bg-orange-600 text-white px-4 py-2 rounded mb-4 ml-2"
          >
            Test Young Driver (Age 21)
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
              <strong>Driver Type:</strong> {result.driverType === "essential" ? "Essential Driver" : "Non-Essential Driver"}
            </div>
            <div>
              <strong>Age:</strong> {result.age || "Unknown"}
            </div>
            <div>
              <strong>Classification:</strong> {result.classification}
              <div className="text-sm text-gray-600">(Based on violation/accident matrix only)</div>
            </div>
            <div>
              <strong>Violations:</strong> {result.violations}
            </div>
            <div>
              <strong>Accidents:</strong> {result.accidents}
            </div>
            <div className="md:col-span-2">
              <strong>Major Convictions:</strong> {result.majorConvictions.length > 0 ? result.majorConvictions.join(", ") : "None"}
            </div>
            {result.disqualificationReasons && result.disqualificationReasons.length > 0 && (
              <div className="md:col-span-2">
                <strong>Disqualification Reasons:</strong> 
                <div className="ml-2 text-red-600">
                  {result.disqualificationReasons.map((reason, index) => (
                    <div key={index} className="mb-1">• {reason}</div>
                  ))}
                </div>
              </div>
            )}
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
              <div className="text-sm text-gray-600 mt-1">(Considering all MVN policy requirements)</div>
            </div>
            <div className="md:col-span-2 text-sm text-gray-600 mt-2">
              <strong>Policy:</strong> {result.policy || "Moon Valley Nursery Driver Standards (June 2025)"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
