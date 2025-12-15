// Advanced Edge Detection Engine
// Supports: Sobel, Prewitt, Scharr, Roberts Cross, Laplacian of Gaussian, Canny

import { Point } from '@/types/editor';

export interface EdgeMap {
  magnitude: Float32Array;
  direction: Float32Array;
  width: number;
  height: number;
}

export interface EdgeDetectionOptions {
  method: 'sobel' | 'prewitt' | 'scharr' | 'roberts' | 'log' | 'canny';
  sensitivity: number;       // 0-100
  threshold: number;         // 0-255
  hysteresisLow: number;     // For Canny
  hysteresisHigh: number;    // For Canny
  gaussianBlur: boolean;
  blurRadius: number;
  nonMaxSuppression: boolean;
  adaptiveEdge: boolean;
}

export const DEFAULT_EDGE_OPTIONS: EdgeDetectionOptions = {
  method: 'sobel',
  sensitivity: 50,
  threshold: 30,
  hysteresisLow: 20,
  hysteresisHigh: 80,
  gaussianBlur: true,
  blurRadius: 1.4,
  nonMaxSuppression: true,
  adaptiveEdge: false,
};

// Kernels for different edge detection methods
const SOBEL_X = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
const SOBEL_Y = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

const PREWITT_X = [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]];
const PREWITT_Y = [[-1, -1, -1], [0, 0, 0], [1, 1, 1]];

const SCHARR_X = [[-3, 0, 3], [-10, 0, 10], [-3, 0, 3]];
const SCHARR_Y = [[-3, -10, -3], [0, 0, 0], [3, 10, 3]];

const ROBERTS_X = [[1, 0], [0, -1]];
const ROBERTS_Y = [[0, 1], [-1, 0]];

const LAPLACIAN = [[0, 1, 0], [1, -4, 1], [0, 1, 0]];

export class EdgeDetectionEngine {
  private imageData: ImageData;
  private grayscale: Float32Array;
  private width: number;
  private height: number;
  private edgeMap: EdgeMap | null = null;
  private options: EdgeDetectionOptions;

  constructor(imageData: ImageData, options: Partial<EdgeDetectionOptions> = {}) {
    this.imageData = imageData;
    this.width = imageData.width;
    this.height = imageData.height;
    this.options = { ...DEFAULT_EDGE_OPTIONS, ...options };
    this.grayscale = this.convertToGrayscale();
  }

  private convertToGrayscale(): Float32Array {
    const { data, width, height } = this.imageData;
    const gray = new Float32Array(width * height);
    
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      // Luminosity method for better perception
      gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }
    
