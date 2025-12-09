// V3 Image Editor - Render Pipeline (60fps Rendering)

import { Layer, SelectionMask, CANVAS_WIDTH, CANVAS_HEIGHT, Point } from '@/types/editor';
import { CoordinateSystem } from './CoordinateSystem';

interface RenderOptions {
  showGrid: boolean;
  showSelection: boolean;
  showGuides: boolean;
  backgroundColor: string;
}

const DEFAULT_OPTIONS: RenderOptions = {
  showGrid: true,
  showSelection: true,
  showGuides: true,
  backgroundColor: '#1a1a2e',
};

/**
 * RenderPipeline - Handles all canvas rendering
 * 
 * Render Order:
 * 1. Clear canvas
 * 2. Apply coordinate transform
 * 3. Draw checkerboard background
 * 4. Render layers (bottom to top)
 * 5. Render selection overlay
 * 6. Render UI elements (guides, handles)
 */
export class RenderPipeline {
  private ctx: CanvasRenderingContext2D;
  private interactionCtx: CanvasRenderingContext2D | null = null;
  private coordSystem: CoordinateSystem;
  private options: RenderOptions;
  private checkerboardPattern: CanvasPattern | null = null;
  private marchingAntsOffset: number = 0;
  private animationFrame: number | null = null;
  private lastFrameTime: number = 0;

  constructor(
    ctx: CanvasRenderingContext2D,
    coordSystem: CoordinateSystem,
    options: Partial<RenderOptions> = {}
  ) {
    this.ctx = ctx;
    this.coordSystem = coordSystem;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.createCheckerboardPattern();
  }

  setInteractionCanvas(ctx: CanvasRenderingContext2D): void {
    this.interactionCtx = ctx;
  }

  // ============ MAIN RENDER LOOP ============

  render(
    layers: Layer[],
    selection: SelectionMask | null,
    hoverPreview: SelectionMask | null,
    cursorPosition: Point | null
  ): void {
    const startTime = performance.now();
    const { ctx } = this;
    const dpr = this.coordSystem.dpr;
    
    // Clear canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // Apply coordinate transform
    this.coordSystem.applyTransform(ctx);
    
    // Draw background
    this.drawBackground();
    
    // Draw layers
    this.drawLayers(layers);
    
    // Draw selection
    if (selection && this.options.showSelection) {
      this.drawSelection(selection);
    }
    
    // Draw hover preview
    if (hoverPreview) {
      this.drawHoverPreview(hoverPreview);
    }
    
    // Draw cursor indicator
    if (cursorPosition) {
      this.drawCursorIndicator(cursorPosition);
    }
    
    // Reset transform for UI elements
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    // Draw grid
    if (this.options.showGrid && this.coordSystem.zoom >= 4) {
      this.drawPixelGrid();
    }
    
    // Performance tracking
    const frameTime = performance.now() - startTime;
    if (frameTime > 16) {
      console.warn(`Slow frame: ${frameTime.toFixed(2)}ms`);
    }
  }

  // ============ BACKGROUND ============

  private createCheckerboardPattern(): void {
    const size = 16;
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = size * 2;
    patternCanvas.height = size * 2;
    
    const pCtx = patternCanvas.getContext('2d')!;
    pCtx.fillStyle = '#1e1e2e';
    pCtx.fillRect(0, 0, size * 2, size * 2);
    pCtx.fillStyle = '#252535';
    pCtx.fillRect(0, 0, size, size);
    pCtx.fillRect(size, size, size, size);
    
    this.checkerboardPattern = this.ctx.createPattern(patternCanvas, 'repeat');
  }

