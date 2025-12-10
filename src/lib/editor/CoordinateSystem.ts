// V3 Image Editor - Coordinate System (Single Source of Truth)
// DYNAMIC: Supports any image size, not fixed canvas dimensions

import { Point, MIN_ZOOM, MAX_ZOOM } from '@/types/editor';

/**
 * CoordinateSystem - Manages all coordinate transformations
 * 
 * Coordinate Spaces:
 * - Screen: CSS pixels relative to browser window
 * - Canvas: Physical pixels on the canvas element (with DPR scaling)
 * - World: Logical coordinates in the scene (0,0 at top-left of image)
 * - Image: Pixel coordinates within an image (same as World in V3)
 * 
 * The canvas renders with this transform (see applyTransform):
 * 1. Translate to center + pan
 * 2. Scale by zoom
 * 3. Translate back by half image size (centering the image)
 * 
 * screenToWorld must reverse this exactly.
 */
export class CoordinateSystem {
  private canvas: HTMLCanvasElement;
  private _panX: number = 0;
  private _panY: number = 0;
  private _zoom: number = 1;
  
  // Dynamic image dimensions (set to actual loaded image size)
  private _imageWidth: number = 1920;
  private _imageHeight: number = 1080;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  // ============ GETTERS / SETTERS ============

  get panX(): number { return this._panX; }
  get panY(): number { return this._panY; }
  get zoom(): number { return this._zoom; }
  get dpr(): number { return window.devicePixelRatio || 1; }
  get imageWidth(): number { return this._imageWidth; }
  get imageHeight(): number { return this._imageHeight; }

  /** Viewport center in CSS pixels */
  get viewportCenterX(): number {
    return this.canvas.getBoundingClientRect().width / 2;
  }

  get viewportCenterY(): number {
    return this.canvas.getBoundingClientRect().height / 2;
  }

  setPan(x: number, y: number): void {
    this._panX = x;
    this._panY = y;
  }

  setZoom(zoom: number): void {
    this._zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
  }

  /**
   * Set image dimensions - call this when loading a new image
   */
  setImageSize(width: number, height: number): void {
    this._imageWidth = width;
    this._imageHeight = height;
  }

  // ============ COORDINATE TRANSFORMATIONS ============

  /**
   * Screen → World coordinates (CSS pixels to image coordinates)
   * This is the PRIMARY transformation for user input
   * 
   * FIXED: Properly accounts for all transformations
   */
  screenToWorld(screenX: number, screenY: number): Point {
    const rect = this.canvas.getBoundingClientRect();
    
    // Get position relative to canvas element (CSS pixels)
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;
    
    // Get center of canvas in CSS pixels
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Reverse the render transform:
    // 1. Subtract the viewport center and pan
    // 2. Divide by zoom
    // 3. Add back the image center offset
    
    const worldX = (canvasX - centerX - this._panX) / this._zoom + this._imageWidth / 2;
    const worldY = (canvasY - centerY - this._panY) / this._zoom + this._imageHeight / 2;
    
    return { x: worldX, y: worldY };
  }

  /**
   * World → Screen coordinates (image coordinates to CSS pixels)
   */
  worldToScreen(worldX: number, worldY: number): Point {
    const rect = this.canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const screenX = (worldX - this._imageWidth / 2) * this._zoom + centerX + this._panX + rect.left;
    const screenY = (worldY - this._imageHeight / 2) * this._zoom + centerY + this._panY + rect.top;
    
    return { x: screenX, y: screenY };
  }

  /**
   * World → Canvas coordinates (for drawing operations)
   * Returns physical canvas pixels (with DPR)
   */
  worldToCanvas(worldX: number, worldY: number): Point {
    const dpr = this.dpr;
    const rect = this.canvas.getBoundingClientRect();
    const centerX = rect.width / 2 * dpr;
    const centerY = rect.height / 2 * dpr;
    
    return {
      x: (worldX - this._imageWidth / 2) * this._zoom * dpr + centerX + this._panX * dpr,
      y: (worldY - this._imageHeight / 2) * this._zoom * dpr + centerY + this._panY * dpr,
    };
  }

  // ============ IMAGE COORDINATE HELPERS ============

