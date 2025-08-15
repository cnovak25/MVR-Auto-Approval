/**
 * Comprehensive Multi-State MVR Parsing Standards
 * Based on AAMVA (American Association of Motor Vehicle Administrators) standards
 * and individual state DMV formats for all 50 states + DC
 */

export const MVR_STATE_STANDARDS = {
  // Section Headers by State
  SECTION_HEADERS: {
    // Most common headers across states
    VIOLATIONS: [
      'violations', 'convictions', 'violations/convictions',
      'violation history', 'moving violations', 'traffic violations',
      'conviction record', 'traffic convictions', 'violation record',
      'violationsconvictions', 'violations/convictionsfailures', // Arizona condensed
      'moving violation convictions', 'driver record', 'driving record'
    ],
    ACCIDENTS: [
      'accidents', 'accident history', 'accident record',
      'collision history', 'crash history', 'incidents'
    ],
    LICENSE_STATUS: [
      'license status', 'driver license status', 'status',
      'current status', 'license information', 'permit information'
    ]
  },

  // Date Patterns by State
  DATE_PATTERNS: {
    STANDARD: /\d{1,2}[\/-]\d{1,2}[\/-](\d{4}|\d{2})/, // MM/DD/YYYY, MM-DD-YYYY, MM/DD/YY (removed global flag)
    ISO: /\d{4}-\d{2}-\d{2}/, // YYYY-MM-DD (removed global flag)
    COMPACT: /\d{6,8}/, // MMDDYYYY or MMDDYY (removed global flag)
    VERBAL: /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}/i // Removed global flag
  },

  // Violation Indicators by State
  VIOLATION_INDICATORS: {
    // Record Type Prefixes
    PREFIXES: ['VIOL', 'CONV', 'CITATION', 'TICKET', 'INFRACTION'],
    
    // Violation Type Codes (AAMVA Standard)
    CODES: [
      // General codes
      'ABS', 'CONV', 'FTA', 'SUSP', 'CDL', 'V', 'C', 'M',
      // Speed related
      'S14', 'S15', 'S16', 'S21', 'S92', 'S93', 'S94', 'S95',
      // Following/Lane
      'M34', 'M40', 'M41', 'M42', 'M70', 'M71', 'M72',
      // Equipment/Registration
      'E01', 'E34', 'E50', 'E70', 'B91', 'D02', 'D16'
    ],

    // Common violation keywords
    KEYWORDS: [
      'speed', 'speeding', 'excessive speed', 'speed limit',
      'fail to stop', 'failure to', 'driving', 'vehicle', 'traffic',
      'dui', 'dwi', 'owi', 'drunk driving', 'driving under influence',
      'license', 'registration', 'insurance', 'equipment',
      'reckless', 'careless', 'following', 'lane', 'signal', 'turn',
      'parking', 'stop sign', 'red light', 'yield', 'unsafe', 'improper',
      'violation', 'convicted', 'guilty', 'citation', 'ticket', 'fine',
      'mph', 'exceed', 'aggressive', 'distracted',
      'seatbelt', 'restraint', 'cellular', 'phone', 'texting',
      'following too closely', 'unsafe lane change', 'ran red light'
    ]
  },

  // State-Specific Patterns
  STATE_FORMATS: {
    ALABAMA: {
      codes: ['AL'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CONVICTION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    ALASKA: {
      codes: ['AK'],
      violationPattern: /\d{2}-\d{2}-\d{4}.*?(VIOL|CONV)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    ARIZONA: {
      codes: ['AZ', 'ARIZONA'],
      violationPattern: /VIOL\s+\d{2}\/\d{2}\/\d{4}/i,
      statuteCodes: /(ARS|A\.R\.S\.)\s*\d+[\-\.]\d+/i,
      ticketPattern: /[A-Z]{1,3}\d{6,}/,
      sectionHeaders: ['Violations/ConvictionsFailures', 'ARIZONA'],
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED'],
      specialCodes: ['28-701', '28-729', '28-1381', '28-1382', '28-1383']
    },
    
    ARKANSAS: {
      codes: ['AR'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|MOVING)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    CALIFORNIA: {
      codes: ['CA', 'CALIFORNIA'],
      violationPattern: /(VIOL|CONV)\s+\d{2}\/\d{2}\/\d{4}/i,
      sectionHeaders: ['VIOLATIONS/CONVICTIONS', 'CONVICTION RECORD'],
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED'],
      specialCodes: ['23152A', '23152B', '23103', '23140'], // DUI codes
      courtPattern: /[A-Z]+\s+COURT/i
    },
    
    COLORADO: {
      codes: ['CO'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOL|CITATION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    CONNECTICUT: {
      codes: ['CT'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|INFRACTION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    DELAWARE: {
      codes: ['DE'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOL|CONV)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    FLORIDA: {
      codes: ['FL', 'FLORIDA'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(CITATION|CONVICTION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED', 'CANCELLED'],
      specialCodes: ['316.193', '322.2615'] // DUI codes
    },
    
    GEORGIA: {
      codes: ['GA'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CONVICTION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    HAWAII: {
      codes: ['HI'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOL|CITATION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    IDAHO: {
      codes: ['ID'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CONVICTION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    ILLINOIS: {
      codes: ['IL'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CONVICTION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    INDIANA: {
      codes: ['IN'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|INFRACTION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    IOWA: {
      codes: ['IA'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CITATION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    KANSAS: {
      codes: ['KS'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CONVICTION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    KENTUCKY: {
      codes: ['KY'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CITATION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    LOUISIANA: {
      codes: ['LA'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CONVICTION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    MAINE: {
      codes: ['ME'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CONVICTION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    MARYLAND: {
      codes: ['MD'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CITATION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    MASSACHUSETTS: {
      codes: ['MA'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CITATION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    MICHIGAN: {
      codes: ['MI'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CONVICTION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    MINNESOTA: {
      codes: ['MN'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CITATION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    MISSISSIPPI: {
      codes: ['MS'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CONVICTION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    MISSOURI: {
      codes: ['MO'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CONVICTION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    MONTANA: {
      codes: ['MT'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CITATION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    NEBRASKA: {
      codes: ['NE'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CONVICTION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    NEVADA: {
      codes: ['NV'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CITATION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    NEW_HAMPSHIRE: {
      codes: ['NH'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CONVICTION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    NEW_JERSEY: {
      codes: ['NJ'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CONVICTION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    NEW_MEXICO: {
      codes: ['NM'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CITATION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    NEW_YORK: {
      codes: ['NY'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CONVICTION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    NORTH_CAROLINA: {
      codes: ['NC'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CONVICTION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    NORTH_DAKOTA: {
      codes: ['ND'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CITATION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    OHIO: {
      codes: ['OH'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CONVICTION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    OKLAHOMA: {
      codes: ['OK'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CITATION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    OREGON: {
      codes: ['OR'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CONVICTION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    PENNSYLVANIA: {
      codes: ['PA'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CITATION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    RHODE_ISLAND: {
      codes: ['RI'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CONVICTION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    SOUTH_CAROLINA: {
      codes: ['SC'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CONVICTION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    SOUTH_DAKOTA: {
      codes: ['SD'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CITATION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    TENNESSEE: {
      codes: ['TN'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CONVICTION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    TEXAS: {
      codes: ['TX', 'TEXAS'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CONVICTION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED'],
      specialCodes: ['TRC 49.04', '49.04', 'TRC 49.045', '49.045', 'TPC 49.04']
    },
    
    UTAH: {
      codes: ['UT'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CITATION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    VERMONT: {
      codes: ['VT'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CONVICTION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    VIRGINIA: {
      codes: ['VA'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CONVICTION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    WASHINGTON: {
      codes: ['WA'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CITATION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    WEST_VIRGINIA: {
      codes: ['WV'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CONVICTION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    WISCONSIN: {
      codes: ['WI', 'WISCONSIN'],
      violationPattern: /^VIOL$/m, // Columnar format
      sectionHeaders: ['VIOLATIONS/CONVICTIONS', 'Violations/Convictions'],
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED'],
      columnarFormat: true,
      typeColumn: ['VIOL', 'ACCD', 'CONV', 'SUSP']
    },
    
    WYOMING: {
      codes: ['WY'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CITATION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    },
    
    WASHINGTON_DC: {
      codes: ['DC'],
      violationPattern: /\d{2}\/\d{2}\/\d{4}.*?(VIOLATION|CITATION)/i,
      statusFormats: ['VALID', 'SUSPENDED', 'REVOKED']
    }
  },

  // Major Conviction Codes (DUI/Serious Offenses) by State
  MAJOR_CONVICTIONS: {
    // Generic terms (work across all states)
    GENERIC: [
      "DUI", "DWI", "OWI", "OUI", "reckless driving", "vehicular assault", 
      "homicide", "hit and run", "leaving the scene", "driving while suspended", 
      "open container", "BAC", "blood alcohol", "driving with bac", 
      "driving under influence", "excessive blood", "refuse breath", 
      "refuse chemical", "implied consent"
    ],
    
    // State-specific codes
    CALIFORNIA: ["23152A", "23152B", "23103", "23140"],
    ARIZONA: ["ARS 28-1381", "ARS 28-1382", "ARS 28-1383", "28-1381", "28-1382", "28-1383"],
    TEXAS: ["TRC 49.04", "49.04", "TRC 49.045", "49.045", "TPC 49.04"],
    FLORIDA: ["316.193", "322.2615"],
    NEW_YORK: ["VTL 1192", "1192.1", "1192.2", "1192.3"],
    ILLINOIS: ["625 ILCS 5/11-501"],
    PENNSYLVANIA: ["3802", "75 Pa.C.S. 3802"],
    OHIO: ["4511.19", "ORC 4511.19"],
    MICHIGAN: ["257.625", "MCL 257.625"],
    GEORGIA: ["40-6-391", "O.C.G.A. 40-6-391"]
  },

  // Clean Record Indicators (only check these in appropriate context)
  CLEAN_INDICATORS: [
    'no violations', 'no accidents', 'clean record', 'no convictions',
    'clear record', 'no moving violations', 'satisfactory record'
  ],
  
  // These should only be considered clean if they appear in violations section
  CONTEXTUAL_CLEAN_INDICATORS: [
    '*** no activity ***', '*** none to report ***', 'none to report'
  ]
};

/**
 * Universal MVR Parser that works across all 50 states
 */
export class UniversalMVRParser {
  constructor() {
    this.debugMode = true;
  }

  /**
   * Detect the state/format of the MVR
   */
  detectState(text) {
    const textLower = text.toLowerCase();
    
    // Special handling for common states first (most specific patterns)
    if (textLower.includes('arizona') || textLower.includes('state of arizona') || 
        textLower.includes('arizona driver record') || /arizona\s+\(license/i.test(text)) {
      this.log(`🏛️ Detected state: ARIZONA`);
      return { state: 'ARIZONA', config: MVR_STATE_STANDARDS.STATE_FORMATS.ARIZONA };
    }
    
    if (textLower.includes('california') || textLower.includes('state of california') ||
        textLower.includes('california dmv')) {
      this.log(`🏛️ Detected state: CALIFORNIA`);
      return { state: 'CALIFORNIA', config: MVR_STATE_STANDARDS.STATE_FORMATS.CALIFORNIA };
    }
    
    if (textLower.includes('wisconsin') || textLower.includes('state of wisconsin')) {
      this.log(`🏛️ Detected state: WISCONSIN`);
      return { state: 'WISCONSIN', config: MVR_STATE_STANDARDS.STATE_FORMATS.WISCONSIN };
    }
    
    if (textLower.includes('texas') || textLower.includes('state of texas')) {
      this.log(`🏛️ Detected state: TEXAS`);
      return { state: 'TEXAS', config: MVR_STATE_STANDARDS.STATE_FORMATS.TEXAS };
    }
    
    if (textLower.includes('florida') || textLower.includes('state of florida')) {
      this.log(`🏛️ Detected state: FLORIDA`);
      return { state: 'FLORIDA', config: MVR_STATE_STANDARDS.STATE_FORMATS.FLORIDA };
    }
    
    // Then check for other states by full name or specific patterns
    for (const [stateName, stateConfig] of Object.entries(MVR_STATE_STANDARDS.STATE_FORMATS)) {
      // Skip states we already checked
      if (['ARIZONA', 'CALIFORNIA', 'WISCONSIN', 'TEXAS', 'FLORIDA'].includes(stateName)) {
        continue;
      }
      
      for (const code of stateConfig.codes) {
        // Only match if it's a word boundary or part of state identification
        const regex = new RegExp(`\\b${code.toLowerCase()}\\b|state of ${code.toLowerCase()}`, 'i');
        if (regex.test(textLower)) {
          this.log(`🏛️ Detected state: ${stateName} (${code})`);
          return { state: stateName, config: stateConfig };
        }
      }
    }
    
    this.log('🏛️ Could not detect specific state, using generic parsing');
    return { state: 'GENERIC', config: null };
  }

  /**
   * Parse violations using state-specific logic
   */
  parseViolations(text) {
    const lines = text.split('\n');
    const { state, config } = this.detectState(text);
    
    let violations = 0;
    let accidents = 0;
    let inViolationsSection = false;
    
    this.log(`🔍 Starting ${state} violation parsing...`);
    
    // Find violations section and parse violations
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lowerLine = line.toLowerCase();
      
      // Detect section headers
      if (!inViolationsSection) {
        for (const header of MVR_STATE_STANDARDS.SECTION_HEADERS.VIOLATIONS) {
          if (lowerLine.includes(header)) {
            inViolationsSection = true;
            this.log(`📋 Found violations section: "${line}"`);
            break;
          }
        }
        continue;
      }
      
      // Skip empty lines
      if (!line) continue;
      
      // End violations section detection
      if (lowerLine.includes('suspensions') || lowerLine.includes('license and permit') ||
          lowerLine.includes('miscellaneous')) {
        if (inViolationsSection) {
          this.log(`📋 End of violations section: "${line}"`);
          inViolationsSection = false;
        }
        continue;
      }
      
      // Parse violations in violations section
      if (inViolationsSection) {
        let violationFound = 0;
        
        if (config && state === 'WISCONSIN' && config.columnarFormat) {
          violationFound = this.parseWisconsinColumnar(lines, i);
        } else if (config && state === 'ARIZONA') {
          violationFound = this.parseArizonaFormat(line);
        } else if (config && state === 'CALIFORNIA') {
          violationFound = this.parseCaliforniaFormat(line);
        } else {
          // Generic parsing for all other states
          violationFound = this.parseGenericViolation(line);
        }
        
        violations += violationFound;
      }
    }
    
    // Only check for clean indicators if no violations were found
    if (violations === 0) {
      // Check for explicit clean record indicators
      for (const indicator of MVR_STATE_STANDARDS.CLEAN_INDICATORS) {
        if (text.toLowerCase().includes(indicator)) {
          this.log(`✅ No violations found and clean record indicator present: "${indicator}"`);
          break;
        }
      }
    } else {
      this.log(`🎯 Found ${violations} violations - record is not clean`);
    }
    
    this.log(`🏁 Final count: ${violations} violations, ${accidents} accidents`);
    return { violations, accidents };
  }

  /**
   * Wisconsin columnar format parser
   */
  parseWisconsinColumnar(lines, index) {
    const line = lines[index].trim();
    if (line === 'VIOL') {
      // Look ahead for dates to confirm
      for (let j = index + 1; j < Math.min(index + 10, lines.length); j++) {
        if (MVR_STATE_STANDARDS.DATE_PATTERNS.STANDARD.test(lines[j])) {
          this.log(`✅ Wisconsin VIOL detected at line ${index}`);
          return 1;
        }
      }
    }
    return 0;
  }

  /**
   * Arizona format parser
   */
  parseArizonaFormat(line) {
    const lowerLine = line.toLowerCase();
    
    // Check for VIOL prefix with dates or Arizona codes
    if (line.startsWith('VIOL') && 
        (MVR_STATE_STANDARDS.DATE_PATTERNS.STANDARD.test(line) ||
         MVR_STATE_STANDARDS.STATE_FORMATS.ARIZONA.statuteCodes.test(line) ||
         lowerLine.includes('28-701') || lowerLine.includes('special restrictions') ||
         lowerLine.includes('speed'))) {
      this.log(`✅ Arizona violation detected: ${line}`);
      return 1;
    }
    
    // More aggressive Arizona detection - any line with dates and violation indicators
    if (MVR_STATE_STANDARDS.DATE_PATTERNS.STANDARD.test(line)) {
      const hasViolationKeyword = ['speed', 'violation', 'traffic', 'citation', 'ticket', 
                                   'court', 'fine', '28-701', 'restrictions'].some(keyword => 
        lowerLine.includes(keyword));
      
      if (hasViolationKeyword) {
        this.log(`✅ Arizona violation detected (aggressive): ${line}`);
        return 1;
      }
    }
    
    return 0;
  }

  /**
   * California format parser
   */
  parseCaliforniaFormat(line) {
    if ((line.startsWith('VIOL') || line.startsWith('CONV')) && 
        MVR_STATE_STANDARDS.DATE_PATTERNS.STANDARD.test(line)) {
      this.log(`✅ California violation detected: ${line}`);
      return 1;
    }
    return 0;
  }

  /**
   * Generic violation parser for all states
   */
  parseGenericViolation(line) {
    const lowerLine = line.toLowerCase();
    
    // Check if line has dates
    const hasDate = MVR_STATE_STANDARDS.DATE_PATTERNS.STANDARD.test(line);
    
    if (hasDate) {
      // Check for violation indicators
      const hasViolationCode = MVR_STATE_STANDARDS.VIOLATION_INDICATORS.CODES.some(code => 
        new RegExp(`\\b${code}\\b`, 'i').test(line));
      
      const hasViolationKeyword = MVR_STATE_STANDARDS.VIOLATION_INDICATORS.KEYWORDS.some(keyword => 
        lowerLine.includes(keyword));
      
      const hasTicketNumber = /[A-Z]\d+[A-Z]*\d+[A-Z]*/.test(line);
      
      if (hasViolationCode || hasViolationKeyword || hasTicketNumber) {
        this.log(`✅ Generic violation detected: ${line}`);
        return 1;
      }
    }
    
    return 0;
  }

  /**
   * Parse license status
   */
  parseLicenseStatus(text) {
    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lowerLine = line.toLowerCase();
      
      // Check for status patterns
      for (const header of MVR_STATE_STANDARDS.SECTION_HEADERS.LICENSE_STATUS) {
        if (lowerLine.includes(header)) {
          // Look for status on same line or next line
          const statusMatch = line.match(/status[:\s]+([a-zA-Z]+)/i);
          if (statusMatch) {
            return statusMatch[1].toUpperCase();
          }
          
          // Check next line
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim();
            const statusWords = ['VALID', 'ACTIVE', 'SUSPENDED', 'REVOKED', 'CANCELLED', 'EXPIRED'];
            for (const status of statusWords) {
              if (nextLine.toUpperCase().includes(status)) {
                return status;
              }
            }
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Check for major convictions
   */
  checkMajorConvictions(text, state = 'GENERIC') {
    const textLower = text.toLowerCase();
    const foundConvictions = [];
    
    // Check generic convictions with word boundaries to avoid false positives
    for (const conviction of MVR_STATE_STANDARDS.MAJOR_CONVICTIONS.GENERIC) {
      // Use word boundaries to ensure exact matches
      const regex = new RegExp(`\\b${conviction.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(text)) {
        foundConvictions.push(conviction);
        this.log(`✅ Major conviction detected: ${conviction}`);
      }
    }
    
    // Check state-specific convictions
    const stateConvictions = MVR_STATE_STANDARDS.MAJOR_CONVICTIONS[state];
    if (stateConvictions) {
      for (const conviction of stateConvictions) {
        // Use word boundaries for state-specific codes too
        const regex = new RegExp(`\\b${conviction.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(text)) {
          foundConvictions.push(conviction);
          this.log(`✅ State-specific major conviction detected: ${conviction}`);
        }
      }
    }
    
    return foundConvictions;
  }

  /**
   * Debug logging
   */
  log(message) {
    if (this.debugMode) {
      console.log(message);
    }
  }
}

export default UniversalMVRParser;
