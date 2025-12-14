// V3 Image Editor - Segment Layer Utilities

import { Layer, Rectangle, createLayer, getContrastingColor } from '@/types/editor';

/**
 * Utilities for segment layers with unique colored fills
 */
export const SegmentLayerUtils = {
  /**
   * Create a new segment layer from a mask
   */
  createSegmentLayer(
    mask: Uint8ClampedArray,
    bounds: Rectangle,
    maskWidth: number,
    maskHeight: number,
    existingSegmentColors: string[],
    withGlow: boolean = false,
    sourceImage: ImageData,
  ): Layer {
    const segmentColor = getContrastingColor(existingSegmentColors);

    // Create ImageData using underlying image pixels with a subtle tint
    const imageData = new ImageData(maskWidth, maskHeight);
    const tint = hexToRgb(segmentColor);
    const srcData = sourceImage.data;
    const mix = 0.35; // how strong the tint is

    for (let i = 0; i < mask.length; i++) {
      if (mask[i] > 0) {
        const idx = i * 4;
        const baseR = srcData[idx];
        const baseG = srcData[idx + 1];
        const baseB = srcData[idx + 2];
        const baseA = srcData[idx + 3];

        imageData.data[idx] = Math.round(baseR + (tint.r - baseR) * mix);
        imageData.data[idx + 1] = Math.round(baseG + (tint.g - baseG) * mix);
        imageData.data[idx + 2] = Math.round(baseB + (tint.b - baseB) * mix);
        imageData.data[idx + 3] = withGlow ? baseA : Math.round(baseA * 0.9);
      }
    }

    return createLayer({
      name: `Segment ${Date.now() % 10000}`,
      type: 'raster',
      imageData,
      bounds: { x: 0, y: 0, width: maskWidth, height: maskHeight },
      isSegmentLayer: true,
      segmentColor,
      segmentGlow: withGlow,
      segmentMask: new Uint8ClampedArray(mask),
      segmentBounds: bounds,
    });
  },

  /**
   * Add segment to existing layer (merge overlaps) - uses source image pixels
   */
  mergeSegmentIntoLayer(
    layer: Layer,
    newMask: Uint8ClampedArray,
    maskWidth: number,
    maskHeight: number,
    sourceImage: ImageData
  ): Partial<Layer> {
    if (!layer.segmentMask || !layer.imageData) return {};
    
    const mergedMask = new Uint8ClampedArray(layer.segmentMask);
    const tint = hexToRgb(layer.segmentColor || '#4ecdc4');
    const mix = 0.35;
    
    // Create new image data preserving existing
    const newImageData = new ImageData(
      new Uint8ClampedArray(layer.imageData.data),
      layer.imageData.width,
      layer.imageData.height
    );
    
    const srcData = sourceImage.data;
    
    for (let i = 0; i < newMask.length; i++) {
      if (newMask[i] > 0) {
        mergedMask[i] = 255;
        const idx = i * 4;
        const baseR = srcData[idx];
        const baseG = srcData[idx + 1];
        const baseB = srcData[idx + 2];
        const baseA = srcData[idx + 3];
        
        newImageData.data[idx] = Math.round(baseR + (tint.r - baseR) * mix);
        newImageData.data[idx + 1] = Math.round(baseG + (tint.g - baseG) * mix);
        newImageData.data[idx + 2] = Math.round(baseB + (tint.b - baseB) * mix);
        newImageData.data[idx + 3] = layer.segmentGlow ? baseA : Math.round(baseA * 0.9);
      }
    }
    
    return {
      imageData: newImageData,
      segmentMask: mergedMask,
      modifiedAt: Date.now(),
    };
  },

  /**
   * Create transparency modifier from segment mask
   */
  createTransparencyModifier(
    mask: Uint8ClampedArray,
    bounds: Rectangle,
    maskWidth: number,
    maskHeight: number
  ): {
    id: string;
    type: 'transparency-mask';
    enabled: boolean;
    opacity: number;
    parameters: {
      mask: Uint8ClampedArray;
      bounds: Rectangle;
      width: number;
      height: number;
      feather: number;
      invert: boolean;
    };
  } {
    return {
      id: crypto.randomUUID(),
      type: 'transparency-mask',
      enabled: true,
      opacity: 1,
      parameters: {
        mask: new Uint8ClampedArray(mask),
        bounds,
        width: maskWidth,
        height: maskHeight,
        feather: 0,
        invert: false,
      },
    };
  },

  /**
   * Apply transparency modifiers to layer ImageData
   */
  applyModifiersToImageData(layer: Layer): ImageData | null {
    if (!layer.imageData) return null;
    
    // Create copy of image data
    const result = new ImageData(
      new Uint8ClampedArray(layer.imageData.data),
      layer.imageData.width,
      layer.imageData.height
    );
    
    // Apply each transparency mask modifier
    for (const modifier of layer.modifiers) {
      if (modifier.type === 'transparency-mask' && modifier.enabled) {
        const params = modifier.parameters as {
          mask: Uint8ClampedArray;
          width: number;
          height: number;
        };
        
        const modOpacity = modifier.opacity;
        
        for (let i = 0; i < params.mask.length; i++) {
          if (params.mask[i] > 0) {
            const idx = i * 4;
            // Reduce alpha based on modifier opacity (0 = fully cut)
            result.data[idx + 3] = Math.round(result.data[idx + 3] * (1 - modOpacity));
          }
        }
      }
    }
    
    return result;
  },

  /**
   * Get colors of neighboring segments for contrast calculation
   */
  getNeighboringSegmentColors(layers: Layer[], bounds: Rectangle): string[] {
    const colors: string[] = [];
    
    for (const layer of layers) {
      if (layer.isSegmentLayer && layer.segmentColor && layer.segmentBounds) {
        // Check if bounds overlap or are adjacent
        const lb = layer.segmentBounds;
        const overlaps = !(
          bounds.x + bounds.width < lb.x - 10 ||
          bounds.x > lb.x + lb.width + 10 ||
          bounds.y + bounds.height < lb.y - 10 ||
          bounds.y > lb.y + lb.height + 10
        );
        
        if (overlaps) {
          colors.push(layer.segmentColor);
        }
      }
    }
    
    return colors;
  },
};

