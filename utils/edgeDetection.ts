/**
 * Edge Detection Utility
 * Detects if medication labels are truncated at image edges
 */

export interface EdgeDetectionResult {
  isTruncated: boolean;
  truncatedEdges: string[];
  confidence: number;
  guidance: string;
}

export interface TextBlock {
  text: string;
  boundingBox: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

/**
 * Detect if label is truncated at edges
 */
export function detectTruncatedLabel(
  textBlocks: TextBlock[],
  imageWidth: number,
  imageHeight: number
): EdgeDetectionResult {
  
  if (!textBlocks || textBlocks.length === 0) {
    return {
      isTruncated: false,
      truncatedEdges: [],
      confidence: 0,
      guidance: ''
    };
  }

  const EDGE_THRESHOLD = 0.05; // 5% from edge
  const truncatedEdges: string[] = [];
  
  const topEdge = imageHeight * EDGE_THRESHOLD;
  const bottomEdge = imageHeight * (1 - EDGE_THRESHOLD);
  const leftEdge = imageWidth * EDGE_THRESHOLD;
  const rightEdge = imageWidth * (1 - EDGE_THRESHOLD);
  
  let topBlocks = 0;
  let bottomBlocks = 0;
  let leftBlocks = 0;
  let rightBlocks = 0;
  
  // Check each text block
  for (const block of textBlocks) {
    const box = block.boundingBox;
    
    if (box.top < topEdge) topBlocks++;
    if (box.top + box.height > bottomEdge) bottomBlocks++;
    if (box.left < leftEdge) leftBlocks++;
    if (box.left + box.width > rightEdge) rightBlocks++;
  }
  
  const totalBlocks = textBlocks.length;
  const TRUNCATION_RATIO = 0.3; // 30% of blocks at edge = truncated
  
  if (topBlocks / totalBlocks > TRUNCATION_RATIO) {
    truncatedEdges.push('top');
  }
  if (bottomBlocks / totalBlocks > TRUNCATION_RATIO) {
    truncatedEdges.push('bottom');
  }
  if (leftBlocks / totalBlocks > TRUNCATION_RATIO) {
    truncatedEdges.push('left');
  }
  if (rightBlocks / totalBlocks > TRUNCATION_RATIO) {
    truncatedEdges.push('right');
  }
  
  const guidance = generateGuidance(truncatedEdges);
  
  return {
    isTruncated: truncatedEdges.length > 0,
    truncatedEdges,
    confidence: truncatedEdges.length > 0 ? 0.8 : 0,
    guidance
  };
}

/**
 * Generate directional guidance
 */
function generateGuidance(truncatedEdges: string[]): string {
  if (truncatedEdges.length === 0) return '';
  
  const directions: string[] = [];
  
  if (truncatedEdges.includes('top') && truncatedEdges.includes('bottom')) {
    directions.push('Move camera further away from the label');
  } else if (truncatedEdges.includes('top')) {
    directions.push('Tilt camera down slightly');
  } else if (truncatedEdges.includes('bottom')) {
    directions.push('Tilt camera up slightly');
  }
  
  if (truncatedEdges.includes('left') && truncatedEdges.includes('right')) {
    directions.push('Move camera back to fit the whole label');
  } else if (truncatedEdges.includes('left')) {
    directions.push('Move camera to the left');
  } else if (truncatedEdges.includes('right')) {
    directions.push('Move camera to the right');
  }
  
  return directions.join('. ');
}