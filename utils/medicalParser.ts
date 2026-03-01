export interface MedicationInfo {
  drugName?: string;
  medicationType?: string; // LOZENGES, TABLETS, SYRUP, OINTMENT, SACHET, etc.
  quantity?: string;
  dosageAmount?: string; // mg/ml (if present)
  dosageInstructions?: string;
  timing?: string;
  purpose?: string; // "FOR RELIEF OF SORETHROAT"
  warnings?: string[];
  expirationDate?: string;
  prescriptionDate?: string;
  pharmacy?: string;
  prescriber?: string;
  missingFields: string[];
  extractionConfidence: 'high' | 'medium' | 'low';
}

export function extractMedicationInfo(text: string): MedicationInfo {
  const info: MedicationInfo = {
    missingFields: [],
    extractionConfidence: 'low'
  };
  
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const lowerText = text.toLowerCase();
  let confidenceScore = 0;
  
  console.log('=== PARSING MEDICATION LABEL ===');
  console.log('Lines:', lines);
  
  // ========================================
  // PRIORITY 1: FIND MEDICATION NAME, TYPE & DOSAGE
  // Look for various medication forms, not just tablets
  // ========================================
  
  const medicationTypes = [
    'LOZENGES?', 'TABLETS?', 'CAPSULES?', 'PILLS?',
    'SYRUP', 'SUSPENSION', 'SOLUTION', 'DROPS',
    'OINTMENT', 'CREAM', 'GEL', 'PATCH',
    'INHALER', 'SPRAY', 'SUPPOSITORY',
    'SACHETS?', 'POWDER', 'GRANULES?'
  ];
  
  const typePattern = new RegExp(`(${medicationTypes.join('|')})`, 'i');
  
  for (const line of lines) {
    // Skip obvious non-medication lines
    const skipPatterns = [
      /^\d+\s+\w+\s+(Ave|Avenue|Street|Road|Dr|Lane|Boulevard|Blvd)/i, // Addresses
      /\d{3}-\d{3}-\d{4}/, // Phone numbers
      /^(Clinic|Pharmacy|Hospital|Centre|Center)/i, // Location names (at start of line)
      /^(TAKE|FOR|Qty|Date|Test|Discard|Refill)/i, // Instruction starters
    ];
    
    if (skipPatterns.some(pattern => pattern.test(line))) {
      continue;
    }
    
    // Check if line contains medication type
    const typeMatch = line.match(typePattern);
    if (typeMatch) {
      console.log('Found line with medication type:', line);
      
      // Extract everything before the medication type
      const typeName = typeMatch[0];
      const typeIndex = line.indexOf(typeName);
      let beforeType = line.substring(0, typeIndex).trim();
      
      // Clean up medication name
      beforeType = beforeType
        .replace(/^Qty:?\s*/i, '')       // Remove "Qty:"
        .replace(/^\d+\s*Tab\s*/i, '')   // Remove leading "12 Tab"
        .replace(/,\s*$/, '')            // Remove trailing comma
        .trim();
      
      console.log('Before type:', beforeType);
      
      // Split into parts and separate drug name from dosage
      // Example: "ACETYLCYSTEINE 1 00MG" or "VIOCIL (MAC)"
      const parts = beforeType.split(/\s+/);
      
      let drugParts = [];
      let dosageParts = [];
      let foundDosage = false;
      
      // Scan from right to left to find dosage pattern
      for (let i = parts.length - 1; i >= 0; i--) {
        const part = parts[i];
        
        // Check if this part looks like a dosage
        // Matches: "100MG", "00MG", "1", "20", "mg", "ml"
        if (part.match(/^\d+$/) || part.match(/\d*(?:mg|ml|mcg|g)$/i) || part.match(/^[O0o]+MG$/i)) {
          dosageParts.unshift(part);
          foundDosage = true;
        } else if (foundDosage) {
          // We've collected dosage parts, rest is drug name
          drugParts = parts.slice(0, i + 1);
          break;
        }
      }
      
      // If we didn't find dosage pattern, entire thing is drug name
      if (!foundDosage || drugParts.length === 0) {
        drugParts = parts;
        dosageParts = [];
      }
      
      // Set drug name
      if (drugParts.length > 0) {
        info.drugName = drugParts.join(' ');
        confidenceScore += 25;
        console.log('✓ Drug name:', info.drugName);
      }
      
      // Set medication type
      info.medicationType = typeName.toUpperCase();
      console.log('✓ Type:', info.medicationType);
      
      // Process dosage if found
      if (dosageParts.length > 0) {
        let dosage = dosageParts.join(' ');
        
        // Clean up OCR errors
        dosage = dosage
          .replace(/O/gi, '0')        // O → 0
          .replace(/\s+/g, '')        // Remove spaces: "1 00MG" → "100MG"
          .toLowerCase();
        
        // Add unit if missing
        if (!dosage.match(/mg|ml|mcg|g$/i)) {
          dosage += 'mg';
        }
        
        info.dosageAmount = dosage;
        confidenceScore += 15;
        console.log('✓ Dosage amount (from name):', dosage);
      }
      
      break; // Found medication, stop searching
    }
  }
  
  // ========================================
  // EXTRACT QUANTITY
  // "Qty: 12 Tab", "30ml", "100 capsules"
  // ========================================
  
  const qtyPatterns = [
    /Qty:?\s*(\d+\s*(?:Tab|Caps?|ml|g|tablets?|capsules?|lozenges?|sachets?))/i,
    /(\d+\s*(?:Tab|Caps?|ml|g|tablets?|capsules?|lozenges?|sachets?))/i,
  ];
  
  for (const pattern of qtyPatterns) {
    const match = text.match(pattern);
    if (match) {
      info.quantity = match[1].trim();
      confidenceScore += 5;
      console.log('✓ Quantity:', info.quantity);
      break;
    }
  }
  
  // ========================================
  // EXTRACT DOSAGE AMOUNT (if not found above)
  // Some meds have mg/ml separate from name
  // ========================================
  
  if (!info.dosageAmount) {
    const dosagePatterns = [
      /(\d+(?:\.\d+)?)\s*mg/gi,
      /(\d+(?:\.\d+)?)\s*ml/gi,
      /(\d+(?:\.\d+)?)\s*mcg/gi,
      /(\d+(?:\.\d+)?)\s*g(?!\w)/gi,
      
      // Handle OCR errors with spaces: "1 00MG" → "100mg"
      /(\d+\s+\d+)\s*(?:MG|ML|MCG|G)/gi,
    ];
    
    for (const pattern of dosagePatterns) {
      const match = text.match(pattern);
      if (match) {
        let dosage = match[0]
          .replace(/\s+/g, '')  // Remove all spaces: "1 00MG" → "100MG"
          .toLowerCase();       // Normalize case
        
        info.dosageAmount = dosage;
        confidenceScore += 10;
        console.log('✓ Dosage amount (pattern match):', info.dosageAmount);
        break;
      }
    }
  }
  
  // ========================================
  // EXTRACT INSTRUCTIONS (CRITICAL!)
  // ========================================
  
  const instructionPatterns = [
    // "TAKE 1 SACHET EVERY MORNING & AFTERNOON FOR 1 WEEK"
    /TAKE\s+\d+\s+(?:SACHET|TAB|TABLET|CAP|CAPSULE|LOZENGE)S?\s+.*?(?:MORNING|AFTERNOON|EVENING|NIGHT|DAY|DAILY|WEEK|HOUR|MONTH)/i,
    
    // "TAKE 1 TAB 4 TIMES A DAY"
    /TAKE\s+\d+\s+(?:TAB|TABLET|CAP|CAPSULE|SACHET|LOZENGE)S?\s+.*?(?:DAY|DAILY|HOUR|TIMES|WEEK)/i,
    
    // Standard patterns
    /take\s+(\d+)\s+(tablet|capsule|tab|cap|lozenge|sachet)s?\s+(.+?(?:daily|day|times|hour|morning|afternoon|evening|week|month))/i,
    
    // "1 tablet 2 times daily"
    /(\d+)\s+(tablet|capsule|tab|lozenge|sachet)s?\s+(\d+)\s+times?\s+(?:a|per)?\s*(?:day|daily)/i,
    
    // "Once daily", "Twice daily"
    /(once|twice|three times|four times)\s+(?:a|per)?\s*(?:day|daily)/i,
    
    // "Every morning", "Every 6 hours"
    /every\s+(?:morning|afternoon|evening|night|day)/i,
    /every\s+(\d+)\s+hours?/i,
    
    // "As needed", "When required"
    /as\s+needed|when\s+required|prn/i,
  ];
  
  for (const pattern of instructionPatterns) {
    const match = text.match(pattern);
    if (match) {
      info.dosageInstructions = match[0].trim();
      confidenceScore += 25;
      console.log('✓ Instructions:', info.dosageInstructions);
      break;
    }
  }
  
  // ========================================
  // EXTRACT PURPOSE ("FOR RELIEF OF...")
  // ========================================
  
  const purposePatterns = [
    /FOR\s+RELIEF\s+OF\s+([A-Z\s]+)/i,
    /FOR\s+TREATMENT\s+OF\s+([A-Z\s]+)/i,
    /FOR\s+([A-Z\s]{5,})/i,
  ];
  
  for (const pattern of purposePatterns) {
    const match = text.match(pattern);
    if (match) {
      // Get the full "FOR..." line
      const purposeLine = lines.find(line => line.match(pattern));
      if (purposeLine) {
        info.purpose = purposeLine.trim();
        confidenceScore += 15;
        console.log('✓ Purpose:', info.purpose);
        break;
      }
    }
  }
  
  // ========================================
  // EXTRACT TIMING
  // ========================================
  
  const timingPatterns = [
    { pattern: /with\s+food/i, text: 'With food' },
    { pattern: /after\s+(?:food|meals?)/i, text: 'After food' },
    { pattern: /before\s+(?:food|meals?)/i, text: 'Before food' },
    { pattern: /on\s+(?:an?\s+)?empty\s+stomach/i, text: 'On empty stomach' },
    { pattern: /at\s+bedtime|before\s+sleep/i, text: 'At bedtime' },
    { pattern: /in\s+the\s+morning/i, text: 'In the morning' },
    { pattern: /when\s+required|as\s+needed|prn/i, text: 'When required' },
  ];
  
  for (const { pattern, text: timingText } of timingPatterns) {
    if (pattern.test(text)) {
      info.timing = timingText;
      confidenceScore += 10;
      console.log('✓ Timing:', timingText);
      break;
    }
  }
  
  // ========================================
  // EXTRACT WARNINGS
  // ========================================
  
  const warnings: string[] = [];
  const warningPatterns = [
    { pattern: /may\s+cause\s+drowsiness/i, warning: 'May cause drowsiness' },
    { pattern: /drowsy|sleepy/i, warning: 'May cause drowsiness' },
    { pattern: /avoid\s+alcohol/i, warning: 'Avoid alcohol' },
    { pattern: /do\s+not\s+drive/i, warning: 'Do not drive or operate machinery' },
    { pattern: /pregnant|pregnancy/i, warning: 'Consult doctor if pregnant' },
    { pattern: /nursing|breastfeeding/i, warning: 'Consult doctor if breastfeeding' },
    { pattern: /keep\s+(?:out\s+of\s+reach|away\s+from)\s+children/i, warning: 'Keep away from children' },
    { pattern: /do\s+not\s+crush/i, warning: 'Do not crush or chew' },
    { pattern: /dissolve|suck/i, warning: 'Allow to dissolve in mouth' },
    { pattern: /dissolve\s+in\s+water/i, warning: 'Dissolve in water before taking' },
    { pattern: /shake\s+well/i, warning: 'Shake well before use' },
    { pattern: /refrigerate|keep\s+cold/i, warning: 'Store in refrigerator' },
  ];
  
  for (const { pattern, warning } of warningPatterns) {
    if (pattern.test(text) && !warnings.includes(warning)) {
      warnings.push(warning);
    }
  }
  
  if (warnings.length > 0) {
    info.warnings = warnings;
    confidenceScore += 10;
    console.log('✓ Warnings:', warnings);
  }
  
  // ========================================
  // EXTRACT DATES
  // Look for ANY date patterns, not just expiration
  // ========================================
  
  const datePatterns = [
    { pattern: /(?:Exp|Expir(?:y|ation)|Use\s+by)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i, type: 'expiration' },
    { pattern: /Discard\s+by[:\s]*(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})/i, type: 'expiration' },
    { pattern: /Date[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i, type: 'prescription' },
    { pattern: /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i, type: 'prescription' },
    { pattern: /(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/g, type: 'general' },
  ];
  
  for (const { pattern, type } of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      const dateValue = match[1] || match[0];
      
      if (type === 'expiration' && !info.expirationDate) {
        info.expirationDate = dateValue;
        confidenceScore += 5;
        console.log('✓ Expiration:', dateValue);
      } else if (type === 'prescription' && !info.prescriptionDate) {
        info.prescriptionDate = dateValue;
        confidenceScore += 5;
        console.log('✓ Prescription date:', dateValue);
      } else if (type === 'general' && !info.prescriptionDate && !info.expirationDate) {
        // Generic date, assign to prescription if not found yet
        info.prescriptionDate = dateValue;
        console.log('✓ Date found:', dateValue);
      }
    }
  }
  
  // ========================================
  // EXTRACT PHARMACY/CLINIC
  // ========================================
  const pharmacyPatterns = [
  // Specific known hospitals (single word format)
  /(RafflesHospital|Raffles\s+Hospital|TanTockSengHospital|SGH|NUH|TTSH|KK\s+Women|Changi\s+General)/i,
  
  // Generic patterns with space: "Kindred Family Clinic"
  /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Family\s+)?(?:Clinic|Pharmacy|Hospital)/i,
  
  // Single word ending in Hospital/Clinic/Pharmacy: "RafflesHospital"
  /([A-Z][a-zA-Z]+(?:Hospital|Clinic|Pharmacy))/i,
  
  // Lines with "SPECIALIST CENTRE": "RAFFLES SPECIALIST CENTRE"
  /([A-Z][A-Z\s]+)\s+SPECIALIST\s+(?:CENTRE|CENTER)/i,
  
  // Fallback: Clinic/Pharmacy/Hospital mentioned
  /((?:[A-Z][a-z]+\s*)+)\s*(?:Hospital|Clinic|Pharmacy)/i,
];