export function fillHolesInMask(mask: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const size = width * height;
  const filled = new Uint8ClampedArray(mask);
  const visited = new Uint8Array(size);
  const queue = new Int32Array(size);
  let head = 0;
  let tail = 0;

  const enqueue = (index: number) => {
    visited[index] = 1;
    queue[tail++] = index;
  };

  // Enqueue border pixels that are outside the selection
  for (let x = 0; x < width; x++) {
    const top = x;
    const bottom = (height - 1) * width + x;
    if (filled[top] === 0 && !visited[top]) enqueue(top);
    if (filled[bottom] === 0 && !visited[bottom]) enqueue(bottom);
  }
  for (let y = 0; y < height; y++) {
    const left = y * width;
    const right = y * width + (width - 1);
    if (filled[left] === 0 && !visited[left]) enqueue(left);
    if (filled[right] === 0 && !visited[right]) enqueue(right);
  }

  const offsets = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = (index / width) | 0;

    for (let i = 0; i < 4; i++) {
      const nx = x + offsets[i][0];
      const ny = y + offsets[i][1];
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nIndex = ny * width + nx;
      if (filled[nIndex] === 0 && !visited[nIndex]) {
        enqueue(nIndex);
      }
    }
  }

  // Any remaining zero pixels that were not reached are holes; fill them
  for (let i = 0; i < size; i++) {
    if (filled[i] === 0 && !visited[i]) {
      filled[i] = 255;
    }
  }

  return filled;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  // Handle HSL
  if (hex.startsWith('hsl')) {
    const match = hex.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (match) {
      const h = parseInt(match[1]) / 360;
      const s = parseInt(match[2]) / 100;
      const l = parseInt(match[3]) / 100;
      return hslToRgb(h, s, l);
    }
  }
  
  // Handle hex
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 78, g: 205, b: 196 }; // Default teal
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  let r, g, b;
  
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}
