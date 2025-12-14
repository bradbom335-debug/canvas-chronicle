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
    withGlow: boolean = false
  ): Layer {
    const segmentColor = getContrastingColor(existingSegmentColors);
    
    // Create ImageData with colored fill
    const imageData = new ImageData(maskWidth, maskHeight);
    const color = hexToRgb(segmentColor);
    
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] > 0) {
        const idx = i * 4;
        imageData.data[idx] = color.r;
        imageData.data[idx + 1] = color.g;
        imageData.data[idx + 2] = color.b;
        imageData.data[idx + 3] = withGlow ? 180 : 100; // Semi-transparent fill
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
   * Add segment to existing layer (merge overlaps)
   */
  mergeSegmentIntoLayer(
    layer: Layer,
    newMask: Uint8ClampedArray,
    maskWidth: number,
    maskHeight: number
  ): Layer {
    if (!layer.segmentMask || !layer.imageData) return layer;
    
    const mergedMask = new Uint8ClampedArray(layer.segmentMask);
    const color = hexToRgb(layer.segmentColor || '#4ecdc4');
    const opacity = layer.segmentGlow ? 180 : 100;
    
    // Create new image data
    const newImageData = new ImageData(
      new Uint8ClampedArray(layer.imageData.data),
      layer.imageData.width,
      layer.imageData.height
    );
    
    for (let i = 0; i < newMask.length; i++) {
      if (newMask[i] > 0) {
        mergedMask[i] = 255; // Merge into mask
        const idx = i * 4;
        newImageData.data[idx] = color.r;
        newImageData.data[idx + 1] = color.g;
        newImageData.data[idx + 2] = color.b;
        newImageData.data[idx + 3] = opacity;
      }
    }
    
    return {
      ...layer,
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
