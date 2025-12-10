// V3 Image Editor - Ultra-Fast Flood Fill with Instant Preview
// Optimized for maximum speed with batch processing

import { Point, CANVAS_WIDTH, CANVAS_HEIGHT } from '@/types/editor';

export interface FastFloodFillOptions {
  tolerance: number;
  contiguous: boolean;
  connectivity: 4 | 8;
  colorSpace: 'rgb' | 'hsl' | 'lab';
  includeAlpha: boolean;
  batchSize: number;
  maxPixels: number;
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
}

// Pixel states
const UNSEEN = 0;
const QUEUED = 1;
const ACCEPTED = 2;
const REJECTED = 3;

/**
 * Ultra-fast flood fill using typed arrays and batch processing
 * Processes thousands of pixels per frame
 */
export class FastFloodFill {
  private imageData: ImageData;
  private width: number;
  private height: number;
  private data: Uint8ClampedArray;
  
  // Pre-allocated buffers for performance
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
      maxPixels: 500000,
    };
  }

  /**
   * Initialize flood fill from seed point
   */
  initialize(seedX: number, seedY: number, options: Partial<FastFloodFillOptions> = {}): void {
    this.options = { ...this.options, ...options };
    
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
    };
    
    // Add seed to queue
    this.state.queue[0] = seedIndex;
    this.state.visited[seedIndex] = QUEUED;
  }

  /**
   * Process a batch of pixels - call this each frame
   * Returns true when complete
   */
  processBatch(batchSize?: number): boolean {
    if (!this.state || this.state.isComplete) return true;
    
    const batch = batchSize ?? this.options.batchSize;
    const { tolerance, connectivity, maxPixels } = this.options;
    const { mask, visited, queue, seedColor } = this.state;
    
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
      
      // Skip if already processed
      if (visited[pixelIndex] >= ACCEPTED) continue;
      
      const x = pixelIndex % this.width;
      const y = (pixelIndex / this.width) | 0;
      
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
        // Accept pixel
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
              queue[this.state.queueEnd++] = neighborIndex;
            }
          }
        }
      } else {
        visited[pixelIndex] = REJECTED;
        processed++;
      }
    }
    
    // Check if complete
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
    while (!this.processBatch(50000)) {}
  }

  /**
   * Fast color distance using squared Euclidean (no sqrt for speed)
   */
  private colorDistanceFast(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    // Return sqrt for proper comparison with tolerance
    // Use fast approximation
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  // ============ GETTERS ============

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

  getProgress(): number {
    if (!this.state) return 0;
    if (this.state.isComplete) return 1;
    const totalQueued = this.state.queueEnd;
    const processed = this.state.queueStart;
    return totalQueued > 0 ? processed / totalQueued : 0;
  }
}

/**
 * Instant flood fill - non-animated, maximum speed
 */
export function instantFloodFill(
  imageData: ImageData,
  seedX: number,
  seedY: number,
  options: Partial<FastFloodFillOptions> = {}
): { mask: Uint8ClampedArray; bounds: { x: number; y: number; width: number; height: number }; pixelCount: number } {
  const fill = new FastFloodFill(imageData);
  fill.initialize(seedX, seedY, { ...options, batchSize: 100000 });
  fill.executeInstant();
  
  return {
    mask: fill.getMask()!,
    bounds: fill.getBounds(),
    pixelCount: fill.getPixelCount(),
  };
}

/**
 * Global (non-contiguous) color selection - extremely fast
 */
export function globalColorSelect(
  imageData: ImageData,
  seedX: number,
  seedY: number,
  tolerance: number
): { mask: Uint8ClampedArray; pixelCount: number } {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const size = width * height;
  
  const mask = new Uint8ClampedArray(size);
  
  // Get seed color
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
  
  return { mask, pixelCount };
}
