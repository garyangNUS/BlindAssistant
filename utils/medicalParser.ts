export interface MedicationInfo {
  drugName?: string;
  dosageAmount?: string;
  dosageInstructions?: string;
  timing?: string;
  warnings?: string[];
  expirationDate?: string;
  pharmacy?: string;
  missingFields: string[];
}

export function extractMedicationInfo(text: string): MedicationInfo {
  const info: MedicationInfo = {
    missingFields: []
  };
  
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const lowerText = text.toLowerCase();
  
  // Extract drug name (usually first significant line, often in caps or bold)
  // Look for lines that aren't addresses, phone numbers, or common headers
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const line = lines[i];
    // Skip if it looks like address, phone, or common headers
    if (!line.match(/\d{3}-\d{3}-\d{4}/) && 
        !line.match(/^\d+\s+\w+\s+(street|st|avenue|ave|road|rd)/i) &&
        !line.toLowerCase().includes('pharmacy') &&
        line.length > 3) {
      info.drugName = line;
      break;
    }
  }
  
  // Extract dosage amount (e.g., "125mg", "0.5ml", "500 IU")
  const dosageMatch = text.match(/(\d+(?:\.\d+)?)\s*(mg|ml|mcg|g|iu|units?)/i);
  if (dosageMatch) {
    info.dosageAmount = dosageMatch[0];
  }
  
  // Extract dosage instructions
  // Pattern: "take X tablet(s) Y times [daily/per day]"
  const instructionPatterns = [
    /take\s+(\d+)\s+(tablet|capsule|pill)s?\s+(.+?(?:daily|day|morning|evening|bedtime|hour))/i,
    /(\d+)\s+(tablet|capsule|pill)s?\s+(.+?(?:times|daily|day))/i,
    /(once|twice|three times|1|2|3)\s+(?:times?\s+)?(?:per\s+)?(?:daily|day|a day)/i,
  ];
  
  for (const pattern of instructionPatterns) {
    const match = text.match(pattern);
    if (match) {
      info.dosageInstructions = match[0];
      break;
    }
  }
  
  // Extract timing information
  const timingPatterns = [
    'with food',
    'after meals',
    'before meals',
    'on empty stomach',
    'with meals',
    'in the morning',
    'at bedtime',
    'before bedtime',
  ];
  
  for (const pattern of timingPatterns) {
    if (lowerText.includes(pattern)) {
      info.timing = pattern.charAt(0).toUpperCase() + pattern.slice(1);
      break;
    }
  }
  
  // Extract warnings
  const warnings: string[] = [];
  const warningPatterns = [
    { pattern: 'may cause drowsiness', warning: 'May cause drowsiness' },
    { pattern: 'do not drink alcohol', warning: 'Avoid alcohol' },
    { pattern: 'avoid alcohol', warning: 'Avoid alcohol' },
    { pattern: 'may affect driving', warning: 'May affect ability to drive' },
    { pattern: 'do not operate', warning: 'Do not operate machinery' },
    { pattern: 'take with food', warning: 'Must be taken with food' },
    { pattern: 'do not crush', warning: 'Do not crush or chew' },
    { pattern: 'keep out of reach', warning: 'Keep away from children' },
  ];
  
  for (const { pattern, warning } of warningPatterns) {
    if (lowerText.includes(pattern)) {
      warnings.push(warning);
    }
  }
  
  if (warnings.length > 0) {
    info.warnings = warnings;
  }
  
  // Extract expiration date
  const expPatterns = [
    /exp(?:ires?|iration)?[:\s]+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
    /use\s+by[:\s]+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
    /discard\s+by[:\s]+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
  ];
  
  for (const pattern of expPatterns) {
    const match = text.match(pattern);
    if (match) {
      info.expirationDate = match[1];
      break;
    }
  }
  
  // Extract pharmacy name
  if (lowerText.includes('pharmacy')) {
    const pharmacyMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+Pharmacy/i);
    if (pharmacyMatch) {
      info.pharmacy = pharmacyMatch[0];
    }
  }
  
  // Check for missing critical fields
  if (!info.drugName) {
    info.missingFields.push('Medication name');
  }
  if (!info.dosageAmount) {
    info.missingFields.push('Dosage amount');
  }
  if (!info.dosageInstructions) {
    info.missingFields.push('Dosage instructions');
  }
  
  return info;
}

export function formatForSpeech(info: MedicationInfo): string {
  const parts: string[] = [];
  
  if (info.drugName) {
    parts.push(`Medication: ${info.drugName}`);
  }
  
  if (info.dosageAmount) {
    parts.push(`Dosage: ${info.dosageAmount}`);
  }
  
  if (info.dosageInstructions) {
    parts.push(`Instructions: ${info.dosageInstructions}`);
  }
  
  if (info.timing) {
    parts.push(`Timing: ${info.timing}`);
  }
  
  if (info.warnings && info.warnings.length > 0) {
    parts.push(`Warning: ${info.warnings.join('. ')}`);
  }
  
  if (info.expirationDate) {
    parts.push(`Expires: ${info.expirationDate}`);
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
  
  if (info.missingFields.length === 1) {
    return `⚠️ ${info.missingFields[0]} not detected. Ensure full label is visible and in focus.`;
  }
  
  return `⚠️ Missing information: ${info.missingFields.join(', ')}. Try capturing the entire label.`;
}

export function hasCriticalInfo(info: MedicationInfo): boolean {
  // At minimum, we need drug name AND either dosage amount or instructions
  return !!(info.drugName && (info.dosageAmount || info.dosageInstructions));
}