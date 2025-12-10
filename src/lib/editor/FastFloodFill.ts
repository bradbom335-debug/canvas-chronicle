// V3 Image Editor - Ultra-Fast Flood Fill with Differential Preview
// Features: Instant, expanding, circular expansion, differential updates

import { Point } from '@/types/editor';

export interface FastFloodFillOptions {
  tolerance: number;
  contiguous: boolean;
  connectivity: 4 | 8;
  colorSpace: 'rgb' | 'hsl' | 'lab';
  includeAlpha: boolean;
  batchSize: number;
  maxPixels: number;
  expansionShape: 'square' | 'circular' | 'diamond';
}

export interface FloodFillState {
  mask: Uint8ClampedArray;
  visited: Uint8Array;
  queue: Int32Array;
  queueStart: number;
  queueEnd: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  pixelCount: number;
  isComplete: boolean;
  seedColor: Uint8ClampedArray;
  seedX: number;
  seedY: number;
  currentRing: number;
}

// Pixel states
const UNSEEN = 0;
const QUEUED = 1;
const ACCEPTED = 2;
const REJECTED = 3;

/**
 * Ultra-fast flood fill using typed arrays and batch processing
 * Supports circular expansion and differential preview updates
 */
export class FastFloodFill {
  private imageData: ImageData;
  private width: number;
  private height: number;
  private data: Uint8ClampedArray;
  
  private state: FloodFillState | null = null;
  private options: FastFloodFillOptions;
  
  // Offset tables for connectivity
  private dx4 = new Int8Array([0, 1, 0, -1]);
  private dy4 = new Int8Array([-1, 0, 1, 0]);
  private dx8 = new Int8Array([0, 1, 1, 1, 0, -1, -1, -1]);
  private dy8 = new Int8Array([-1, -1, 0, 1, 1, 1, 0, -1]);

  constructor(imageData: ImageData) {
    this.imageData = imageData;
    this.width = imageData.width;
    this.height = imageData.height;
    this.data = imageData.data;
    this.options = {
      tolerance: 32,
      contiguous: true,
      connectivity: 4,
      colorSpace: 'rgb',
      includeAlpha: false,
      batchSize: 10000,
      maxPixels: 2000000,
      expansionShape: 'circular',
    };
  }

  /**
   * Initialize flood fill from seed point
   */
  initialize(seedX: number, seedY: number, options: Partial<FastFloodFillOptions> = {}): void {
    this.options = { ...this.options, ...options };
    
    // Clamp seed to bounds
    seedX = Math.max(0, Math.min(this.width - 1, Math.floor(seedX)));
    seedY = Math.max(0, Math.min(this.height - 1, Math.floor(seedY)));
    
    const size = this.width * this.height;
    const seedIndex = seedY * this.width + seedX;
    
    // Get seed color
    const colorIndex = seedIndex * 4;
    const seedColor = new Uint8ClampedArray(4);
    seedColor[0] = this.data[colorIndex];
    seedColor[1] = this.data[colorIndex + 1];
    seedColor[2] = this.data[colorIndex + 2];
    seedColor[3] = this.data[colorIndex + 3];
    
    // Allocate state
    this.state = {
      mask: new Uint8ClampedArray(size),
      visited: new Uint8Array(size),
      queue: new Int32Array(Math.min(size, this.options.maxPixels * 2)),
      queueStart: 0,
      queueEnd: 1,
      minX: seedX,
      maxX: seedX,
      minY: seedY,
      maxY: seedY,
      pixelCount: 0,
      isComplete: false,
      seedColor,
      seedX,
      seedY,
      currentRing: 0,
    };
    
    // Add seed to queue
    this.state.queue[0] = seedIndex;
    this.state.visited[seedIndex] = QUEUED;
  }

