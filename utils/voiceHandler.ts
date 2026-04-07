import * as Speech from 'expo-speech';

// Voice command patterns
export interface VoiceCommand {
  action: string;
  confidence: number;
  parameters?: any;
}

/**
 * Comprehensive Voice Command Matcher
 * Handles multiple ways of asking the same question
 */
export class VoiceCommandMatcher {
  // Synonym groups for better matching
  private static readonly SYNONYMS = {
    drug: ['drug', 'medicine', 'medication', 'tablet', 'pill', 'capsule', 'sachet', 'lozenge'],
    dosage: ['dosage', 'dose', 'strength', 'amount', 'quantity', 'how much', 'how many'],
    purpose: ['for', 'purpose', 'use', 'used for', 'treat', 'treating', 'why', 'what for'],
    instructions: ['instruction', 'how to take', 'how do i take', 'how to use', 'when to take', 'take it'],
    warnings: ['warning', 'side effect', 'caution', 'precaution', 'danger', 'safe', 'safety'],
    expiration: ['expire', 'expiration', 'expiry', 'best before', 'use by', 'valid until'],
    clinic: ['clinic', 'hospital', 'pharmacy', 'doctor', 'prescribe', 'prescribed', 'where from'],
  };

  /**
   * Main intent matching function
   */
  public static matchIntent(transcript: string): VoiceCommand {
    const normalized = this.normalizeTranscript(transcript);
    
    console.log('=== VOICE COMMAND MATCHER ===');
    console.log('Original:', transcript);
    console.log('Normalized:', normalized);

    // Try pattern matching in order of specificity
    
    // 1. Check for specific full medication info request
    const fullInfoMatch = this.matchFullInfo(normalized);
    if (fullInfoMatch.confidence > 0.5) return fullInfoMatch;

    // 2. Check for dosage/quantity
    const dosageMatch = this.matchDosage(normalized);
    if (dosageMatch.confidence > 0.5) return dosageMatch;

    // 3. Check for purpose
    const purposeMatch = this.matchPurpose(normalized);
    if (purposeMatch.confidence > 0.5) return purposeMatch;

    // 4. Check for instructions
    const instructionsMatch = this.matchInstructions(normalized);
    if (instructionsMatch.confidence > 0.5) return instructionsMatch;

    // 5. Check for warnings
    const warningsMatch = this.matchWarnings(normalized);
    if (warningsMatch.confidence > 0.5) return warningsMatch;

    // 6. Check for expiration
    const expirationMatch = this.matchExpiration(normalized);
    if (expirationMatch.confidence > 0.5) return expirationMatch;

    // 7. Check for clinic/pharmacy
    const clinicMatch = this.matchClinic(normalized);
    if (clinicMatch.confidence > 0.5) return clinicMatch;

    // 8. Check for control commands (repeat, help)
    const controlMatch = this.matchControlCommands(normalized);
    if (controlMatch.confidence > 0.5) return controlMatch;

    const cameraMatch = this.matchCameraCommands(normalized);
    if (cameraMatch.confidence > 0.5) return cameraMatch;

    // 9. No match found
    console.log('❌ No intent matched');
    return { action: 'unknown', confidence: 0.0 };
  }

