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
            
            // Enhanced name detection for various MVR formats
            const lines = text.split('\n');
            let detectedName = null;
            let licenseStatus = null;
            let licenseStatusExplanation = null;
            
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              const lowerLine = line.toLowerCase();
              
              // Format 1: "Name Searched" on one line, name on next line
              if (lowerLine === 'name searched' && i + 1 < lines.length) {
                const nextLine = lines[i + 1].trim();
                if (nextLine && nextLine.length > 2) {
                  detectedName = nextLine;
                }
              }
              
              // Format 2: "Name:" followed by name on same or next line
              if (lowerLine.includes('name:') || lowerLine.includes('name ')) {
                // Try to extract from same line first
                const nameMatch = line.match(/name\s*[:\-]?\s*([A-Z][a-z]+\s+[A-Z][a-z]+.*)/i);
                if (nameMatch && nameMatch[1]) {
                  detectedName = nameMatch[1].trim();
                }
                // If not found on same line, try next line
                else if (i + 1 < lines.length) {
                  const nextLine = lines[i + 1].trim();
                  if (nextLine && nextLine.length > 2 && /^[A-Z][a-z]+\s+[A-Z]/.test(nextLine)) {
                    detectedName = nextLine;
                  }
                }
              }
              
              // License Status Detection - handle various formats
              if (lowerLine.includes('status:') || lowerLine.startsWith('status:')) {
                // First try to get status from same line
                const statusMatch = line.match(/status:\s*([A-Z]+)/i);
                if (statusMatch && statusMatch[1]) {
                  licenseStatus = statusMatch[1].toUpperCase();
                }
                // If status is on next line (like "Status: SUSPENDED")
                else if (i + 1 < lines.length) {
                  const nextLine = lines[i + 1].trim();
                  if (nextLine && /^[A-Z]+$/.test(nextLine)) {
                    licenseStatus = nextLine.toUpperCase();
                  }
                }
              }
              
              // Also check for standalone status lines after "Status:" appears
              if (licenseStatus === null && /^(VALID|ACTIVE|SUSPENDED|REVOKED|CANCELLED|EXPIRED)$/i.test(line)) {
                // Look back a few lines to see if this follows a "Status:" line
                for (let j = Math.max(0, i - 3); j < i; j++) {
                  if (lines[j].toLowerCase().includes('status:')) {
                    licenseStatus = line.toUpperCase();
                    break;
                  }
                }
              }
              
              // License Status Explanation Detection - handle various formats
              if (lowerLine.includes('license status explanation:') || lowerLine.includes('status explanation:')) {
                const explanationMatch = line.match(/(?:license\s+)?status\s+explanation:\s*(.+)/i);
                if (explanationMatch && explanationMatch[1]) {
                  licenseStatusExplanation = explanationMatch[1].trim();
                }
                // If explanation is on next line
                else if (i + 1 < lines.length) {
                  const nextLine = lines[i + 1].trim();
                  if (nextLine && nextLine.length > 2) {
                    licenseStatusExplanation = nextLine;
                  }
                }
              }
              
              // Format 3: Direct name pattern detection (fallback)
              if (!detectedName) {
                const directNameMatch = line.match(/^([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)$/);
                if (directNameMatch && directNameMatch[1] && 
                    !lowerLine.includes('california') && 
                    !lowerLine.includes('texas') && 
                    !lowerLine.includes('arizona') &&
                    !lowerLine.includes('license') &&
                    !lowerLine.includes('date') &&
                    !lowerLine.includes('address')) {
                  detectedName = directNameMatch[1].trim();
                }
              }
            }
            
            if (detectedName) {
              setDriverName(detectedName);
            }
            
            // Store license status in the text for later evaluation
            if (licenseStatus || licenseStatusExplanation) {
              text += `\n__LICENSE_STATUS__: ${licenseStatus || 'UNKNOWN'}`;
              if (licenseStatusExplanation) {
                text += `\n__LICENSE_STATUS_EXPLANATION__: ${licenseStatusExplanation}`;
              }
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

    // Extract license status information
    const licenseStatusMatch = text.match(/__LICENSE_STATUS__:\s*([A-Z]+)/);
    const licenseStatus = licenseStatusMatch ? licenseStatusMatch[1] : null;
    
    const licenseStatusExplanationMatch = text.match(/__LICENSE_STATUS_EXPLANATION__:\s*(.+)/);
    const licenseStatusExplanation = licenseStatusExplanationMatch ? licenseStatusExplanationMatch[1] : null;

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

    // Check license status - suspended/revoked license is automatic disqualification
    if (licenseStatus && (licenseStatus === 'SUSPENDED' || licenseStatus === 'REVOKED' || licenseStatus === 'CANCELLED')) {
      disqualificationReasons.push(`License Status: ${licenseStatus}${licenseStatusExplanation ? ` (${licenseStatusExplanation})` : ''}`);
    }

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
      licenseStatus: licenseStatus || "Not specified",
      licenseStatusExplanation: licenseStatusExplanation || "",
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
      "licenseStatus",
      "licenseStatusExplanation",
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
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="max-w-md w-full mx-auto p-8 bg-white border-2 border-red-900 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-6 text-red-900 text-center">Restricted Access</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 text-gray-700">Password</label>
            <input
              type="password"
              placeholder="Enter password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-900 focus:outline-none transition-colors"
            />
          </div>
          <button
            onClick={login}
            className="bg-red-900 hover:bg-red-800 text-white px-6 py-3 rounded-lg w-full font-medium transition-colors"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white border-2 border-red-900 rounded-lg shadow-lg p-8 mb-6">
          <h1 className="text-4xl font-bold mb-2 text-red-900 text-center">MVR Auto-Approval System</h1>
          <p className="text-gray-600 text-center mb-6">Moon Valley Nursery Driver Standards Evaluation</p>
          <div className="flex justify-center">
            <button
              onClick={exportCSV}
              className="bg-red-900 hover:bg-red-800 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Export Evaluation Logs (CSV)
            </button>
          </div>
        </div>

        <div className="bg-white border-2 border-red-900 rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-semibold mb-6 text-red-900">Driver Evaluation Form</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">Driver Type</label>
          <select
            value={driverType}
            onChange={(e) => setDriverType(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-900 focus:outline-none transition-colors"
          >
            <option value="essential">Essential Driver</option>
            <option value="non-essential">Non-Essential Driver</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">Date of Birth</label>
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-900 focus:outline-none transition-colors"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">MVR Document (PDF)</label>
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setMvrFile(e.target.files[0])}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-900 focus:outline-none transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-red-900 file:text-white file:cursor-pointer"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">Insurance Document (PDF) - Optional</label>
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setInsuranceFile(e.target.files[0])}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-900 focus:outline-none transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-red-900 file:text-white file:cursor-pointer"
          />
        </div>

        <button
          type="submit"
          className="bg-red-900 hover:bg-red-800 text-white px-8 py-4 rounded-lg font-medium w-full transition-colors"
        >
          Evaluate Driver
        </button>
      </form>

      {result && (
        <div className="mt-8 p-8 bg-white border-2 border-red-900 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-6 text-red-900">Evaluation Result</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <strong className="text-gray-700">Driver Name:</strong> 
              <div className="text-gray-900 font-medium">{result.driverName || "Not detected"}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <strong className="text-gray-700">Driver Type:</strong> 
              <div className="text-gray-900 font-medium">{result.driverType === "essential" ? "Essential Driver" : "Non-Essential Driver"}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <strong className="text-gray-700">Age:</strong> 
              <div className="text-gray-900 font-medium">{result.age || "Unknown"}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <strong className="text-gray-700">Violations:</strong> 
              <div className="text-gray-900 font-medium">{result.violations}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <strong className="text-gray-700">Accidents:</strong> 
              <div className="text-gray-900 font-medium">{result.accidents}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <strong className="text-gray-700">License Status:</strong> 
              <div className={`font-medium ${
                result.licenseStatus === 'SUSPENDED' || result.licenseStatus === 'REVOKED' || result.licenseStatus === 'CANCELLED'
                  ? 'text-red-600' 
                  : result.licenseStatus === 'VALID' || result.licenseStatus === 'ACTIVE'
                  ? 'text-green-600'
                  : 'text-gray-900'
              }`}>
                {result.licenseStatus}
              </div>
            </div>
            {result.licenseStatusExplanation && (
              <div className="bg-gray-50 p-4 rounded-lg md:col-span-2">
                <strong className="text-gray-700">License Status Details:</strong> 
                <div className="text-gray-900 font-medium">{result.licenseStatusExplanation}</div>
              </div>
            )}
            <div className="bg-gray-50 p-4 rounded-lg md:col-span-2">
              <strong className="text-gray-700">Major Convictions:</strong> 
              <div className="text-gray-900 font-medium">{result.majorConvictions.length > 0 ? result.majorConvictions.join(", ") : "None"}</div>
            </div>
            {result.disqualificationReasons && result.disqualificationReasons.length > 0 && (
              <div className="md:col-span-2 bg-red-50 border border-red-200 p-4 rounded-lg">
                <strong className="text-red-800">Disqualification Reasons:</strong> 
                <div className="ml-2 text-red-700">
                  {result.disqualificationReasons.map((reason, index) => (
                    <div key={index} className="mb-1">• {reason}</div>
                  ))}
                </div>
              </div>
            )}
            <div className="md:col-span-2 text-center">
              <strong className="text-gray-700 text-lg">Final Verdict:</strong> 
              <div className={`mt-2 inline-block px-6 py-3 rounded-lg font-bold text-lg ${
                result.finalVerdict === "Disqualified" 
                  ? "bg-red-100 text-red-800 border-2 border-red-300" 
                  : result.finalVerdict === "Clear"
                  ? "bg-green-100 text-green-800 border-2 border-green-300"
                  : result.finalVerdict === "Acceptable"
                  ? "bg-blue-100 text-blue-800 border-2 border-blue-300"
                  : "bg-yellow-100 text-yellow-800 border-2 border-yellow-300"
              }`}>
                {result.finalVerdict}
              </div>
            </div>
            <div className="md:col-span-2 text-center text-sm text-gray-600 mt-4 pt-4 border-t border-gray-300">
              <strong>Policy:</strong> {result.policy || "Moon Valley Nursery Driver Standards (June 2025)"}
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