  /**
   * Process a batch of pixels with optional circular expansion
   */
  processBatch(batchSize?: number): boolean {
    if (!this.state || this.state.isComplete) return true;
    
    const batch = batchSize ?? this.options.batchSize;
    const { tolerance, connectivity, maxPixels, expansionShape } = this.options;
    const { mask, visited, queue, seedColor, seedX, seedY } = this.state;
    
    const dx = connectivity === 8 ? this.dx8 : this.dx4;
    const dy = connectivity === 8 ? this.dy8 : this.dy4;
    const neighborCount = connectivity;
    
    let processed = 0;
    
    while (this.state.queueStart < this.state.queueEnd && processed < batch) {
      if (this.state.pixelCount >= maxPixels) {
        this.state.isComplete = true;
        return true;
      }
      
      const pixelIndex = queue[this.state.queueStart++];
      
      if (visited[pixelIndex] >= ACCEPTED) continue;
      
      const x = pixelIndex % this.width;
      const y = (pixelIndex / this.width) | 0;
      
      // For circular expansion, check distance from seed
      if (expansionShape === 'circular') {
        const dx_seed = x - seedX;
        const dy_seed = y - seedY;
        const distSq = dx_seed * dx_seed + dy_seed * dy_seed;
        const maxRing = this.state.currentRing + 50; // Process within current ring band
        if (distSq > maxRing * maxRing && this.state.pixelCount > 100) {
          // Re-queue for later processing
          if (this.state.queueEnd < queue.length) {
            queue[this.state.queueEnd++] = pixelIndex;
          }
          processed++;
          continue;
        }
      } else if (expansionShape === 'diamond') {
        const dist = Math.abs(x - seedX) + Math.abs(y - seedY);
        const maxRing = this.state.currentRing + 50;
        if (dist > maxRing && this.state.pixelCount > 100) {
          if (this.state.queueEnd < queue.length) {
            queue[this.state.queueEnd++] = pixelIndex;
          }
          processed++;
          continue;
        }
      }
      
      // Check color similarity
      const colorIndex = pixelIndex * 4;
      const dist = this.colorDistanceFast(
        this.data[colorIndex],
        this.data[colorIndex + 1],
        this.data[colorIndex + 2],
        seedColor[0],
        seedColor[1],
        seedColor[2]
      );
      
      if (dist <= tolerance) {
        visited[pixelIndex] = ACCEPTED;
        mask[pixelIndex] = 255;
        this.state.pixelCount++;
        processed++;
        
        // Update bounds
        if (x < this.state.minX) this.state.minX = x;
        if (x > this.state.maxX) this.state.maxX = x;
        if (y < this.state.minY) this.state.minY = y;
        if (y > this.state.maxY) this.state.maxY = y;
        
        // Add neighbors to queue
        for (let i = 0; i < neighborCount; i++) {
          const nx = x + dx[i];
          const ny = y + dy[i];
          
          if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
            const neighborIndex = ny * this.width + nx;
            if (visited[neighborIndex] === UNSEEN) {
              visited[neighborIndex] = QUEUED;
              if (this.state.queueEnd < queue.length) {
                queue[this.state.queueEnd++] = neighborIndex;
              }
            }
          }
        }
      } else {
        visited[pixelIndex] = REJECTED;
        processed++;
      }
    }
    
    // Expand ring for circular/diamond expansion
    this.state.currentRing += 10;
    
    if (this.state.queueStart >= this.state.queueEnd) {
      this.state.isComplete = true;
    }
    
    return this.state.isComplete;
  }

  /**
   * Process entire fill instantly (blocking)
   */
  executeInstant(): void {
    if (!this.state) return;
    // For instant mode, use square expansion (fastest)
    const originalShape = this.options.expansionShape;
    this.options.expansionShape = 'square';
    while (!this.processBatch(100000)) {}
    this.options.expansionShape = originalShape;
  }

  /**
   * Fast color distance using squared Euclidean
   */
  private colorDistanceFast(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  getMask(): Uint8ClampedArray | null {
    return this.state?.mask || null;
  }

  getBounds(): { x: number; y: number; width: number; height: number } {
    if (!this.state) return { x: 0, y: 0, width: 0, height: 0 };
    return {
      x: this.state.minX,
      y: this.state.minY,
      width: this.state.maxX - this.state.minX + 1,
      height: this.state.maxY - this.state.minY + 1,
    };
  }

  getPixelCount(): number {
    return this.state?.pixelCount || 0;
  }

  isComplete(): boolean {
    return this.state?.isComplete || false;
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }
}

/**
 * Instant flood fill - maximum speed, non-animated
 */
