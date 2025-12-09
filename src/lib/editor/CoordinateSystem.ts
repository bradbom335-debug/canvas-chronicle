// V3 Image Editor - Coordinate System (Single Source of Truth)

import { Point, CANVAS_WIDTH, CANVAS_HEIGHT, MIN_ZOOM, MAX_ZOOM } from '@/types/editor';

/**
 * CoordinateSystem - Manages all coordinate transformations
 * 
 * Coordinate Spaces:
 * - Screen: CSS pixels relative to browser window
 * - Canvas: Physical pixels on the canvas element
 * - World: Logical coordinates in the scene (top-left based, 0 to CANVAS_WIDTH/HEIGHT)
 * - Image: Pixel coordinates within an image (same as World in V3)
 */
export class CoordinateSystem {
  private canvas: HTMLCanvasElement;
  private _panX: number = 0;
  private _panY: number = 0;
  private _zoom: number = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  // ============ GETTERS / SETTERS ============

  get panX(): number { return this._panX; }
  get panY(): number { return this._panY; }
  get zoom(): number { return this._zoom; }
  get dpr(): number { return window.devicePixelRatio || 1; }

  get viewportCenterX(): number {
    return this.canvas.width / (2 * this.dpr);
  }

  get viewportCenterY(): number {
    return this.canvas.height / (2 * this.dpr);
  }

  setPan(x: number, y: number): void {
    this._panX = x;
    this._panY = y;
  }

  setZoom(zoom: number): void {
    this._zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
  }

  // ============ COORDINATE TRANSFORMATIONS ============

  /**
   * Screen → Canvas coordinates
   * Accounts for canvas position in viewport and DPR
   */
  screenToCanvas(screenX: number, screenY: number): Point {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    
    return {
      x: (screenX - rect.left) * scaleX,
      y: (screenY - rect.top) * scaleY,
    };
  }

  /**
   * Canvas → World coordinates
   * Reverses pan/zoom transformation
   */
  canvasToWorld(canvasX: number, canvasY: number): Point {
    // Account for DPR in viewport center calculation
    const centerX = this.viewportCenterX * this.dpr;
    const centerY = this.viewportCenterY * this.dpr;
    
    return {
      x: (canvasX - centerX - this._panX * this.dpr) / this._zoom,
      y: (canvasY - centerY - this._panY * this.dpr) / this._zoom,
    };
  }

  /**
   * Screen → World (convenience method)
   * Most common transformation for user input
   */
  screenToWorld(screenX: number, screenY: number): Point {
    const canvas = this.screenToCanvas(screenX, screenY);
    return this.canvasToWorld(canvas.x, canvas.y);
  }

  /**
   * World → Canvas coordinates
   * Applies pan/zoom transformation
   */
  worldToCanvas(worldX: number, worldY: number): Point {
    const centerX = this.viewportCenterX * this.dpr;
    const centerY = this.viewportCenterY * this.dpr;
    
    return {
      x: worldX * this._zoom + this._panX * this.dpr + centerX,
      y: worldY * this._zoom + this._panY * this.dpr + centerY,
    };
  }

  /**
   * Canvas → Screen coordinates
   */
  canvasToScreen(canvasX: number, canvasY: number): Point {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = rect.width / this.canvas.width;
    const scaleY = rect.height / this.canvas.height;
    
    return {
      x: canvasX * scaleX + rect.left,
      y: canvasY * scaleY + rect.top,
    };
  }

  /**
   * World → Screen (convenience method)
   */
  worldToScreen(worldX: number, worldY: number): Point {
    const canvas = this.worldToCanvas(worldX, worldY);
    return this.canvasToScreen(canvas.x, canvas.y);
  }

  // ============ IMAGE COORDINATE HELPERS ============

  /**
   * World → Pixel Index
   * Converts world coordinates to a flat array index
   */
  worldToPixelIndex(worldX: number, worldY: number, width: number = CANVAS_WIDTH): number {
    const x = Math.floor(worldX);
    const y = Math.floor(worldY);
    return y * width + x;
  }

  /**
   * Pixel Index → World
   */
  pixelIndexToWorld(index: number, width: number = CANVAS_WIDTH): Point {
    return {
      x: index % width,
      y: Math.floor(index / width),
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
   * Check if world point is within canvas bounds
   */
  isInBounds(worldX: number, worldY: number): boolean {
    return worldX >= 0 && worldX < CANVAS_WIDTH && 
           worldY >= 0 && worldY < CANVAS_HEIGHT;
  }

  /**
   * Clamp world point to canvas bounds
   */
  clampToBounds(point: Point): Point {
    return {
      x: Math.max(0, Math.min(CANVAS_WIDTH - 1, point.x)),
      y: Math.max(0, Math.min(CANVAS_HEIGHT - 1, point.y)),
    };
  }

  // ============ ZOOM HELPERS ============

  /**
   * Zoom around a specific screen point
   * Keeps the point stationary on screen
   */
  zoomAroundPoint(screenX: number, screenY: number, newZoom: number): void {
    const worldPoint = this.screenToWorld(screenX, screenY);
    
    const oldZoom = this._zoom;
    this._zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    
    // Adjust pan to keep world point under cursor
    const zoomRatio = this._zoom / oldZoom;
    const centerX = this.viewportCenterX;
    const centerY = this.viewportCenterY;
    
    this._panX = (this._panX + centerX) * zoomRatio - centerX;
    this._panY = (this._panY + centerY) * zoomRatio - centerY;
    
    // Recalculate to ensure point stays fixed
    const newWorld = this.screenToWorld(screenX, screenY);
    this._panX += (worldPoint.x - newWorld.x) * this._zoom;
    this._panY += (worldPoint.y - newWorld.y) * this._zoom;
  }

  /**
   * Fit canvas to show entire image
   */
  fitToView(padding: number = 50): void {
    const rect = this.canvas.getBoundingClientRect();
    const availableWidth = rect.width - padding * 2;
    const availableHeight = rect.height - padding * 2;
    
    const scaleX = availableWidth / CANVAS_WIDTH;
    const scaleY = availableHeight / CANVAS_HEIGHT;
    
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
    const centerX = this.viewportCenterX * dpr;
    const centerY = this.viewportCenterY * dpr;
    
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset
    ctx.translate(centerX + this._panX * dpr, centerY + this._panY * dpr);
    ctx.scale(this._zoom, this._zoom);
    ctx.translate(-CANVAS_WIDTH / 2, -CANVAS_HEIGHT / 2);
  }

  /**
   * Get transform matrix values
   */
  getTransformMatrix(): DOMMatrix {
    const dpr = this.dpr;
    const centerX = this.viewportCenterX * dpr;
    const centerY = this.viewportCenterY * dpr;
    
    const matrix = new DOMMatrix();
    matrix.translateSelf(centerX + this._panX * dpr, centerY + this._panY * dpr);
    matrix.scaleSelf(this._zoom, this._zoom);
    matrix.translateSelf(-CANVAS_WIDTH / 2, -CANVAS_HEIGHT / 2);
    
    return matrix;
  }
}
