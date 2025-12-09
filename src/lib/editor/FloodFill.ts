// V3 Image Editor - Flood Fill Algorithm (Ring BFS)

import { Point, Rectangle, CANVAS_WIDTH, CANVAS_HEIGHT } from '@/types/editor';

interface FloodFillResult {
  mask: Uint8ClampedArray;
  bounds: Rectangle;
  pixels: number[];
  hitLimit: boolean;
  pixelCount: number;
}

interface FloodFillOptions {
  tolerance: number;
  contiguous: boolean;
  maxPixels?: number;
}

// Pixel states for 3-state tracking
const UNSEEN = 0;
const ACCEPTED = 1;
const REJECTED = 2;

/**
 * Ring BFS Flood Fill Algorithm
 * 
 * Key Features:
 * - Processes in concentric rings from seed point
 * - Memory efficient: O(perimeter) queue, not O(area)
 * - Supports time-budgeted execution
 * - 3-state tracking for breathing tolerance
 */
export class FloodFill {
  private imageData: ImageData;
  private width: number;
  private height: number;
  
  constructor(imageData: ImageData) {
    this.imageData = imageData;
    this.width = imageData.width;
    this.height = imageData.height;
  }

  /**
   * Execute flood fill from seed point
   */
  execute(seedPoint: Point, options: FloodFillOptions): FloodFillResult {
    const { tolerance, contiguous, maxPixels = Infinity } = options;
    
    const seedX = Math.floor(seedPoint.x);
    const seedY = Math.floor(seedPoint.y);
    
    // Validate seed point
    if (!this.isInBounds(seedX, seedY)) {
      return this.emptyResult();
    }
    
    // Get seed color
    const seedColor = this.getPixelColor(seedX, seedY);
    
    if (contiguous) {
      return this.floodFillContiguous(seedX, seedY, seedColor, tolerance, maxPixels);
    } else {
      return this.floodFillGlobal(seedColor, tolerance, maxPixels);
    }
  }

  /**
   * Contiguous flood fill using Ring BFS
   */
  private floodFillContiguous(
    seedX: number,
    seedY: number,
    seedColor: [number, number, number, number],
    tolerance: number,
    maxPixels: number
  ): FloodFillResult {
    const mask = new Uint8ClampedArray(this.width * this.height);
    const visited = new Uint8Array(this.width * this.height);
    const pixels: number[] = [];
    
    // Ring BFS queues
    let currentRing: number[] = [seedY * this.width + seedX];
    let nextRing: number[] = [];
    
    // Bounds tracking
    let minX = seedX, maxX = seedX;
    let minY = seedY, maxY = seedY;
    
    // 4-connectivity offsets
    const dx = [0, 1, 0, -1];
    const dy = [-1, 0, 1, 0];
    
    let hitLimit = false;
    
    // Process rings
    while (currentRing.length > 0 && pixels.length < maxPixels) {
      nextRing = [];
      
      for (const pixelIndex of currentRing) {
        if (pixels.length >= maxPixels) {
          hitLimit = true;
          break;
        }
        
        if (visited[pixelIndex] !== UNSEEN) continue;
        
        const x = pixelIndex % this.width;
        const y = Math.floor(pixelIndex / this.width);
        const color = this.getPixelColor(x, y);
        
        if (this.colorDistance(color, seedColor) <= tolerance) {
          // Accept pixel
          visited[pixelIndex] = ACCEPTED;
          mask[pixelIndex] = 255;
          pixels.push(pixelIndex);
          
          // Update bounds
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          
          // Add neighbors to next ring
          for (let i = 0; i < 4; i++) {
            const nx = x + dx[i];
            const ny = y + dy[i];
            
            if (this.isInBounds(nx, ny)) {
              const neighborIndex = ny * this.width + nx;
              if (visited[neighborIndex] === UNSEEN) {
                nextRing.push(neighborIndex);
              }
            }
          }
        } else {
          // Reject pixel
          visited[pixelIndex] = REJECTED;
        }
      }
      
      currentRing = nextRing;
    }
    
    return {
      mask,
      bounds: {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      },
      pixels,
      hitLimit,
      pixelCount: pixels.length,
    };
  }