export function instantFloodFill(
  imageData: ImageData,
  seedX: number,
  seedY: number,
  options: Partial<FastFloodFillOptions> = {}
): { mask: Uint8ClampedArray; bounds: { x: number; y: number; width: number; height: number }; pixelCount: number; width: number; height: number } {
  const fill = new FastFloodFill(imageData);
  fill.initialize(seedX, seedY, { ...options, batchSize: 200000 });
  fill.executeInstant();
  
  return {
    mask: fill.getMask()!,
    bounds: fill.getBounds(),
    pixelCount: fill.getPixelCount(),
    width: fill.getWidth(),
    height: fill.getHeight(),
  };
}

/**
 * Global (non-contiguous) color selection
 */
export function globalColorSelect(
  imageData: ImageData,
  seedX: number,
  seedY: number,
  tolerance: number
): { mask: Uint8ClampedArray; pixelCount: number; width: number; height: number } {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const size = width * height;
  
  const mask = new Uint8ClampedArray(size);
  
  seedX = Math.max(0, Math.min(width - 1, Math.floor(seedX)));
  seedY = Math.max(0, Math.min(height - 1, Math.floor(seedY)));
  
  const seedIndex = (seedY * width + seedX) * 4;
  const sr = data[seedIndex];
  const sg = data[seedIndex + 1];
  const sb = data[seedIndex + 2];
  
  let pixelCount = 0;
  
  // Scan entire image
  for (let i = 0; i < size; i++) {
    const ci = i * 4;
    const dr = data[ci] - sr;
    const dg = data[ci + 1] - sg;
    const db = data[ci + 2] - sb;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    
    if (dist <= tolerance) {
      mask[i] = 255;
      pixelCount++;
    }
  }
  
  return { mask, pixelCount, width, height };
}

/**
 * Differential Preview Manager - maintains state between hovers for smooth transitions
 */
export class DifferentialPreview {
  private previousMask: Uint8ClampedArray | null = null;
  private previousWidth: number = 0;
  private previousHeight: number = 0;
  private displayMask: Uint8ClampedArray | null = null;
  
  /**
   * Update with new mask, returning only the changed pixels
   * Returns the full display mask for rendering
   */
  update(
    newMask: Uint8ClampedArray,
    width: number,
    height: number
  ): { displayMask: Uint8ClampedArray; addedPixels: number; removedPixels: number } {
    const size = width * height;
    
    // First time or size changed - just use new mask
    if (!this.previousMask || this.previousWidth !== width || this.previousHeight !== height) {
      this.displayMask = new Uint8ClampedArray(newMask);
      this.previousMask = new Uint8ClampedArray(newMask);
      this.previousWidth = width;
      this.previousHeight = height;
      
      let count = 0;
      for (let i = 0; i < size; i++) {
        if (newMask[i] > 0) count++;
      }
      
      return { displayMask: this.displayMask, addedPixels: count, removedPixels: 0 };
    }
    
    // Differential update - smooth blend
    if (!this.displayMask) {
      this.displayMask = new Uint8ClampedArray(size);
    }
    
    let addedPixels = 0;
    let removedPixels = 0;
    
    for (let i = 0; i < size; i++) {
      const wasSelected = this.previousMask[i] > 0;
      const isSelected = newMask[i] > 0;
      
      if (isSelected && !wasSelected) {
        // Newly selected - fade in
        this.displayMask[i] = 255;
        addedPixels++;
      } else if (!isSelected && wasSelected) {
        // No longer selected - keep fading out (smooth)
        this.displayMask[i] = Math.max(0, this.displayMask[i] - 60);
        if (this.displayMask[i] === 0) removedPixels++;
      } else if (isSelected) {
        // Still selected - ensure full opacity
        this.displayMask[i] = 255;
      } else {
        // Continue fading out old pixels
        if (this.displayMask[i] > 0) {
          this.displayMask[i] = Math.max(0, this.displayMask[i] - 60);
        }
      }
    }
    
    // Store current as previous for next frame
    this.previousMask.set(newMask);
    
    return { displayMask: this.displayMask, addedPixels, removedPixels };
  }
  
  /**
   * Clear all preview state
   */
  clear(): void {
    this.previousMask = null;
    this.displayMask = null;
  }
  
  /**
   * Get current display mask
   */
  getDisplayMask(): Uint8ClampedArray | null {
    return this.displayMask;
  }
}
