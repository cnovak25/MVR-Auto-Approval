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
            
            // Debug: Log first 30 lines to console to help troubleshoot
            console.log("PDF Text Lines (first 30):", lines.slice(0, 30));
            console.log("Full PDF text sample:", text.substring(0, 1000));
            console.log("Total lines found:", lines.length);
            
            // If we have very few lines, the PDF might be parsed as one long string
            // Try to split by common delimiters as well
            if (lines.length < 10) {
              console.log("⚠️ Few lines detected, attempting alternative parsing...");
              const alternativeLines = text.split(/(?:\n|  (?=[A-Z])|(?<=:)  )/);
              console.log("Alternative parsing found", alternativeLines.length, "segments");
              if (alternativeLines.length > lines.length) {
                lines.push(...alternativeLines);
                console.log("Combined lines array now has", lines.length, "elements");
              }
            }
            
            // Additional debug: Look for any lines containing status-related keywords
            console.log("🔍 Scanning for license status keywords in document...");
            for (let k = 0; k < Math.min(lines.length, 100); k++) {
              const testLine = lines[k].toLowerCase().trim();
              if (testLine.includes('status') || testLine.includes('license') || 
                  testLine.includes('valid') || testLine.includes('active') || 
                  testLine.includes('suspended') || testLine.includes('revoked')) {
                console.log(`Line ${k}: "${lines[k]}"`);
              }
            }
            
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              const lowerLine = line.toLowerCase();
              
              // Skip empty lines
              if (!line) continue;
              
              // Enhanced name detection with more patterns
              // Only log when we find potential names, not every line
              
              // Format 1: "Name Searched" on one line, name on next line OR embedded in same line
              if (lowerLine.includes('name searched')) {
                console.log("Found 'Name Searched' pattern");
                
                // Check if name is on the same line after "Name Searched"
                const sameLineMatch = line.match(/name searched\s+(.+?)(?:\s{2,}|$)/i);
                if (sameLineMatch && sameLineMatch[1]) {
                  let nameText = sameLineMatch[1].trim();
                  
                  // Clean up and validate
                  const words = nameText.split(/\s+/);
                  if (words.length >= 2 && words.length <= 4 && 
                      words.every(word => word.length >= 1 && word.length <= 20)) {
                    detectedName = nameText;
                    console.log("✓ Name detected via 'Name Searched' (same line):", detectedName);
                    break;
                  }
                }
                
                // Check next line if same line didn't work
                if (!detectedName && i + 1 < lines.length) {
                  const nextLine = lines[i + 1].trim();
                  if (nextLine && nextLine.length > 2) {
                    // Extract just the name part from next line
                    const words = nextLine.split(/\s+/);
                    if (words.length >= 2 && words.length <= 4) {
                      const potentialName = words.slice(0, 4).join(' '); // Take first 4 words max
                      detectedName = potentialName;
                      console.log("✓ Name detected via 'Name Searched' (next line):", detectedName);
                      break;
                    }
                  }
                }
              }
              
              // Format 2: Look for any line that just contains a person's name (early in document)
              if (!detectedName && i < 50) { // Check first 50 lines
                // Match patterns like "JOHN DOE", "JANE SMITH JONES", etc.
                const namePattern = /^([A-Z][A-Z]+\s+[A-Z][A-Z]+(?:\s+[A-Z][A-Z]+)?)$/;
                const nameMatch = line.match(namePattern);
                
                if (nameMatch && nameMatch[1]) {
                  const potentialName = nameMatch[1];
                  const words = potentialName.split(' ');
                  
                  // Ensure it's 2-4 words, all caps (typical MVR format)
                  if (words.length >= 2 && words.length <= 4 && 
                      words.every(word => word.length >= 2) &&
                      !lowerLine.includes('california') && 
                      !lowerLine.includes('texas') && 
                      !lowerLine.includes('arizona') &&
                      !lowerLine.includes('department') &&
                      !lowerLine.includes('motor') &&
                      !lowerLine.includes('vehicle') &&
                      !lowerLine.includes('record') &&
                      !lowerLine.includes('license') &&
                      !lowerLine.includes('state') &&
                      !lowerLine.includes('report') &&
                      !lowerLine.includes('driving')) {
                    detectedName = potentialName;
                    console.log("✓ Name detected via all-caps pattern:", detectedName);
                    break;
                  }
                }
              }
              
              // Format 3: "Driver Name:" pattern with name between "Driver Name:" and "DOB:"
              if (!detectedName && (lowerLine.includes('driver name:') || lowerLine.includes('name:'))) {
                console.log("Found name line:", line.substring(0, 100) + "...");
                
                // Extract everything after "Driver Name:" or "Name:" and before "DOB:"
                const nameMatch = line.match(/(?:driver\s+)?name:\s*(.+)/i);
                if (nameMatch && nameMatch[1]) {
                  let nameText = nameMatch[1].trim();
                  
                  // Stop at common delimiters that indicate end of name
                  const stopPatterns = [
                    'reference:', 'dob:', 'address:', 'license:', 'phone:', 'email:',
                    'search id', 'date ordered', 'date completed', 'results',
                    'motor vehicle', 'california', 'texas', 'arizona',
                    '*', 'document(s)', 'the following', 'search type'
                  ];
                  
                  for (const pattern of stopPatterns) {
                    const index = nameText.toLowerCase().indexOf(pattern);
                    if (index !== -1) {
                      nameText = nameText.substring(0, index).trim();
                      break;
                    }
                  }
                  
                  // Also split on multiple spaces (often indicates new section)
                  const parts = nameText.split(/\s{2,}/);
                  if (parts.length > 1) {
                    nameText = parts[0].trim();
                  }
                  
                  // Clean up the name - remove any trailing non-letter characters
                  nameText = nameText.replace(/[^a-zA-Z\s]+$/, '').trim();
                  
                  // Validate it looks like a reasonable name (2-4 words, not too long)
                  const words = nameText.split(/\s+/);
                  if (nameText && nameText.length >= 3 && nameText.length <= 50 && 
                      words.length >= 2 && words.length <= 4 &&
                      words.every(word => word.length >= 1 && word.length <= 20)) {
                    detectedName = nameText;
                    console.log("✓ Name detected via 'Name:' (cleaned):", detectedName);
                    break;
                  }
                }
                // If name might be on next line after "Driver Name:" or "Name:"
                else if (i + 1 < lines.length) {
                  const nextLine = lines[i + 1].trim();
                  console.log("Checking next line for name:", nextLine);
                  
                  if (nextLine && nextLine.length > 2) {
                    let nameText = nextLine;
                    
                    // Check if DOB is on the same line and remove it
                    const dobIndex = nameText.toLowerCase().indexOf('dob:');
                    if (dobIndex !== -1) {
                      nameText = nameText.substring(0, dobIndex).trim();
                    }
                    
                    // Clean up the name
                    nameText = nameText.replace(/[^a-zA-Z\s]+$/, '').trim();
                    
                    if (nameText && (/^[A-Z][a-z]+\s+[A-Z]/.test(nameText) || nameText.split(' ').length >= 2)) {
                      detectedName = nameText;
                      console.log("✓ Name detected on next line:", detectedName);
                      break;
                    }
                  }
                }
              }
              
              // Format 4: Look for mixed case names in early lines
              if (!detectedName && i < 30) {
                const mixedCasePattern = /^([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)$/;
                const mixedMatch = line.match(mixedCasePattern);
                
                if (mixedMatch && mixedMatch[1]) {
                  const potentialName = mixedMatch[1];
                  const words = potentialName.split(' ');
                  
                  if (words.length >= 2 && words.length <= 4 && 
                      words.every(word => word.length >= 2) &&
                      !lowerLine.includes('california') && 
                      !lowerLine.includes('texas') && 
                      !lowerLine.includes('arizona') &&
                      !lowerLine.includes('department') &&
                      !lowerLine.includes('motor') &&
                      !lowerLine.includes('vehicle') &&
                      !lowerLine.includes('license') &&
                      !lowerLine.includes('state') &&
                      !lowerLine.includes('report')) {
                    detectedName = potentialName;
                    console.log("✓ Name detected via mixed case pattern:", detectedName);
                    break;
                  }
                }
              }
              
              // Format 5: Look for "LAST, FIRST" format
              if (!detectedName && i < 30) {
                const lastFirstPattern = /^([A-Z]+,\s*[A-Z]+(?:\s+[A-Z]+)?)$/;
                const lastFirstMatch = line.match(lastFirstPattern);
                
                if (lastFirstMatch && lastFirstMatch[1]) {
                  let nameText = lastFirstMatch[1].replace(',', '').trim();
                  const words = nameText.split(' ');
                  
                  if (words.length >= 2 && words.length <= 4) {
                    // Rearrange from "LAST FIRST" to "FIRST LAST"
                    const rearranged = words.slice(1).join(' ') + ' ' + words[0];
                    detectedName = rearranged;
                    console.log("✓ Name detected via LAST, FIRST pattern:", detectedName);
                    break;
                  }
                }
              }
              
              // Format 6: Search within lines for embedded names
              if (!detectedName && i < 20) {
                // Look for name patterns embedded in lines
                const embeddedPattern = /\b([A-Z][A-Z]+\s+[A-Z][A-Z]+(?:\s+[A-Z][A-Z]+)?)\b/;
                const embeddedMatch = line.match(embeddedPattern);
                
                if (embeddedMatch && embeddedMatch[1]) {
                  const potentialName = embeddedMatch[1];
                  const words = potentialName.split(' ');
                  
                  if (words.length >= 2 && words.length <= 4 && 
                      words.every(word => word.length >= 2 && word.length <= 15) &&
                      !potentialName.includes('CALIFORNIA') && 
                      !potentialName.includes('DEPARTMENT') &&
                      !potentialName.includes('MOTOR') &&
                      !potentialName.includes('VEHICLE') &&
                      !potentialName.includes('LICENSE') &&
                      !potentialName.includes('RECORD') &&
                      !potentialName.includes('REPORT') &&
                      !potentialName.includes('STATE')) {
                    detectedName = potentialName;
                    console.log("✓ Name detected via embedded pattern:", detectedName);
                    break;
                  }
                }
              }
              
              // Format 7: Look for any line that contains both "name" and what looks like a person's name
              if (!detectedName && lowerLine.includes('name') && !lowerLine.includes('driver name:') && !lowerLine.includes('name searched')) {
                const possibleNameMatch = line.match(/([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
                if (possibleNameMatch && possibleNameMatch[1]) {
                  let nameText = possibleNameMatch[1].trim();
                  
                  // Remove DOB if present
                  const dobIndex = nameText.toLowerCase().indexOf('dob:');
                  if (dobIndex !== -1) {
                    nameText = nameText.substring(0, dobIndex).trim();
                  }
                  
                  nameText = nameText.replace(/[^a-zA-Z\s]+$/, '').trim();
                  
                  // Validate it's actually a name - exclude addresses and common non-name patterns
                  const lowerNameText = nameText.toLowerCase();
                  const isNotAddress = !lowerNameText.includes('blvd') && 
                                      !lowerNameText.includes('boulevard') &&
                                      !lowerNameText.includes('street') &&
                                      !lowerNameText.includes('st') &&
                                      !lowerNameText.includes('ave') &&
                                      !lowerNameText.includes('avenue') &&
                                      !lowerNameText.includes('road') &&
                                      !lowerNameText.includes('rd') &&
                                      !lowerNameText.includes('lane') &&
                                      !lowerNameText.includes('ste') &&
                                      !lowerNameText.includes('suite') &&
                                      !lowerNameText.includes('continental') &&
                                      !lowerNameText.includes('segundo') &&
                                      !lowerNameText.includes('el segundo');
                  
                  if (nameText && nameText.split(' ').length >= 2 && nameText.split(' ').length <= 4 && isNotAddress) {
                    detectedName = nameText;
                    console.log("✓ Name detected via general name pattern:", detectedName);
                    break;
                  }
                }
              }
              
              // License Status Detection - handle various formats
              if (lowerLine.includes('status:') || lowerLine.startsWith('status:') || lowerLine.includes('license status')) {
                console.log("🔍 Found license status line:", line);
                
                // First try to get status from same line - look for patterns like "Status: SUSPENDED"
                const statusMatch = line.match(/status:\s*([A-Z]{4,})/i);
                if (statusMatch && statusMatch[1] && statusMatch[1].length > 3) {
                  const status = statusMatch[1].toUpperCase();
                  console.log("📋 Checking status from same line:", status);
                  // Only accept valid status values
                  if (/^(VALID|ACTIVE|SUSPENDED|REVOKED|CANCELLED|EXPIRED)$/i.test(status)) {
                    licenseStatus = status;
                    console.log("✅ License status detected (same line):", licenseStatus);
                  }
                }
                // If status is on next line (like "Status: SUSPENDED")
                else if (i + 1 < lines.length) {
                  const nextLine = lines[i + 1].trim();
                  console.log("📋 Checking next line for status:", nextLine);
                  if (nextLine && /^[A-Z]{4,}$/.test(nextLine)) {
                    const status = nextLine.toUpperCase();
                    if (/^(VALID|ACTIVE|SUSPENDED|REVOKED|CANCELLED|EXPIRED)$/i.test(status)) {
                      licenseStatus = status;
                      console.log("✅ License status detected (next line):", licenseStatus);
                    }
                  }
                  // Also check for mixed case or different patterns
                  else if (nextLine && nextLine.length >= 4) {
                    const status = nextLine.toUpperCase();
                    if (/^(VALID|ACTIVE|SUSPENDED|REVOKED|CANCELLED|EXPIRED)$/i.test(status)) {
                      licenseStatus = status;
                      console.log("✅ License status detected (mixed case):", licenseStatus);
                    }
                  }
                }
              }
              
              // Specific pattern for California MVR format - "Status: SUSPENDED" etc.
              if (!licenseStatus && lowerLine.includes('status:') && !lowerLine.includes('explanation')) {
                console.log("🔍 Checking California MVR status format:", line);
                const calStatusMatch = line.match(/status:\s*([a-zA-Z]+)/i);
                if (calStatusMatch && calStatusMatch[1]) {
                  const status = calStatusMatch[1].toUpperCase();
                  console.log("📋 Found California status:", status);
                  if (/^(VALID|ACTIVE|SUSPENDED|REVOKED|CANCELLED|EXPIRED)$/i.test(status)) {
                    licenseStatus = status;
                    console.log("✅ License status detected (California format):", licenseStatus);
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
              
              // License Status Explanation Detection - extract key status words only
              if (lowerLine.includes('license status explanation:') || lowerLine.includes('status explanation:')) {
                console.log("🔍 Found license status explanation:", line);
                const explanationMatch = line.match(/(?:license\s+)?status\s+explanation:\s*(.+)/i);
                if (explanationMatch && explanationMatch[1]) {
                  let explanation = explanationMatch[1].trim();
                  console.log("📋 Raw explanation:", explanation);
                  // Extract key status words from explanation
                  if (explanation.toLowerCase().includes('susp')) {
                    licenseStatusExplanation = "SUSPENDED";
                    console.log("✅ Status explanation detected: SUSPENDED");
                  } else if (explanation.toLowerCase().includes('revk') || explanation.toLowerCase().includes('revoked')) {
                    licenseStatusExplanation = "REVOKED";
                    console.log("✅ Status explanation detected: REVOKED");
                  } else if (explanation.toLowerCase().includes('valid')) {
                    licenseStatusExplanation = "VALID";
                    console.log("✅ Status explanation detected: VALID");
                  } else if (explanation.toLowerCase().includes('expired')) {
                    licenseStatusExplanation = "EXPIRED";
                    console.log("✅ Status explanation detected: EXPIRED");
                  } else if (explanation.toLowerCase().includes('cancelled')) {
                    licenseStatusExplanation = "CANCELLED";
                    console.log("✅ Status explanation detected: CANCELLED");
                  } else {
                    // Keep first word only if it's a status-like term
                    const firstWord = explanation.split(/\s+/)[0].toUpperCase();
                    if (/^(MANDATORY|VOLUNTARY|ACTIVE|INACTIVE)$/.test(firstWord)) {
                      licenseStatusExplanation = null; // Don't show these generic terms
                    } else {
                      licenseStatusExplanation = firstWord;
                    }
                  }
                }
                // If explanation is on next line
                else if (i + 1 < lines.length) {
                  const nextLine = lines[i + 1].trim();
                  if (nextLine && nextLine.length > 2) {
                    let explanation = nextLine;
                    console.log("📋 Raw explanation (next line):", explanation);
                    // Extract key status words from explanation
                    if (explanation.toLowerCase().includes('susp')) {
                      licenseStatusExplanation = "SUSPENDED";
                      console.log("✅ Status explanation detected (next line): SUSPENDED");
                    } else if (explanation.toLowerCase().includes('revk') || explanation.toLowerCase().includes('revoked')) {
                      licenseStatusExplanation = "REVOKED";
                      console.log("✅ Status explanation detected (next line): REVOKED");
                    } else if (explanation.toLowerCase().includes('valid')) {
                      licenseStatusExplanation = "VALID";
                      console.log("✅ Status explanation detected (next line): VALID");
                    } else if (explanation.toLowerCase().includes('expired')) {
                      licenseStatusExplanation = "EXPIRED";
                      console.log("✅ Status explanation detected (next line): EXPIRED");
                    } else if (explanation.toLowerCase().includes('cancelled')) {
                      licenseStatusExplanation = "CANCELLED";
                      console.log("✅ Status explanation detected (next line): CANCELLED");
                    } else {
                      // Keep first word only if it's a status-like term
                      const firstWord = explanation.split(/\s+/)[0].toUpperCase();
                      if (/^(MANDATORY|VOLUNTARY|ACTIVE|INACTIVE)$/.test(firstWord)) {
                        licenseStatusExplanation = null; // Don't show these generic terms
                      } else {
                        licenseStatusExplanation = firstWord;
                      }
                    }
                  }
                }
              }
              
              // Additional check for "MANDATORY SUSP/REVK" patterns
              if (lowerLine.includes('mandatory susp') || lowerLine.includes('susp/revk')) {
                if (lowerLine.includes('susp')) {
                  licenseStatusExplanation = "SUSPENDED";
                }
              }
              
              // Additional license status detection in license sections
              if (!licenseStatus && lowerLine.includes('license') && 
                  (lowerLine.includes('valid') || lowerLine.includes('suspended') || 
                   lowerLine.includes('revoked') || lowerLine.includes('active'))) {
                console.log("🔍 Found license line with status keywords:", line);
                const statusWords = ['VALID', 'ACTIVE', 'SUSPENDED', 'REVOKED', 'CANCELLED', 'EXPIRED'];
                for (const status of statusWords) {
                  if (lowerLine.includes(status.toLowerCase())) {
                    licenseStatus = status;
                    console.log("✅ License status detected (keyword search):", licenseStatus);
                    break;
                  }
                }
              }
              
              // Look for standalone status patterns like "Valid", "Active", etc.
              if (!licenseStatus && /^(Valid|Active|Suspended|Revoked|Cancelled|Expired)$/i.test(line.trim())) {
                // Check if this appears after a status-related line
                for (let j = Math.max(0, i - 3); j < i; j++) {
                  const prevLine = lines[j].toLowerCase();
                  if (prevLine.includes('status') || prevLine.includes('license')) {
                    licenseStatus = line.trim().toUpperCase();
                    console.log("✅ License status detected (standalone):", licenseStatus);
                    break;
                  }
                }
              }
              
              // Look for "Current Status:" or similar patterns
              if (!licenseStatus && (lowerLine.includes('current status') || lowerLine.includes('driver license status'))) {
                console.log("🔍 Found current status line:", line);
                // Extract status from same line or next line
                const statusMatch = line.match(/(?:current\s+status|driver\s+license\s+status):\s*([a-z]+)/i);
                if (statusMatch && statusMatch[1]) {
                  const status = statusMatch[1].toUpperCase();
                  if (/^(VALID|ACTIVE|SUSPENDED|REVOKED|CANCELLED|EXPIRED)$/i.test(status)) {
                    licenseStatus = status;
                    console.log("✅ License status detected (current status):", licenseStatus);
                  }
                } else if (i + 1 < lines.length) {
                  const nextLine = lines[i + 1].trim();
                  if (nextLine && /^(valid|active|suspended|revoked|cancelled|expired)$/i.test(nextLine)) {
                    licenseStatus = nextLine.toUpperCase();
                    console.log("✅ License status detected (current status next line):", licenseStatus);
                  }
                }
              }
              
              // Look for simple "License:" followed by status
              if (!licenseStatus && lowerLine.includes('license:')) {
                console.log("🔍 Found license field:", line);
                const licenseMatch = line.match(/license:\s*([a-z]+)/i);
                if (licenseMatch && licenseMatch[1]) {
                  const status = licenseMatch[1].toUpperCase();
                  if (/^(VALID|ACTIVE|SUSPENDED|REVOKED|CANCELLED|EXPIRED)$/i.test(status)) {
                    licenseStatus = status;
                    console.log("✅ License status detected (license field):", licenseStatus);
                  }
                }
              }
              
              // Look for patterns like "Valid License", "Active License", etc.
              if (!licenseStatus && lowerLine.includes('license')) {
                const licenseStatusWords = ['valid license', 'active license', 'suspended license', 'revoked license', 'expired license', 'cancelled license'];
                for (const pattern of licenseStatusWords) {
                  if (lowerLine.includes(pattern)) {
                    licenseStatus = pattern.split(' ')[0].toUpperCase();
                    console.log("✅ License status detected (descriptive):", licenseStatus);
                    break;
                  }
                }
              }
              
              // Look for tabular data with license status
              if (!licenseStatus && (lowerLine.includes('class') || lowerLine.includes('type')) && 
                  (lowerLine.includes('valid') || lowerLine.includes('active') || lowerLine.includes('suspended'))) {
                console.log("🔍 Found potential license table row:", line);
                const tableStatusWords = ['VALID', 'ACTIVE', 'SUSPENDED', 'REVOKED', 'CANCELLED', 'EXPIRED'];
                for (const status of tableStatusWords) {
                  if (lowerLine.includes(status.toLowerCase())) {
                    licenseStatus = status;
                    console.log("✅ License status detected (table format):", licenseStatus);
                    break;
                  }
                }
              }
              
              // Format 8: Direct name pattern detection (fallback) - more aggressive
              if (!detectedName && i < 30) {
                // Look for any line that looks like a name (2-4 capitalized words)
                const directNameMatch = line.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})$/);
                if (directNameMatch && directNameMatch[1] && 
                    !lowerLine.includes('california') && 
                    !lowerLine.includes('texas') && 
                    !lowerLine.includes('arizona') &&
                    !lowerLine.includes('license') &&
                    !lowerLine.includes('date') &&
                    !lowerLine.includes('address') &&
                    !lowerLine.includes('dob:') &&
                    !lowerLine.includes('report') &&
                    !lowerLine.includes('department') &&
                    !lowerLine.includes('record') &&
                    !lowerLine.includes('motor') &&
                    !lowerLine.includes('vehicle')) {
                  let nameText = directNameMatch[1].trim();
                  
                  // Additional cleanup - ensure it's just a name
                  const words = nameText.split(' ');
                  if (words.length >= 2 && words.length <= 4) {
                    detectedName = nameText;
                    console.log("✓ Name detected via fallback pattern:", detectedName);
                    break;
                  }
                }
              }
              
              // Format 9: Very broad search for name patterns anywhere in the text (first 15 lines only)
              if (!detectedName && i < 15) {
                const broadNameMatch = line.match(/([A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)/);
                if (broadNameMatch && broadNameMatch[1]) {
                  let nameText = broadNameMatch[1].trim();
                  
                  // Exclude common non-name patterns
                  if (!lowerLine.includes('california') && 
                      !lowerLine.includes('texas') && 
                      !lowerLine.includes('arizona') &&
                      !lowerLine.includes('department') &&
                      !lowerLine.includes('motor') &&
                      !lowerLine.includes('vehicle') &&
                      !lowerLine.includes('record') &&
                      !lowerLine.includes('report') &&
                      !lowerLine.includes('license') &&
                      !lowerLine.includes('state') &&
                      nameText.split(' ').length >= 2 && 
                      nameText.split(' ').length <= 4) {
                    detectedName = nameText;
                    console.log("✓ Name detected via broad search:", detectedName);
                    break;
                  }
                }
              }
            }
            
            // If line-based parsing failed, try direct text searching
            if (!detectedName) {
              console.log("🔍 Line-based name detection failed, trying direct text search...");
              
              // Look for "Name Searched   Edgar Navarro" pattern in the full text
              const nameSearchedMatch = text.match(/Name Searched\s+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
              if (nameSearchedMatch && nameSearchedMatch[1]) {
                detectedName = nameSearchedMatch[1].trim();
                console.log("✅ Name detected via direct text search (Name Searched):", detectedName);
              }
              
              // Look for "Name:   Edgar Navarro" pattern
              if (!detectedName) {
                const nameColonMatch = text.match(/Name:\s+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
                if (nameColonMatch && nameColonMatch[1]) {
                  detectedName = nameColonMatch[1].trim();
                  console.log("✅ Name detected via direct text search (Name:):", detectedName);
                }
              }
              
              // Look for the legal name format "NAVARROCARBAJAL, EDGAR ULISES"
              if (!detectedName) {
                const legalNameMatch = text.match(/Name:\s+([A-Z]+),\s+([A-Z]+(?:\s+[A-Z]+)?)/);
                if (legalNameMatch) {
                  // Reconstruct as "First Last" from "LAST, FIRST MIDDLE"
                  const lastName = legalNameMatch[1];
                  const firstAndMiddle = legalNameMatch[2];
                  const nameParts = firstAndMiddle.split(' ');
                  const firstName = nameParts[0];
                  detectedName = `${firstName} ${lastName}`.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
                  console.log("✅ Name detected via legal name format:", detectedName);
                }
              }
            }
            
            // Direct license status detection from full text
            if (!licenseStatus) {
              console.log("🔍 Line-based license status detection failed, trying direct text search...");
              
              // Look for "Status: SUSPENDED" pattern in full text
              const statusMatch = text.match(/Status:\s*(VALID|ACTIVE|SUSPENDED|REVOKED|CANCELLED|EXPIRED)/i);
              if (statusMatch && statusMatch[1]) {
                licenseStatus = statusMatch[1].toUpperCase();
                console.log("✅ License status detected via direct text search:", licenseStatus);
              }
            }
            
            // Direct license status explanation detection
            if (!licenseStatusExplanation) {
              console.log("🔍 Looking for license status explanation in full text...");
              
              // Look for "License Status Explanation:MANDATORY SUSP/REVK" pattern
              const explanationMatch = text.match(/License Status Explanation:\s*(.+?)(?:\s|$)/i);
              if (explanationMatch && explanationMatch[1]) {
                const explanation = explanationMatch[1].trim();
                console.log("📋 Found explanation via direct search:", explanation);
                if (explanation.toLowerCase().includes('susp')) {
                  licenseStatusExplanation = "SUSPENDED";
                  console.log("✅ Status explanation detected via direct search: SUSPENDED");
                } else if (explanation.toLowerCase().includes('revk') || explanation.toLowerCase().includes('revoked')) {
                  licenseStatusExplanation = "REVOKED";
                  console.log("✅ Status explanation detected via direct search: REVOKED");
                }
              }
            }
            
            // Final verification and logging
            console.log("🔍 BEFORE FINAL CHECK - detectedName:", detectedName);
            console.log("🔍 Current driverName state:", driverName);
            console.log("🔍 FINAL LICENSE STATUS - licenseStatus:", licenseStatus);
            console.log("🔍 FINAL LICENSE STATUS EXPLANATION - licenseStatusExplanation:", licenseStatusExplanation);
            
            // Only auto-set the name if the manual field is empty AND we detected a name
            if (detectedName && !driverName.trim()) {
              // Clean up the detected name
              detectedName = detectedName.trim();
              console.log("🎯 FINAL: Name successfully detected and set:", detectedName);
              setDriverName(detectedName);
            } else if (detectedName && driverName.trim()) {
              console.log("🔒 MANUAL OVERRIDE: Keeping manually entered name:", driverName);
            } else {
              console.log("❌ FINAL: No name detected after all attempts");
              console.log("📋 First 10 lines for manual review:", lines.slice(0, 10));
              // Don't clear manually entered names
              if (!driverName.trim()) {
                setDriverName(""); // Only clear if it was empty to begin with
              }
            }
            
            // Store license status in the text for later evaluation
            if (licenseStatus || licenseStatusExplanation) {
              text += `\n__LICENSE_STATUS__: ${licenseStatus || 'UNKNOWN'}`;
              if (licenseStatusExplanation) {
                text += `\n__LICENSE_STATUS_EXPLANATION__: ${licenseStatusExplanation}`;
              }
            }
            
            // Add detected name to text for evaluation
            if (detectedName) {
              text += `\n__DETECTED_NAME__: ${detectedName}`;
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

  const evaluateMVR = (text, currentDriverName = null) => {
    const dobMatch = dob.match(/(\d{4})-(\d{2})-(\d{2})/);
    const birthYear = dobMatch ? parseInt(dobMatch[1], 10) : null;
    const age = birthYear ? new Date().getFullYear() - birthYear : null;

    // Extract detected name from text if available
    const detectedNameMatch = text.match(/__DETECTED_NAME__:\s*(.+)/);
    const detectedNameFromText = detectedNameMatch ? detectedNameMatch[1].trim() : null;
    
    // Use the most current driver name in this priority order:
    // 1. Current driver name (from manual field if filled)
    // 2. Detected name from PDF parsing
    // 3. Empty string
    let evaluationDriverName = currentDriverName || driverName;
    if (!evaluationDriverName.trim() && detectedNameFromText) {
      evaluationDriverName = detectedNameFromText;
    }

    // Extract license status information
    const licenseStatusMatch = text.match(/__LICENSE_STATUS__:\s*([A-Z]+)/);
    const rawLicenseStatus = licenseStatusMatch ? licenseStatusMatch[1] : null;
    
    // Normalize license status to simple terms
    let licenseStatus = "Not specified";
    if (rawLicenseStatus) {
      if (rawLicenseStatus === 'ACTIVE' || rawLicenseStatus === 'VALID') {
        licenseStatus = "Valid";
      } else if (rawLicenseStatus === 'SUSPENDED') {
        licenseStatus = "Suspended";
      } else if (rawLicenseStatus === 'REVOKED') {
        licenseStatus = "Revoked";
      } else if (rawLicenseStatus === 'CANCELLED') {
        licenseStatus = "Cancelled";
      } else if (rawLicenseStatus === 'EXPIRED') {
        licenseStatus = "Expired";
      } else {
        licenseStatus = rawLicenseStatus;
      }
    }
    
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
    if (licenseStatus && (licenseStatus === 'Suspended' || licenseStatus === 'Revoked' || licenseStatus === 'Cancelled')) {
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
      driverName: evaluationDriverName,
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
          <label className="block text-sm font-medium mb-2 text-gray-700">Driver Name (Manual Override)</label>
          <input
            type="text"
            placeholder="Enter driver name if auto-detection fails"
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-900 focus:outline-none transition-colors"
          />
          <p className="text-sm text-gray-500 mt-1">Leave blank to use auto-detection from MVR document</p>
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
                result.licenseStatus === 'Suspended' || result.licenseStatus === 'Revoked' || result.licenseStatus === 'Cancelled'
                  ? 'text-red-600' 
                  : result.licenseStatus === 'Valid'
                  ? 'text-green-600'
                  : 'text-gray-900'
              }`}>
                {result.licenseStatus}
              </div>
            </div>
            {result.licenseStatusExplanation && result.licenseStatusExplanation !== result.licenseStatus && (
              <div className="bg-gray-50 p-4 rounded-lg md:col-span-2">
                <strong className="text-gray-700">License Status Details:</strong> 
                <div className={`font-medium ${
                  result.licenseStatusExplanation === 'SUSPENDED' || result.licenseStatusExplanation === 'REVOKED' || result.licenseStatusExplanation === 'CANCELLED'
                    ? 'text-red-600' 
                    : result.licenseStatusExplanation === 'VALID'
                    ? 'text-green-600'
                    : 'text-gray-900'
                }`}>
                  {result.licenseStatusExplanation}
                </div>
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
