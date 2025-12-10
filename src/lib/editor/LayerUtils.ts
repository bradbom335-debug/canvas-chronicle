// V3 Image Editor - Layer Utilities

import { Layer, Rectangle, createLayer, CANVAS_WIDTH, CANVAS_HEIGHT } from '@/types/editor';

/**
 * Layer Utilities - Functions for layer manipulation
 */
export const LayerUtils = {
  /**
   * Create layer from ImageData
   */
  createFromImageData(
    imageData: ImageData,
    bounds: Rectangle,
    name: string = 'New Layer'
  ): Layer {
    return createLayer({
      name,
      imageData,
      bounds,
    });
  },

  /**
   * Create layer from image file
   */
  async createFromFile(file: File): Promise<Layer> {
    const imageData = await loadImageFile(file);
    return createLayer({
      name: file.name.replace(/\.[^/.]+$/, ''),
      imageData,
      bounds: {
        x: 0,
        y: 0,
        width: imageData.width,
        height: imageData.height,
      },
    });
  },

  /**
   * Create layer from URL
   */
  async createFromURL(url: string, name: string = 'Image'): Promise<Layer> {
    const imageData = await loadImageURL(url);
    return createLayer({
      name,
      imageData,
      bounds: {
        x: 0,
        y: 0,
        width: imageData.width,
        height: imageData.height,
      },
    });
  },

  /**
   * Extract pixels with mask to create new layer
   */
  extractPixelsWithMask(
    sourceLayer: Layer,
    mask: Uint8ClampedArray,
    maskBounds: Rectangle,
    maskWidth: number
  ): Layer | null {
    if (!sourceLayer.imageData) return null;

    const { bounds, imageData: sourceData } = sourceLayer;
    
    // Find actual non-empty bounds within mask
    let minX = maskBounds.x + maskBounds.width;
    let maxX = maskBounds.x;
    let minY = maskBounds.y + maskBounds.height;
    let maxY = maskBounds.y;
    
    for (let y = maskBounds.y; y < maskBounds.y + maskBounds.height; y++) {
      for (let x = maskBounds.x; x < maskBounds.x + maskBounds.width; x++) {
        const maskIndex = y * maskWidth + x;
        if (mask[maskIndex] > 0) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    
    if (minX > maxX || minY > maxY) return null;
    
    const extractWidth = maxX - minX + 1;
    const extractHeight = maxY - minY + 1;
    
    // Create new ImageData
    const newImageData = new ImageData(extractWidth, extractHeight);
    
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const maskIndex = y * maskWidth + x;
        if (mask[maskIndex] > 0) {
          // Calculate source position (relative to layer bounds)
          const srcX = x - bounds.x;
          const srcY = y - bounds.y;
          
          // Check if within source layer
          if (srcX >= 0 && srcX < sourceData.width && srcY >= 0 && srcY < sourceData.height) {
            const srcIndex = (srcY * sourceData.width + srcX) * 4;
            const destX = x - minX;
            const destY = y - minY;
            const destIndex = (destY * extractWidth + destX) * 4;
            
            // Copy RGBA
            newImageData.data[destIndex] = sourceData.data[srcIndex];
            newImageData.data[destIndex + 1] = sourceData.data[srcIndex + 1];
            newImageData.data[destIndex + 2] = sourceData.data[srcIndex + 2];
            newImageData.data[destIndex + 3] = sourceData.data[srcIndex + 3];
          }
        }
      }
    }
    
    return createLayer({
      name: `${sourceLayer.name} (Extract)`,
      imageData: newImageData,
      bounds: {
        x: minX,
        y: minY,
        width: extractWidth,
        height: extractHeight,
      },
    });
  },

  /**
   * Composite all visible layers into single ImageData
   * Uses actual layer dimensions, not fixed canvas size
   */
  compositeLayers(layers: Layer[]): ImageData {
    // Find max dimensions from layers
    let maxWidth = 1920;
    let maxHeight = 1080;
    
    for (const layer of layers) {
      if (layer.imageData) {
        maxWidth = Math.max(maxWidth, layer.bounds.x + layer.imageData.width);
        maxHeight = Math.max(maxHeight, layer.bounds.y + layer.imageData.height);
      }
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = maxWidth;
    canvas.height = maxHeight;
    const ctx = canvas.getContext('2d')!;
    
    ctx.clearRect(0, 0, maxWidth, maxHeight);
    
    const visibleLayers = layers.filter(l => l.visible && l.imageData);
    
    for (const layer of visibleLayers) {
      if (!layer.imageData) continue;
      
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = getCompositeOperation(layer.blendMode);
      
      const { bounds, transform } = layer;
      ctx.translate(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      ctx.rotate(transform.rotation);
      ctx.scale(transform.sx, transform.sy);
      ctx.translate(-bounds.width / 2, -bounds.height / 2);
      
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = layer.imageData.width;
      tempCanvas.height = layer.imageData.height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.putImageData(layer.imageData, 0, 0);
      
      ctx.drawImage(tempCanvas, 0, 0);
      ctx.restore();
    }
    
    return ctx.getImageData(0, 0, maxWidth, maxHeight);
  },

  /**
   * Duplicate a layer
   */
  duplicate(layer: Layer): Layer {
    const newImageData = layer.imageData 
      ? new ImageData(
          new Uint8ClampedArray(layer.imageData.data),
          layer.imageData.width,
          layer.imageData.height
        )
      : null;
    
    return createLayer({
      ...layer,
      id: crypto.randomUUID(),
      name: `${layer.name} (Copy)`,
      imageData: newImageData,
      modifiers: layer.modifiers.map(m => ({ ...m, id: crypto.randomUUID() })),
    });
  },

  /**
   * Merge layers into one
   */
  mergeLayers(layers: Layer[]): Layer | null {
    if (layers.length === 0) return null;
    
    const composited = LayerUtils.compositeLayers(layers);
    
    // Find bounds
    let minX = CANVAS_WIDTH, maxX = 0;
    let minY = CANVAS_HEIGHT, maxY = 0;
    
    for (const layer of layers) {
      minX = Math.min(minX, layer.bounds.x);
      maxX = Math.max(maxX, layer.bounds.x + layer.bounds.width);
      minY = Math.min(minY, layer.bounds.y);
      maxY = Math.max(maxY, layer.bounds.y + layer.bounds.height);
    }
    
    return createLayer({
      name: 'Merged Layer',
      imageData: composited,
      bounds: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      },
    });
  },
};

// ============ IMAGE LOADING UTILITIES ============

export async function loadImageFile(file: File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0);
          resolve(ctx.getImageData(0, 0, img.width, img.height));
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      } catch (err) {
        reject(err);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function loadImageURL(url: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, img.width, img.height));
    };
    
    img.onerror = () => reject(new Error('Failed to load image from URL'));
    img.src = url;
  });
}

function getCompositeOperation(blendMode: string): GlobalCompositeOperation {
  const modeMap: Record<string, GlobalCompositeOperation> = {
    'normal': 'source-over',
    'multiply': 'multiply',
    'screen': 'screen',
    'overlay': 'overlay',
    'darken': 'darken',
    'lighten': 'lighten',
    'color-dodge': 'color-dodge',
    'color-burn': 'color-burn',
    'hard-light': 'hard-light',
    'soft-light': 'soft-light',
    'difference': 'difference',
    'exclusion': 'exclusion',
  };
  return modeMap[blendMode] || 'source-over';
}