  /**
   * Normalize the transcript for better matching
   */
  private static normalizeTranscript(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[?,!.]/g, '') // Remove punctuation
      .replace(/\s+/g, ' '); // Normalize spaces
  }

  /**
   * Check if text contains any word from a list
   */
  private static containsAny(text: string, words: string[]): boolean {
    return words.some(word => text.includes(word));
  }

  /**
   * Match: Full medication information
   * Examples: "what is this", "read this label", "tell me about this"
   */
  private static matchFullInfo(text: string): VoiceCommand {
    const patterns = [
      /what (is|are) (this|it|that)/,
      /read (this|the) (label|medication|medicine)/,
      /tell me (about|all about) (this|it)/,
      /scan (this|the) label/,
      /analyze (this|it)/,
    ];

    // Also check for drug synonyms
    if (this.containsAny(text, this.SYNONYMS.drug)) {
      return { action: 'read_full', confidence: 0.85 };
    }

    for (const pattern of patterns) {
      if (pattern.test(text)) {
        console.log('✅ Matched: Full Info');
        return { action: 'read_full', confidence: 0.9 };
      }
    }

    return { action: 'unknown', confidence: 0.0 };
  }

  /**
   * Match: Dosage/Quantity
   * Examples: "what's the dosage", "how much", "what is the quantity", "how many"
   */
  private static matchDosage(text: string): VoiceCommand {
    // Check for dosage synonyms
    if (this.containsAny(text, this.SYNONYMS.dosage)) {
      console.log('✅ Matched: Dosage');
      return { action: 'read_dosage', confidence: 0.9 };
    }

    // Check for "how much" or "how many"
    if (text.match(/how (much|many)/)) {
      console.log('✅ Matched: Dosage (how much/many)');
      return { action: 'read_dosage', confidence: 0.85 };
    }

    return { action: 'unknown', confidence: 0.0 };
  }

  /**
   * Match: Purpose/What it's for
   * Examples: "what's it for", "why is this", "what does it treat"
   */
  private static matchPurpose(text: string): VoiceCommand {
    const patterns = [
      /what.*(for|purpose|use)/,
      /why (is|do i|should i|take)/,
      /what does (it|this) (treat|do|help)/,
      /used for/,
    ];

    // Check purpose synonyms
    if (this.containsAny(text, this.SYNONYMS.purpose)) {
      // Make sure it's not asking about instructions
      if (!text.match(/how to|how do i|how should i/)) {
        console.log('✅ Matched: Purpose');
        return { action: 'read_purpose', confidence: 0.85 };
      }
    }

    for (const pattern of patterns) {
      if (pattern.test(text)) {
        console.log('✅ Matched: Purpose');
        return { action: 'read_purpose', confidence: 0.9 };
      }
    }

    return { action: 'unknown', confidence: 0.0 };
  }

  /**
   * Match: Instructions
   * Examples: "how do I take it", "how to use", "when to take", "instructions"
   */
  private static matchInstructions(text: string): VoiceCommand {
    const patterns = [
      /how (to|do i|should i) (take|use|consume)/,
      /when (to|do i|should i) (take|use)/,
      /how often/,
      /how (long|many times)/,
    ];

    // Check instruction synonyms
    if (this.containsAny(text, this.SYNONYMS.instructions)) {
      console.log('✅ Matched: Instructions');
      return { action: 'read_instructions', confidence: 0.9 };
    }

    for (const pattern of patterns) {
      if (pattern.test(text)) {
        console.log('✅ Matched: Instructions');
        return { action: 'read_instructions', confidence: 0.9 };
      }
    }

    return { action: 'unknown', confidence: 0.0 };
  }

  /**
   * Match: Warnings
   * Examples: "any warnings", "side effects", "is it safe", "precautions"
   */
  private static matchWarnings(text: string): VoiceCommand {
    const patterns = [
      /(any|are there|what are) (warning|side effect|precaution)/,
      /is (it|this) safe/,
      /should i (worry|be careful)/,
      /what (to|should i) (avoid|watch out)/,
    ];

    // Check warning synonyms
    if (this.containsAny(text, this.SYNONYMS.warnings)) {
      console.log('✅ Matched: Warnings');
      return { action: 'read_warnings', confidence: 0.9 };
    }

    for (const pattern of patterns) {
      if (pattern.test(text)) {
        console.log('✅ Matched: Warnings');
        return { action: 'read_warnings', confidence: 0.9 };
      }
    }

    return { action: 'unknown', confidence: 0.0 };
  }

  /**
   * Match: Expiration
   * Examples: "when does it expire", "expiration date", "is it still good"
   */
  private static matchExpiration(text: string): VoiceCommand {
    const patterns = [
      /when (does it|will it) expire/,
      /is (it|this) (still|) (good|valid|safe)/,
      /has (it|this) expired/,
      /can i still (use|take) (it|this)/,
    ];

    // Check expiration synonyms
    if (this.containsAny(text, this.SYNONYMS.expiration)) {
      console.log('✅ Matched: Expiration');
      return { action: 'read_expiration', confidence: 0.9 };
    }

    for (const pattern of patterns) {
      if (pattern.test(text)) {
        console.log('✅ Matched: Expiration');
        return { action: 'read_expiration', confidence: 0.9 };
      }
    }

    return { action: 'unknown', confidence: 0.0 };
  }

  /**
   * Match: Clinic/Pharmacy
   * Examples: "where was it prescribed", "which doctor", "what pharmacy"
   */
  private static matchClinic(text: string): VoiceCommand {
    const patterns = [
      /where (was it|is it) (prescribed|from)/,
      /(which|what) (doctor|clinic|hospital|pharmacy)/,
      /who prescribed/,
    ];

    // Check clinic synonyms
    if (this.containsAny(text, this.SYNONYMS.clinic)) {
      console.log('✅ Matched: Clinic');
      return { action: 'read_clinic', confidence: 0.85 };
    }

    for (const pattern of patterns) {
      if (pattern.test(text)) {
        console.log('✅ Matched: Clinic');
        return { action: 'read_clinic', confidence: 0.9 };
      }
    }

    return { action: 'unknown', confidence: 0.0 };
  }

  /**
   * Match: Control commands
   * Examples: "repeat", "say that again", "help", "what can you do"
   */
  private static matchControlCommands(text: string): VoiceCommand {
    // Repeat command
    if (text.match(/repeat|again|say (that|it) again/)) {
      console.log('✅ Matched: Repeat');
      return { action: 'repeat', confidence: 0.95 };
    }

    // Help command
    if (text.match(/help|what can (you|i)|commands|what (do you|can you) do/)) {
      console.log('✅ Matched: Help');
      return { action: 'help', confidence: 0.95 };
    }

    return { action: 'unknown', confidence: 0.0 };
  }

    /**
   * Match: Camera commands
   * Examples: "take photo", "capture image", "scan label", "take picture"
   */
  private static matchCameraCommands(text: string): VoiceCommand {
    // Take photo/picture
    if (text.match(/take (a |the |)?(photo|picture|pic|image|shot)/)) {
      console.log('✅ Matched: Take Photo');
      return { action: 'take_photo', confidence: 0.95 };
    }
    
    // Capture
    if (text.match(/capture (a |the |)?(photo|picture|image|label)/)) {
      console.log('✅ Matched: Capture Photo');
      return { action: 'take_photo', confidence: 0.95 };
    }
    
    // Scan label
    if (text.match(/scan (the |this |a |)?(label|medicine|medication|bottle|packet)/)) {
      console.log('✅ Matched: Scan Label');
      return { action: 'take_photo', confidence: 0.95 };
    }
    
    // Open camera
    if (text.match(/open (the |)camera/)) {
      console.log('✅ Matched: Open Camera');
      return { action: 'take_photo', confidence: 0.95 };
    }

    // Upload/choose image
    if (text.match(/upload (a |the |)?(photo|picture|image)/)) {
      console.log('✅ Matched: Upload Photo');
      return { action: 'upload_photo', confidence: 0.95 };
    }
    
    if (text.match(/choose (a |the |)?(photo|picture|image)/)) {
      console.log('✅ Matched: Choose Photo');
      return { action: 'upload_photo', confidence: 0.95 };
    }

    return { action: 'unknown', confidence: 0.0 };
  }
}



/**
 * Exported function for backward compatibility
 */
export function matchIntent(transcript: string): VoiceCommand {
  return VoiceCommandMatcher.matchIntent(transcript);
}

/**
 * Get help message
 */
export function getHelpMessage(): string {
  return `You can ask me things like:
  
  Camera:
  - "Take photo"
  - "Scan label"
  - "Capture image"

  About the medication:
  - "What is this?"
  - "Read this label"
  
  Dosage:
  - "What's the dosage?"
  - "How much do I take?"
  - "What's the quantity?"
  
  Purpose:
  - "What's it for?"
  - "What does it treat?"
  
  Instructions:
  - "How do I take it?"
  - "When should I take it?"
  
  Safety:
  - "Any warnings?"
  - "Is it safe?"
  - "Side effects?"
  
  Other:
  - "When does it expire?"
  - "Where was it prescribed?"
  - "Repeat that"`;
}

/**
 * Speak text using TTS
 */
export async function speakText(text: string): Promise<void> {
  return new Promise((resolve) => {
    Speech.speak(text, {
      onDone: () => resolve(),
      language: 'en-US',
      pitch: 1.0,
      rate: 0.85,
    });
  });
}