  private drawBackground(): void {
    const { ctx } = this;
    
    // Fill with background color
    ctx.fillStyle = this.options.backgroundColor;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Draw checkerboard for transparency
    if (this.checkerboardPattern) {
      ctx.fillStyle = this.checkerboardPattern;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
    
    // Draw canvas border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1 / this.coordSystem.zoom;
    ctx.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  // ============ LAYER RENDERING ============

  private drawLayers(layers: Layer[]): void {
    const { ctx } = this;
    
    // Filter to visible layers, sort by z-order (assuming array order)
    const visibleLayers = layers.filter(l => l.visible && l.imageData);
    
    for (const layer of visibleLayers) {
      if (!layer.imageData) continue;
      
      ctx.save();
      
      // Apply layer opacity
      ctx.globalAlpha = layer.opacity;
      
      // Apply blend mode
      ctx.globalCompositeOperation = this.getCompositeOperation(layer.blendMode);
      
      // Apply layer transform
      const { bounds, transform } = layer;
      ctx.translate(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      ctx.rotate(transform.rotation);
      ctx.scale(transform.sx, transform.sy);
      ctx.translate(-bounds.width / 2, -bounds.height / 2);
      
      // Create temporary canvas for layer
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = layer.imageData.width;
      tempCanvas.height = layer.imageData.height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.putImageData(layer.imageData, 0, 0);
      
      // Draw layer
      ctx.drawImage(tempCanvas, 0, 0);
      
      ctx.restore();
    }
  }

  private getCompositeOperation(blendMode: string): GlobalCompositeOperation {
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

  // ============ SELECTION RENDERING ============

  private drawSelection(selection: SelectionMask): void {
    const { ctx } = this;
    const { mask, bounds, width } = selection;
    
    // Create selection overlay
    ctx.save();
    
    // Draw marching ants border
    this.drawMarchingAnts(mask, bounds, width);
    
    // Draw selection highlight
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#00d4ff';
    
    for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
      for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
        const maskIndex = y * width + x;
        if (mask[maskIndex] > 0) {
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    
    ctx.restore();
  }

  private drawMarchingAnts(
    mask: Uint8ClampedArray,
    bounds: { x: number; y: number; width: number; height: number },
    maskWidth: number
  ): void {
    const { ctx } = this;
    
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1 / this.coordSystem.zoom;
    ctx.setLineDash([4 / this.coordSystem.zoom, 4 / this.coordSystem.zoom]);
    ctx.lineDashOffset = this.marchingAntsOffset;
    
    // Find edge pixels and draw border
    ctx.beginPath();
    
    for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
      for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
        const maskIndex = y * maskWidth + x;
        if (mask[maskIndex] > 0) {
          // Check neighbors for edges
          const top = y > 0 ? mask[(y - 1) * maskWidth + x] : 0;
          const bottom = y < CANVAS_HEIGHT - 1 ? mask[(y + 1) * maskWidth + x] : 0;
          const left = x > 0 ? mask[y * maskWidth + (x - 1)] : 0;
          const right = x < CANVAS_WIDTH - 1 ? mask[y * maskWidth + (x + 1)] : 0;
          
          if (top === 0) {
            ctx.moveTo(x, y);
            ctx.lineTo(x + 1, y);
          }
          if (bottom === 0) {
            ctx.moveTo(x, y + 1);
            ctx.lineTo(x + 1, y + 1);
          }
          if (left === 0) {
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + 1);
          }
          if (right === 0) {
            ctx.moveTo(x + 1, y);
            ctx.lineTo(x + 1, y + 1);
          }
        }
      }
    }
    
    ctx.stroke();
    ctx.restore();
  }

  private drawHoverPreview(preview: SelectionMask): void {
    const { ctx } = this;
    const { mask, bounds, width } = preview;
    
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#00d4ff';
    
    for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
      for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
        const maskIndex = y * width + x;
        if (mask[maskIndex] > 0) {
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    
    ctx.restore();
  }

  // ============ CURSOR INDICATOR ============

  private drawCursorIndicator(position: Point): void {
    const { ctx } = this;
    const size = 3 / this.coordSystem.zoom;
    
    ctx.save();
    
    // Draw crosshair
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 1 / this.coordSystem.zoom;
    
    ctx.beginPath();
    ctx.moveTo(position.x - size * 2, position.y);
    ctx.lineTo(position.x - size, position.y);
    ctx.moveTo(position.x + size, position.y);
    ctx.lineTo(position.x + size * 2, position.y);
    ctx.moveTo(position.x, position.y - size * 2);
    ctx.lineTo(position.x, position.y - size);
    ctx.moveTo(position.x, position.y + size);
    ctx.lineTo(position.x, position.y + size * 2);
    ctx.stroke();
    
    // Draw center dot
    ctx.fillStyle = '#00d4ff';
    ctx.beginPath();
    ctx.arc(position.x, position.y, 1 / this.coordSystem.zoom, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }

  // ============ PIXEL GRID ============

  private drawPixelGrid(): void {
    const { ctx } = this;
    const zoom = this.coordSystem.zoom;
    
    if (zoom < 4) return; // Only show grid at high zoom
    
    ctx.save();
    this.coordSystem.applyTransform(ctx);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1 / zoom;
    
    // Calculate visible area
    const topLeft = this.coordSystem.screenToWorld(0, 0);
    const bottomRight = this.coordSystem.screenToWorld(
      ctx.canvas.width / this.coordSystem.dpr,
      ctx.canvas.height / this.coordSystem.dpr
    );
    
    const startX = Math.max(0, Math.floor(topLeft.x));
    const endX = Math.min(CANVAS_WIDTH, Math.ceil(bottomRight.x));
    const startY = Math.max(0, Math.floor(topLeft.y));
    const endY = Math.min(CANVAS_HEIGHT, Math.ceil(bottomRight.y));
    
    ctx.beginPath();
    
    // Vertical lines
    for (let x = startX; x <= endX; x++) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    
    // Horizontal lines
    for (let y = startY; y <= endY; y++) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    
    ctx.stroke();
    ctx.restore();
  }

  // ============ ANIMATION ============

  startMarchingAnts(): void {
    const animate = () => {
      const now = performance.now();
      if (now - this.lastFrameTime >= 50) {
        this.marchingAntsOffset = (this.marchingAntsOffset + 1) % 16;
        this.lastFrameTime = now;
      }
      this.animationFrame = requestAnimationFrame(animate);
    };
    animate();
  }

  stopMarchingAnts(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  // ============ OPTIONS ============

  setOptions(options: Partial<RenderOptions>): void {
    this.options = { ...this.options, ...options };
  }
}
