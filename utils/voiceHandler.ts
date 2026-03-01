import * as Speech from 'expo-speech';

// Voice command patterns
export interface VoiceCommand {
  action: string;
  confidence: number;
  parameters?: any;
}

export function matchIntent(transcript: string): VoiceCommand {
  const lower = transcript.toLowerCase();
  
  // Read full label
  if (lower.includes('read') || lower.includes('scan') || lower.includes('analyze')) {
    return { action: 'read_full', confidence: 0.9 };
  }
  
  // Dosage query
  if (lower.includes('dosage') || lower.includes('how much') || lower.includes('dose')) {
    return { action: 'read_dosage', confidence: 0.85 };
  }
  
  // Warnings query
  if (lower.includes('warning') || lower.includes('safe') || lower.includes('side effect')) {
    return { action: 'read_warnings', confidence: 0.85 };
  }
  
  // Expiration query
  if (lower.includes('expire') || lower.includes('expiration') || lower.includes('valid')) {
    return { action: 'read_expiration', confidence: 0.85 };
  }
  
  // Instructions query
  if (lower.includes('instruction') || lower.includes('how to take') || lower.includes('when')) {
    return { action: 'read_instructions', confidence: 0.85 };
  }
  
  // Repeat
  if (lower.includes('repeat') || lower.includes('again') || lower.includes('say that')) {
    return { action: 'repeat', confidence: 0.9 };
  }
  
  // Help
  if (lower.includes('help') || lower.includes('command')) {
    return { action: 'help', confidence: 0.95 };
  }
  
  // Unknown
  return { action: 'unknown', confidence: 0.0 };
}

export function getHelpMessage(): string {
  return `Available commands: 
  Say "Read this label" to scan and read full medication information.
  Say "What's the dosage" to hear dosage only.
  Say "Any warnings" to hear safety warnings.
  Say "When does it expire" to hear expiration date.
  Say "Repeat that" to hear the last result again.
  Say "Help" to hear this message.`;
}

export async function speakText(text: string): Promise<void> {
  return new Promise((resolve) => {
    Speech.speak(text, {
      onDone: () => resolve(),
      language: 'en-US',
      pitch: 1.0,
      rate: 0.9,
    });
  });
}