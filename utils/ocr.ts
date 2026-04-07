const OCR_API_KEY = 'K87899142388957';

export interface TextBlock {
  text: string;
  boundingBox: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export interface OCRResult {
  text: string;
  textBlocks: TextBlock[];
  imageWidth: number;
  imageHeight: number;
  confidence: number;
  blocks: Array<{
    text: string;
  }>;
}

export async function extractText(imageUri: string): Promise<OCRResult> {
  try {
    console.log('Starting OCR for:', imageUri);
    
    // Read the image file as blob
    const response = await fetch(imageUri);
    const blob = await response.blob();
    
    // Convert blob to base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        // Remove the data:image/...;base64, prefix
        const base64String = base64data.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    console.log('Image converted to base64');

    // Call OCR.space API with TextOverlay enabled
    const formData = new FormData();
    formData.append('base64Image', `data:image/jpeg;base64,${base64}`);
    formData.append('apikey', OCR_API_KEY);
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'true'); // CHANGED: Enable overlay for bounding boxes
    formData.append('OCREngine', '2'); // ADDED: Use Engine 2 for better results

    console.log('Calling OCR API...');

    const apiResponse = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData,
    });

    const result = await apiResponse.json();
    console.log('OCR Response received');

    if (result.OCRExitCode === 1 && result.ParsedResults?.length > 0) {
      const parsedResult = result.ParsedResults[0];
      const parsedText = parsedResult.ParsedText || '';
      
      console.log('OCR Success!');
      
      // EXTRACT TEXT BLOCKS WITH POSITIONS
      const textBlocks: TextBlock[] = [];
      
      if (parsedResult.TextOverlay && parsedResult.TextOverlay.Lines) {
        console.log(`📊 Found ${parsedResult.TextOverlay.Lines.length} lines`);
        
        for (const line of parsedResult.TextOverlay.Lines) {
          if (line.Words) {
            for (const word of line.Words) {
              textBlocks.push({
                text: word.WordText,
                boundingBox: {
                  left: word.Left,
                  top: word.Top,
                  width: word.Width,
                  height: word.Height
                }
              });
            }
          }
        }
      }
      
      console.log(`📊 Extracted ${textBlocks.length} text blocks`);
      
      // Calculate image dimensions from text blocks
      let maxX = 0;
      let maxY = 0;
      
      for (const block of textBlocks) {
        const right = block.boundingBox.left + block.boundingBox.width;
        const bottom = block.boundingBox.top + block.boundingBox.height;
        if (right > maxX) maxX = right;
        if (bottom > maxY) maxY = bottom;
      }
      
      console.log(`📐 Estimated image dimensions: ${maxX} x ${maxY}`);
      
      return {
        text: parsedText.trim(),
        textBlocks: textBlocks,
        imageWidth: maxX || 1024,
        imageHeight: maxY || 768,
        confidence: 0.9,
        blocks: [{ text: parsedText }],
      };
    } else {
      console.error('OCR failed:', result.ErrorMessage);
      throw new Error(result.ErrorMessage?.[0] || 'No text found in image');
    }
  } catch (error) {
    console.error('OCR Error:', error);
    throw error;
  }
}


export function categorizeMedicalText(text: string): string {
  const lower = text.toLowerCase();
  
  // Medical label categories
  if (lower.includes('tablet') || lower.includes('capsule') || lower.includes('pill')) {
    return 'Oral Medication';
  }
  if (lower.includes('drops') || lower.includes('solution') || lower.includes('liquid') || lower.includes('syrup')) {
    return 'Liquid Medication';
  }
  if (lower.includes('cream') || lower.includes('ointment') || lower.includes('gel') || lower.includes('lotion')) {
    return 'Topical Medication';
  }
  if (lower.includes('inhaler') || lower.includes('spray')) {
    return 'Inhalant';
  }
  if (lower.includes('vitamin') || lower.includes('supplement')) {
    return 'Supplement/Vitamin';
  }
  if (lower.includes('injection') || lower.includes('injectable')) {
    return 'Injectable';
  }
  if (lower.includes('patch')) {
    return 'Transdermal Patch';
  }
  if (lower.includes('suppository')) {
    return 'Suppository';
  }
  
  return 'Medication Label';
}

export function hasReadableText(result: OCRResult): boolean {
  return result.text.trim().length > 3;
}

export function categorizeText(text: string): string {
  const lower = text.toLowerCase();
  
  if (lower.includes('exit') || lower.includes('emergency')) {
    return 'Exit Sign';
  }
  if (lower.includes('mg') || lower.includes('ml') || lower.includes('tablet') || lower.includes('dose') || lower.includes('pharmacy')) {
    return 'Medication Label';
  }
  if (lower.match(/room\s*\d+|\d{3,}/)) {
    return 'Room Number';
  }
  if (lower.includes('restroom') || lower.includes('toilet') || lower.includes('wc')) {
    return 'Restroom Sign';
  }
  if (lower.includes('danger') || lower.includes('warning') || lower.includes('caution')) {
    return 'Warning Sign';
  }
  
  return 'General Text';
}