for (const pattern of pharmacyPatterns) {
  const match = text.match(pattern);
  if (match) {
    let pharmacyName = match[1] || match[0];
    
    // Clean up
    pharmacyName = pharmacyName.trim();
    
    // Skip invalid matches
    if (pharmacyName.length < 3) continue;
    if (pharmacyName.match(/^\d+$|^(STREET|ROAD|AVENUE|DR|DATE)$/i)) continue;
    
    info.pharmacy = pharmacyName;
    console.log('✓ Clinic/Pharmacy:', pharmacyName);
    break;
  }
}
 
  
  // ========================================
  // EXTRACT PRESCRIBER
  // ========================================
  
  const prescriberPatterns = [
    /(?:Dr\.?|Doctor)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
    /Prescriber[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
  ];
  
  for (const pattern of prescriberPatterns) {
    const match = text.match(pattern);
    if (match) {
      info.prescriber = match[0];
      console.log('✓ Prescriber:', info.prescriber);
      break;
    }
  }
  
  // ========================================
  // CHECK MISSING CRITICAL FIELDS
  // ========================================
  
  if (!info.drugName) {
    info.missingFields.push('Medication name');
  }
  
  if (!info.dosageInstructions) {
    info.missingFields.push('Dosage instructions');
  }
  
  // Note: Dosage amount (mg/ml) is NOT critical - many meds don't have it
  
  // ========================================
  // CALCULATE CONFIDENCE
  // ========================================
  
  if (confidenceScore >= 50) {
    info.extractionConfidence = 'high';
  } else if (confidenceScore >= 30) {
    info.extractionConfidence = 'medium';
  } else {
    info.extractionConfidence = 'low';
  }
  
  console.log('Confidence score:', confidenceScore);
  console.log('Extracted info:', info);
  console.log('=== END PARSING ===');
  
  return info;
}

