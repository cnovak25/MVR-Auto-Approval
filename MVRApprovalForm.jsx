import React, { useState, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import Tesseract from "tesseract.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@2.16.105/legacy/build/pdf.worker.min.js`;

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
