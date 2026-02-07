
export interface QualityResult {
  isGoodQuality: boolean;
  issues: string[];
  suggestions: string[];
  brightness: number;
  sharpness: number;
  resolution: number;
}

// Estimate brightness from file size heuristics
function estimateBrightness(
  fileSize: number,
  pixels: number,
  bytesPerPixel: number
): number {
  // Dark images compress better (smaller file size)
  // Bright images have more variation (larger file size)
  // This is a rough heuristic
  
  if (bytesPerPixel < 0.2) return 0.3; // Likely dark or heavily compressed
  if (bytesPerPixel < 0.3) return 0.45;
  if (bytesPerPixel < 0.5) return 0.6;
  if (bytesPerPixel < 0.7) return 0.75;
  return 0.85; // Likely bright or high quality
}

// Estimate sharpness from file size and compression
function estimateSharpness(
  bytesPerPixel: number,
  resolution: number
): number {
  // Blurry images compress very well (small file size)
  // Sharp images have more detail (larger file size)
  
  // Very low bytes per pixel = likely blurry/compressed
  if (bytesPerPixel < 0.15) return 0.2;
  if (bytesPerPixel < 0.25) return 0.4;
  if (bytesPerPixel < 0.4) return 0.6;
  if (bytesPerPixel < 0.6) return 0.8;
  return 0.9; // Likely sharp
}

export async function checkImageQuality(
  imageUri: string,
  width?: number,
  height?: number
): Promise<QualityResult> {
  const issues: string[] = [];
  const suggestions: string[] = [];
  
  // Default values
  let brightness = 0.5;
  let sharpness = 0.5;
  let resolution = Math.min(width || 0, height || 0);
  
  // Resolution check
  const minResolution = 500;
  
  if (width && height && (width < minResolution || height < minResolution)) {
    issues.push('Low resolution');
    suggestions.push('Move closer to the text');
  }
  
  // Aspect ratio check
  if (width && height) {
    const aspectRatio = Math.max(width, height) / Math.min(width, height);
    if (aspectRatio > 4) {
      issues.push('Unusual image shape');
      suggestions.push('Try to frame the text more directly');
    }
  }
  
  // File size analysis
  try {
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const fileSize = blob.size;
    const pixels = (width || 1000) * (height || 1000);
    const bytesPerPixel = fileSize / pixels;
    
    console.log(`Image analysis: ${width}x${height}, ${fileSize} bytes, ${bytesPerPixel.toFixed(3)} bytes/pixel`);
    
    // Estimate brightness
    brightness = estimateBrightness(fileSize, pixels, bytesPerPixel);
    
    // Estimate sharpness
    sharpness = estimateSharpness(bytesPerPixel, resolution);
    
    // Brightness check
    if (brightness < 0.35) {
      issues.push('Image appears too dark');
      suggestions.push('Use better lighting or enable flash');
    } else if (brightness > 0.8) {
      issues.push('Image may be overexposed');
      suggestions.push('Reduce lighting or avoid direct light source');
    }
    
    // Sharpness/blur check
    if (sharpness < 0.35) {
      issues.push('Image appears blurry or out of focus');
      suggestions.push('Hold camera steady and ensure text is in focus');
    }
    
    // Compression check
    if (bytesPerPixel < 0.15) {
      issues.push('Image is heavily compressed');
      suggestions.push('Take a new photo with better quality settings');
    }
    
  } catch (error) {
    console.warn('Could not analyze image file:', error);
    // Continue without file-based analysis
  }
  
  const isGoodQuality = issues.length === 0;
  
  return {
    isGoodQuality,
    issues,
    suggestions,
    brightness,
    sharpness,
    resolution,
  };
}

export function getQualityFeedback(result: QualityResult): string {
  if (result.isGoodQuality) {
    return 'Image quality is good';
  }
  
  const feedback = ['Image quality issues detected:', ...result.issues];
  if (result.suggestions.length > 0) {
    feedback.push('\n\nSuggestions:', ...result.suggestions);
  }
  
  return feedback.join(' ');
}

export function shouldProceedWithOCR(result: QualityResult): boolean {
  // Allow user to proceed even with warnings
  return true;
}

export function getQualityScore(result: QualityResult): string {
  // Calculate overall quality score
  let score = 0;
  let checks = 0;
  
  // Brightness score (ideal range: 0.4-0.75)
  if (result.brightness >= 0.35 && result.brightness <= 0.8) {
    score += 1;
  }
  checks += 1;
  
  // Sharpness score (good if > 0.35)
  if (result.sharpness > 0.35) {
    score += 1;
  }
  checks += 1;
  
  // Resolution score (good if > 500)
  if (result.resolution > 500) {
    score += 1;
  }
  checks += 1;
  
  const percentage = (score / checks) * 100;
  return `${Math.round(percentage)}%`;
}

export function getDetailedQualityInfo(result: QualityResult): string {
  return `Quality Score: ${getQualityScore(result)}
Resolution: ${result.resolution}px
Brightness: ${(result.brightness * 100).toFixed(0)}%
Sharpness: ${(result.sharpness * 100).toFixed(0)}%`;
}