export function formatForSpeech(info: MedicationInfo): string {
  const parts: string[] = [];
  
  // Priority 1: What is it?
  if (info.drugName) {
    if (info.medicationType) {
      parts.push(`${info.drugName} ${info.medicationType.toLowerCase()}`);
    } else {
      parts.push(`Medication: ${info.drugName}`);
    }
  }
  
  if (info.dosageAmount) {
    parts.push(`Strength: ${info.dosageAmount}`);
  }
  
  if (info.quantity) {
    parts.push(`Quantity: ${info.quantity}`);
  }
  
  // Priority 2: How to use
  if (info.dosageInstructions) {
    parts.push(info.dosageInstructions);
  }
  
  if (info.timing) {
    parts.push(info.timing);
  }
  
  // Priority 3: What's it for
  if (info.purpose) {
    parts.push(info.purpose);
  }
  
  // Priority 4: Warnings (important!)
  if (info.warnings && info.warnings.length > 0) {
    parts.push(`Warning: ${info.warnings.join('. ')}`);
  }
  
  // Additional info
  if (info.expirationDate) {
    parts.push(`Expires: ${info.expirationDate}`);
  }
  
  if (info.prescriptionDate) {
    parts.push(`Prescribed: ${info.prescriptionDate}`);
  }
  
  if (info.pharmacy) {
    parts.push(`From: ${info.pharmacy}`);
  }
  
  return parts.join('. ');
}

export function getMissingFieldsWarning(info: MedicationInfo): string | null {
  if (info.missingFields.length === 0) {
    return null;
  }
  
  // Don't warn about missing dosage amount - not all meds have it
  const criticalMissing = info.missingFields.filter(
    field => field !== 'Dosage amount'
  );
  
  if (criticalMissing.length === 0) {
    return null;
  }
  
  if (criticalMissing.length === 1) {
    return `⚠️ ${criticalMissing[0]} not detected. Ensure full label is visible and in focus.`;
  }
  
  return `⚠️ Missing: ${criticalMissing.join(', ')}. Try capturing the entire label.`;
}

export function hasCriticalInfo(info: MedicationInfo): boolean {
  // Critical: Must have medication name OR instructions
  // Dosage amount (mg) is NOT critical
  return !!(info.drugName || info.dosageInstructions);
}

export function getConfidenceMessage(info: MedicationInfo): string {
  switch (info.extractionConfidence) {
    case 'high':
      return '✓ High confidence';
    case 'medium':
      return '⚠️ Medium confidence';
    case 'low':
      return '❌ Low confidence - retake recommended';
    default:
      return '';
  }
}