  /**
   * Global (non-contiguous) flood fill
   */
  private floodFillGlobal(
    seedColor: [number, number, number, number],
    tolerance: number,
    maxPixels: number
  ): FloodFillResult {
    const mask = new Uint8ClampedArray(this.width * this.height);
    const pixels: number[] = [];
    
    let minX = this.width, maxX = 0;
    let minY = this.height, maxY = 0;
    let hitLimit = false;
    
    for (let y = 0; y < this.height && pixels.length < maxPixels; y++) {
      for (let x = 0; x < this.width && pixels.length < maxPixels; x++) {
        const color = this.getPixelColor(x, y);
        
        if (this.colorDistance(color, seedColor) <= tolerance) {
          const index = y * this.width + x;
          mask[index] = 255;
          pixels.push(index);
          
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    
    if (pixels.length >= maxPixels) hitLimit = true;
    
    return {
      mask,
      bounds: {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      },
      pixels,
      hitLimit,
      pixelCount: pixels.length,
    };
  }

  // ============ HELPER METHODS ============

  private isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  private getPixelColor(x: number, y: number): [number, number, number, number] {
    const index = (y * this.width + x) * 4;
    return [
      this.imageData.data[index],
      this.imageData.data[index + 1],
      this.imageData.data[index + 2],
      this.imageData.data[index + 3],
    ];
  }

  private colorDistance(
    c1: [number, number, number, number],
    c2: [number, number, number, number]
  ): number {
    // Euclidean distance in RGB space (ignoring alpha for selection)
    const dr = c1[0] - c2[0];
    const dg = c1[1] - c2[1];
    const db = c1[2] - c2[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  private emptyResult(): FloodFillResult {
    return {
      mask: new Uint8ClampedArray(this.width * this.height),
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      pixels: [],
      hitLimit: false,
      pixelCount: 0,
    };
  }
}

/**
 * Preview Wave Engine - Time-budgeted Ring BFS
 * Expands selection preview over multiple frames
 */
export class PreviewWaveEngine {
  private imageData: ImageData;
  private width: number;
  private height: number;
  private seedColor: [number, number, number, number] | null = null;
  private tolerance: number = 32;
  
  // Ring BFS state
  private currentRing: number[] = [];
  private nextRing: number[] = [];
  private visited: Uint8Array;
  private mask: Uint8ClampedArray;
  private rejectedFrontier: Set<number> = new Set();
  
  // Bounds
  private minX: number = 0;
  private maxX: number = 0;
  private minY: number = 0;
  private maxY: number = 0;
  
  // Status
  private isComplete: boolean = true;
  private pixelCount: number = 0;
  
  constructor(imageData: ImageData) {
    this.imageData = imageData;
    this.width = imageData.width;
    this.height = imageData.height;
    this.visited = new Uint8Array(this.width * this.height);
    this.mask = new Uint8ClampedArray(this.width * this.height);
  }

  /**
   * Start a new wave from seed point
   */
  startWave(seedX: number, seedY: number, tolerance: number): void {
    // Reset state
    this.visited.fill(0);
    this.mask.fill(0);
    this.rejectedFrontier.clear();
    
    this.tolerance = tolerance;
    this.seedColor = this.getPixelColor(seedX, seedY);
    
    const seedIndex = seedY * this.width + seedX;
    this.currentRing = [seedIndex];
    this.nextRing = [];
    
    this.minX = this.maxX = seedX;
    this.minY = this.maxY = seedY;
    
    this.isComplete = false;
    this.pixelCount = 0;
  }

  /**
   * Process one ring of expansion (call each frame)
   * Returns true if wave is complete
   */
  processRing(timeBudgetMs: number = 6): boolean {
    if (this.isComplete || !this.seedColor) return true;
    
    const startTime = performance.now();
    const dx = [0, 1, 0, -1];
    const dy = [-1, 0, 1, 0];
    
    this.nextRing = [];
    
    for (const pixelIndex of this.currentRing) {
      if (performance.now() - startTime > timeBudgetMs) {
        // Time budget exhausted, continue next frame
        this.currentRing = [...this.currentRing.slice(this.currentRing.indexOf(pixelIndex)), ...this.nextRing];
        return false;
      }
      
      if (this.visited[pixelIndex] !== UNSEEN) continue;
      
      const x = pixelIndex % this.width;
      const y = Math.floor(pixelIndex / this.width);
      const color = this.getPixelColor(x, y);
      
      if (this.colorDistance(color, this.seedColor) <= this.tolerance) {
        // Accept
        this.visited[pixelIndex] = ACCEPTED;
        this.mask[pixelIndex] = 255;
        this.pixelCount++;
        
        // Update bounds
        this.minX = Math.min(this.minX, x);
        this.maxX = Math.max(this.maxX, x);
        this.minY = Math.min(this.minY, y);
        this.maxY = Math.max(this.maxY, y);
        
        // Add neighbors
        for (let i = 0; i < 4; i++) {
          const nx = x + dx[i];
          const ny = y + dy[i];
          if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
            const neighborIndex = ny * this.width + nx;
            if (this.visited[neighborIndex] === UNSEEN) {
              this.nextRing.push(neighborIndex);
            }
          }
        }
      } else {
        // Reject but track for breathing tolerance
        this.visited[pixelIndex] = REJECTED;
        this.rejectedFrontier.add(pixelIndex);
      }
    }
    
    if (this.nextRing.length === 0) {
      this.isComplete = true;
      return true;
    }
    
    this.currentRing = this.nextRing;
    return false;
  }

  /**
   * Breathing tolerance - increase tolerance and re-expand
   */
  increaseTolerance(newTolerance: number): void {
    if (!this.seedColor) return;
    
    this.tolerance = newTolerance;
    
    // Re-test rejected frontier
    const newlyAccepted: number[] = [];
    
    for (const pixelIndex of this.rejectedFrontier) {
      const x = pixelIndex % this.width;
      const y = Math.floor(pixelIndex / this.width);
      const color = this.getPixelColor(x, y);
      
      if (this.colorDistance(color, this.seedColor) <= newTolerance) {
        newlyAccepted.push(pixelIndex);
        this.rejectedFrontier.delete(pixelIndex);
      }
    }
    
    if (newlyAccepted.length > 0) {
      // Add to expansion queue
      this.currentRing = [...this.currentRing, ...newlyAccepted];
      this.isComplete = false;
    }
  }

  /**
   * Get current mask state
   */
  getMask(): Uint8ClampedArray {
    return this.mask;
  }

  getBounds(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.minX,
      y: this.minY,
      width: this.maxX - this.minX + 1,
      height: this.maxY - this.minY + 1,
    };
  }

  getIsComplete(): boolean {
    return this.isComplete;
  }

  getPixelCount(): number {
    return this.pixelCount;
  }

  // ============ HELPERS ============

  private getPixelColor(x: number, y: number): [number, number, number, number] {
    const index = (y * this.width + x) * 4;
    return [
      this.imageData.data[index],
      this.imageData.data[index + 1],
      this.imageData.data[index + 2],
      this.imageData.data[index + 3],
    ];
  }

  private colorDistance(
    c1: [number, number, number, number],
    c2: [number, number, number, number]
  ): number {
    const dr = c1[0] - c2[0];
    const dg = c1[1] - c2[1];
    const db = c1[2] - c2[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }
}