    return gray;
  }

  private gaussianBlur(input: Float32Array, sigma: number): Float32Array {
    const kernelSize = Math.ceil(sigma * 3) * 2 + 1;
    const kernel = this.createGaussianKernel(kernelSize, sigma);
    const temp = new Float32Array(this.width * this.height);
    const output = new Float32Array(this.width * this.height);
    const halfSize = Math.floor(kernelSize / 2);

    // Horizontal pass
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        let sum = 0;
        let weight = 0;
        for (let k = -halfSize; k <= halfSize; k++) {
          const px = Math.min(Math.max(x + k, 0), this.width - 1);
          const kernelValue = kernel[k + halfSize];
          sum += input[y * this.width + px] * kernelValue;
          weight += kernelValue;
        }
        temp[y * this.width + x] = sum / weight;
      }
    }

    // Vertical pass
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        let sum = 0;
        let weight = 0;
        for (let k = -halfSize; k <= halfSize; k++) {
          const py = Math.min(Math.max(y + k, 0), this.height - 1);
          const kernelValue = kernel[k + halfSize];
          sum += temp[py * this.width + x] * kernelValue;
          weight += kernelValue;
        }
        output[y * this.width + x] = sum / weight;
      }
    }

    return output;
  }

  private createGaussianKernel(size: number, sigma: number): Float32Array {
    const kernel = new Float32Array(size);
    const center = Math.floor(size / 2);
    let sum = 0;

    for (let i = 0; i < size; i++) {
      const x = i - center;
      kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
      sum += kernel[i];
    }

    // Normalize
    for (let i = 0; i < size; i++) {
      kernel[i] /= sum;
    }

    return kernel;
  }

  private convolve2D(input: Float32Array, kernelX: number[][], kernelY: number[][]): { gx: Float32Array; gy: Float32Array } {
    const gx = new Float32Array(this.width * this.height);
    const gy = new Float32Array(this.width * this.height);
    const kSize = kernelX.length;
    const half = Math.floor(kSize / 2);

    for (let y = half; y < this.height - half; y++) {
      for (let x = half; x < this.width - half; x++) {
        let sumX = 0;
        let sumY = 0;
        
        for (let ky = 0; ky < kSize; ky++) {
          for (let kx = 0; kx < kSize; kx++) {
            const px = x + kx - half;
            const py = y + ky - half;
            const value = input[py * this.width + px];
            sumX += value * kernelX[ky][kx];
            sumY += value * kernelY[ky][kx];
          }
        }
        
        const idx = y * this.width + x;
        gx[idx] = sumX;
        gy[idx] = sumY;
      }
    }

    return { gx, gy };
  }

  private convolve2DRoberts(input: Float32Array): { gx: Float32Array; gy: Float32Array } {
    const gx = new Float32Array(this.width * this.height);
    const gy = new Float32Array(this.width * this.height);

    for (let y = 0; y < this.height - 1; y++) {
      for (let x = 0; x < this.width - 1; x++) {
        const idx = y * this.width + x;
        const i00 = input[idx];
        const i01 = input[idx + 1];
        const i10 = input[(y + 1) * this.width + x];
        const i11 = input[(y + 1) * this.width + x + 1];
        
        gx[idx] = i00 - i11;
        gy[idx] = i01 - i10;
      }
    }

    return { gx, gy };
  }

  private computeMagnitudeAndDirection(gx: Float32Array, gy: Float32Array): EdgeMap {
    const magnitude = new Float32Array(this.width * this.height);
    const direction = new Float32Array(this.width * this.height);
    
    const sensitivity = this.options.sensitivity / 50; // Normalize to 0-2 range
    
    for (let i = 0; i < this.width * this.height; i++) {
      magnitude[i] = Math.sqrt(gx[i] * gx[i] + gy[i] * gy[i]) * sensitivity;
      direction[i] = Math.atan2(gy[i], gx[i]);
    }

    return { magnitude, direction, width: this.width, height: this.height };
  }

  private nonMaximumSuppression(edgeMap: EdgeMap): EdgeMap {
    const { magnitude, direction, width, height } = edgeMap;
    const suppressed = new Float32Array(width * height);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const angle = direction[idx];
        const mag = magnitude[idx];
        
        // Round angle to nearest 45 degrees
        let neighbor1: number, neighbor2: number;
        
        const angleNorm = ((angle * 180 / Math.PI) + 180) % 180;
        
        if (angleNorm < 22.5 || angleNorm >= 157.5) {
          // Horizontal edge
          neighbor1 = magnitude[idx - 1];
          neighbor2 = magnitude[idx + 1];
        } else if (angleNorm >= 22.5 && angleNorm < 67.5) {
          // Diagonal /
          neighbor1 = magnitude[(y - 1) * width + x + 1];
          neighbor2 = magnitude[(y + 1) * width + x - 1];
        } else if (angleNorm >= 67.5 && angleNorm < 112.5) {
          // Vertical edge
          neighbor1 = magnitude[(y - 1) * width + x];
          neighbor2 = magnitude[(y + 1) * width + x];
        } else {
          // Diagonal \
          neighbor1 = magnitude[(y - 1) * width + x - 1];
          neighbor2 = magnitude[(y + 1) * width + x + 1];
        }
        
        suppressed[idx] = (mag >= neighbor1 && mag >= neighbor2) ? mag : 0;
      }
    }

    return { magnitude: suppressed, direction, width, height };
  }

  private doubleThreshold(edgeMap: EdgeMap): EdgeMap {
    const { magnitude, direction, width, height } = edgeMap;
    const thresholded = new Float32Array(width * height);
    
    const lowThreshold = this.options.hysteresisLow;
    const highThreshold = this.options.hysteresisHigh;
    
    for (let i = 0; i < width * height; i++) {
      if (magnitude[i] >= highThreshold) {
        thresholded[i] = 255; // Strong edge
      } else if (magnitude[i] >= lowThreshold) {
        thresholded[i] = 128; // Weak edge
      } else {
        thresholded[i] = 0;   // Non-edge
      }
    }

    return { magnitude: thresholded, direction, width, height };
  }

  private hysteresisTracking(edgeMap: EdgeMap): EdgeMap {
    const { magnitude, direction, width, height } = edgeMap;
    const result = new Float32Array(magnitude);
    
    // Connect weak edges to strong edges
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (result[idx] === 128) { // Weak edge
          // Check 8 neighbors for strong edge
          let hasStrongNeighbor = false;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nIdx = (y + dy) * width + (x + dx);
              if (result[nIdx] === 255) {
                hasStrongNeighbor = true;
                break;
              }
            }
            if (hasStrongNeighbor) break;
          }
          result[idx] = hasStrongNeighbor ? 255 : 0;
        }
      }
    }

    return { magnitude: result, direction, width, height };
  }

  private laplacianOfGaussian(): EdgeMap {
    const blurred = this.options.gaussianBlur 
      ? this.gaussianBlur(this.grayscale, this.options.blurRadius)
      : this.grayscale;
    
    const magnitude = new Float32Array(this.width * this.height);
    const direction = new Float32Array(this.width * this.height);
    
    // Apply Laplacian
    for (let y = 1; y < this.height - 1; y++) {
      for (let x = 1; x < this.width - 1; x++) {
        const idx = y * this.width + x;
        let sum = 0;
        
        for (let ky = 0; ky < 3; ky++) {
          for (let kx = 0; kx < 3; kx++) {
            const px = x + kx - 1;
            const py = y + ky - 1;
            sum += blurred[py * this.width + px] * LAPLACIAN[ky][kx];
          }
        }
        
        magnitude[idx] = Math.abs(sum) * (this.options.sensitivity / 50);
        direction[idx] = 0; // LoG doesn't produce direction
      }
    }

    return { magnitude, direction, width: this.width, height: this.height };
  }

  compute(): EdgeMap {
    let input = this.grayscale;
    
    // Apply Gaussian blur if enabled
    if (this.options.gaussianBlur && this.options.method !== 'log') {
      input = this.gaussianBlur(input, this.options.blurRadius);
    }

    let edgeMap: EdgeMap;

    switch (this.options.method) {
      case 'sobel': {
        const { gx, gy } = this.convolve2D(input, SOBEL_X, SOBEL_Y);
        edgeMap = this.computeMagnitudeAndDirection(gx, gy);
        break;
      }
      case 'prewitt': {
        const { gx, gy } = this.convolve2D(input, PREWITT_X, PREWITT_Y);
        edgeMap = this.computeMagnitudeAndDirection(gx, gy);
        break;
      }
      case 'scharr': {
        const { gx, gy } = this.convolve2D(input, SCHARR_X, SCHARR_Y);
        edgeMap = this.computeMagnitudeAndDirection(gx, gy);
        break;
      }
      case 'roberts': {
        const { gx, gy } = this.convolve2DRoberts(input);
        edgeMap = this.computeMagnitudeAndDirection(gx, gy);
        break;
      }
      case 'log': {
        edgeMap = this.laplacianOfGaussian();
        break;
      }
      case 'canny': {
        const { gx, gy } = this.convolve2D(input, SOBEL_X, SOBEL_Y);
        edgeMap = this.computeMagnitudeAndDirection(gx, gy);
        if (this.options.nonMaxSuppression) {
          edgeMap = this.nonMaximumSuppression(edgeMap);
        }
        edgeMap = this.doubleThreshold(edgeMap);
        edgeMap = this.hysteresisTracking(edgeMap);
        break;
      }
      default:
        throw new Error(`Unknown edge detection method: ${this.options.method}`);
    }

    // Apply non-maximum suppression if enabled (for non-Canny methods)
    if (this.options.nonMaxSuppression && this.options.method !== 'canny') {
      edgeMap = this.nonMaximumSuppression(edgeMap);
    }

    this.edgeMap = edgeMap;
    return edgeMap;
  }

  getEdgeStrength(x: number, y: number): number {
    if (!this.edgeMap) return 0;
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
    return this.edgeMap.magnitude[Math.floor(y) * this.width + Math.floor(x)];
  }

  getEdgeDirection(x: number, y: number): number {
    if (!this.edgeMap) return 0;
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
    return this.edgeMap.direction[Math.floor(y) * this.width + Math.floor(x)];
  }

  getEdgeCost(x: number, y: number, maxStrength: number = 255): number {
    // Higher edge strength = lower cost (we want to follow edges)
    const strength = this.getEdgeStrength(x, y);
    return maxStrength - Math.min(strength, maxStrength);
  }

  getLocalEdgeQuality(x: number, y: number, radius: number = 3): number {
    if (!this.edgeMap) return 0;
    
    let sum = 0;
    let count = 0;
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const px = Math.floor(x) + dx;
        const py = Math.floor(y) + dy;
        if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
          sum += this.edgeMap.magnitude[py * this.width + px];
          count++;
        }
      }
    }
    
    return count > 0 ? sum / count : 0;
  }

  // Adaptive edge detection based on local image properties
  getAdaptiveThreshold(x: number, y: number, windowSize: number = 15): number {
    const halfWindow = Math.floor(windowSize / 2);
    let sum = 0;
    let sumSq = 0;
    let count = 0;

    for (let dy = -halfWindow; dy <= halfWindow; dy++) {
      for (let dx = -halfWindow; dx <= halfWindow; dx++) {
        const px = Math.floor(x) + dx;
        const py = Math.floor(y) + dy;
        if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
          const val = this.grayscale[py * this.width + px];
          sum += val;
          sumSq += val * val;
          count++;
        }
      }
    }

    if (count === 0) return this.options.threshold;

    const mean = sum / count;
    const variance = (sumSq / count) - (mean * mean);
    const stdDev = Math.sqrt(Math.max(0, variance));
    
    // Higher contrast areas get lower threshold (more sensitive)
    return Math.max(10, this.options.threshold - stdDev * 0.5);
  }

  getEdgeMap(): EdgeMap | null {
    return this.edgeMap;
  }

  updateOptions(options: Partial<EdgeDetectionOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

// Utility function to create edge map visualization
export function visualizeEdgeMap(edgeMap: EdgeMap): ImageData {
  const { magnitude, width, height } = edgeMap;
  const imageData = new ImageData(width, height);
  
  // Find max for normalization
  let max = 0;
  for (let i = 0; i < magnitude.length; i++) {
    if (magnitude[i] > max) max = magnitude[i];
  }
  
  for (let i = 0; i < magnitude.length; i++) {
    const value = max > 0 ? Math.floor((magnitude[i] / max) * 255) : 0;
    const idx = i * 4;
    imageData.data[idx] = value;
    imageData.data[idx + 1] = value;
    imageData.data[idx + 2] = value;
    imageData.data[idx + 3] = 255;
  }
  
  return imageData;
}
