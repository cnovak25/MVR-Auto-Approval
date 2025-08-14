// Test script for Gregory Schimanski MVR violation detection
const fs = require('fs');

// Read the Gregory Schimanski MVR content
const mvrContent = `GREGORY SCHIMANSKI

Violations/ConvictionsFailures To Appear Accidents
TYPE
VIOL
CONV
ACD
AVD
V/C
DESCRIPTION
C
SPEED
LOCATION/
TICKET
ACCD
ATFAULT
PT
VIOL
06/26/2020
10/06/2020
S92
SA91
346.57(4
SPEEDING (1 -10 OVER)
N
87/70
MONROE COUNTYCIRCUITCOURT/2020TR002590
3
VIOL
06/29/2023
08/02/2023
M34
ME05
346.14(1
FOLLOWINGTOO CLOSELY
N
MOUNT PLEASANTVILLAGE MUNICIPALCOURT - RACINE
3
ACCD
06/29/2023
-
AA01
-
** ACCIDENT**
N
RACINE/230609570
*ACC*`;

// Simplified version of our violation detection logic for testing
const countViolationsAndAccidents = (text) => {
  const lines = text.split('\n');
  let violations = 0;
  let accidents = 0;
  let inViolationsSection = false;
  let headerEndLine = -1; // Track where headers end
  
  console.log("🚗 Starting violation/accident detection...");
  
  // First pass: find where headers end
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lowerLine = line.toLowerCase();
    
    if (lowerLine.includes('violations/convictions') || 
        (lowerLine.includes('violations') && lowerLine.includes('accidents'))) {
      inViolationsSection = true;
      continue;
    }
    
    if (inViolationsSection) {
      // Look for PT which is typically the last header in Wisconsin format
      if (line.trim() === 'PT') {
        headerEndLine = i;
        console.log(`📋 Headers end at line ${i} (PT)`);
        break;
      }
    }
  }
  
  // Second pass: detect violations and accidents
  inViolationsSection = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lowerLine = line.toLowerCase();
    
    // Detect section headers
    if (lowerLine.includes('violations/convictions') || 
        (lowerLine.includes('violations') && lowerLine.includes('accidents'))) {
      inViolationsSection = true;
      console.log("📋 Found violations section header at line", i);
      continue;
    }
    
    if (inViolationsSection && line.length > 0 && i > headerEndLine) {
      console.log(`🔍 Checking line ${i}: "${line}"`);
      
      const datePattern = /\d{2}\/\d{2}\/\d{4}/;
      
      // Wisconsin Columnar Format: "VIOL" in TYPE column indicates start of violation record
      if (line.trim() === 'VIOL') {
        // Look ahead for dates in the next few lines to confirm this is a violation record
        let foundViolationData = false;
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          const nextLine = lines[j].trim();
          if (datePattern.test(nextLine)) {
            foundViolationData = true;
            break;
          }
          // Stop if we hit another record type
          if (nextLine === 'ACCD' || nextLine === 'CONV' || nextLine === 'SUSP') {
            break;
          }
        }
        if (foundViolationData) {
          violations++;
          console.log(`✅ WISCONSIN VIOLATION DETECTED (columnar ${violations}): VIOL record starting at line ${i}`);
        }
      }
      
      // Wisconsin Columnar Format: "ACCD" in TYPE column indicates start of accident record
      else if (line.trim() === 'ACCD') {
        // Look ahead for dates or accident indicators
        let foundAccidentData = false;
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          const nextLine = lines[j].trim();
          if (datePattern.test(nextLine) || 
              nextLine.toLowerCase().includes('accident') || 
              nextLine.includes('*acc*') || nextLine.includes('** accident**')) {
            foundAccidentData = true;
            break;
          }
          // Stop if we hit another record type
          if (nextLine === 'VIOL' || nextLine === 'CONV' || nextLine === 'SUSP') {
            break;
          }
        }
        if (foundAccidentData) {
          accidents++;
          console.log(`✅ WISCONSIN ACCIDENT DETECTED (columnar ${accidents}): ACCD record starting at line ${i}`);
        }
      }
    }
  }
  
  console.log(`🏁 FINAL COUNT - Violations: ${violations}, Accidents: ${accidents}`);
  return { violations, accidents };
};

// Test the detection
const result = countViolationsAndAccidents(mvrContent);
console.log('\n📊 FINAL RESULTS:');
console.log(`Violations: ${result.violations}`);
console.log(`Accidents: ${result.accidents}`);