  /**
   * World → Pixel Index
   */
  worldToPixelIndex(worldX: number, worldY: number): number {
    const x = Math.floor(worldX);
    const y = Math.floor(worldY);
    if (x < 0 || x >= this._imageWidth || y < 0 || y >= this._imageHeight) {
      return -1;
    }
    return y * this._imageWidth + x;
  }

  /**
   * Pixel Index → World
   */
  pixelIndexToWorld(index: number): Point {
    return {
      x: index % this._imageWidth,
      y: Math.floor(index / this._imageWidth),
    };
  }

  /**
   * Get RGBA at pixel index from ImageData
   */
  getPixelRGBA(imageData: ImageData, pixelIndex: number): [number, number, number, number] {
    const dataIndex = pixelIndex * 4;
    return [
      imageData.data[dataIndex],
      imageData.data[dataIndex + 1],
      imageData.data[dataIndex + 2],
      imageData.data[dataIndex + 3],
    ];
  }

  // ============ BOUNDS CHECKING ============

  /**
   * Check if world point is within image bounds
   */
  isInBounds(worldX: number, worldY: number): boolean {
    return worldX >= 0 && worldX < this._imageWidth && 
           worldY >= 0 && worldY < this._imageHeight;
  }

  /**
   * Clamp world point to image bounds
   */
  clampToBounds(point: Point): Point {
    return {
      x: Math.max(0, Math.min(this._imageWidth - 1, point.x)),
      y: Math.max(0, Math.min(this._imageHeight - 1, point.y)),
    };
  }

  // ============ ZOOM HELPERS ============

  /**
   * Zoom around a specific screen point
   */
  zoomAroundPoint(screenX: number, screenY: number, newZoom: number): void {
    const worldPoint = this.screenToWorld(screenX, screenY);
    
    const oldZoom = this._zoom;
    this._zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    
    if (this._zoom === oldZoom) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    this._panX = canvasX - centerX - (worldPoint.x - this._imageWidth / 2) * this._zoom;
    this._panY = canvasY - centerY - (worldPoint.y - this._imageHeight / 2) * this._zoom;
  }

  /**
   * Fit canvas to show entire image
   */
  fitToView(padding: number = 50): void {
    const rect = this.canvas.getBoundingClientRect();
    const availableWidth = rect.width - padding * 2;
    const availableHeight = rect.height - padding * 2;
    
    const scaleX = availableWidth / this._imageWidth;
    const scaleY = availableHeight / this._imageHeight;
    
    this._zoom = Math.min(scaleX, scaleY, 1);
    this._panX = 0;
    this._panY = 0;
  }

  /**
   * Reset to 100% zoom, centered
   */
  resetView(): void {
    this._zoom = 1;
    this._panX = 0;
    this._panY = 0;
  }

  // ============ CONTEXT TRANSFORM ============

  /**
   * Apply current transform to canvas context
   */
  applyTransform(ctx: CanvasRenderingContext2D): void {
    const dpr = this.dpr;
    const rect = this.canvas.getBoundingClientRect();
    const centerX = rect.width / 2 * dpr;
    const centerY = rect.height / 2 * dpr;
    
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset
    
    // Transform sequence:
    // 1. Move to center + pan
    // 2. Scale by zoom
    // 3. Offset so image (0,0) is at center
    ctx.translate(centerX + this._panX * dpr, centerY + this._panY * dpr);
    ctx.scale(this._zoom * dpr, this._zoom * dpr);
    ctx.translate(-this._imageWidth / 2, -this._imageHeight / 2);
  }

  /**
   * Get transform matrix values
   */
  getTransformMatrix(): DOMMatrix {
    const dpr = this.dpr;
    const rect = this.canvas.getBoundingClientRect();
    const centerX = rect.width / 2 * dpr;
    const centerY = rect.height / 2 * dpr;
    
    const matrix = new DOMMatrix();
    matrix.translateSelf(centerX + this._panX * dpr, centerY + this._panY * dpr);
    matrix.scaleSelf(this._zoom * dpr, this._zoom * dpr);
    matrix.translateSelf(-this._imageWidth / 2, -this._imageHeight / 2);
    
    return matrix;
  }
}
