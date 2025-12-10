// V3 Image Editor - Main Canvas Component with Dynamic Sizing & Differential Preview

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { CoordinateSystem } from '@/lib/editor/CoordinateSystem';
import { RenderPipeline } from '@/lib/editor/RenderPipeline';
import { FastFloodFill, instantFloodFill, globalColorSelect, DifferentialPreview } from '@/lib/editor/FastFloodFill';
import { LayerUtils } from '@/lib/editor/LayerUtils';
import { Point, SelectionMask } from '@/types/editor';

interface EditorCanvasProps {
  className?: string;
}

export function EditorCanvas({ className }: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const coordSystemRef = useRef<CoordinateSystem | null>(null);
  const renderPipelineRef = useRef<RenderPipeline | null>(null);
  const floodFillRef = useRef<FastFloodFill | null>(null);
  const differentialPreviewRef = useRef<DifferentialPreview>(new DifferentialPreview());
  const animationFrameRef = useRef<number | null>(null);
  const lastPreviewPointRef = useRef<string>('');
  const compositeRef = useRef<ImageData | null>(null);
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [cursorPosition, setCursorPosition] = useState<Point | null>(null);
  const [previewPixelCount, setPreviewPixelCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 1920, height: 1080 });
  
  const {
    state,
    setPan,
    setZoom,
    setCanvasMode,
    setSelection,
    setHoverPreview,
    addLayer,
    getCompositeImageData,
  } = useEditor();
  
  const { project, canvasState, activeTool, toolSettings, selection, hoverPreview } = state;

  // ============ INITIALIZATION ============

  useEffect(() => {
    const canvas = canvasRef.current;
    const previewCanvas = previewCanvasRef.current;
    if (!canvas || !previewCanvas) return;
    
    const ctx = canvas.getContext('2d');
    const previewCtx = previewCanvas.getContext('2d');
    if (!ctx || !previewCtx) return;
    
    // Setup canvas size
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    previewCanvas.width = rect.width * dpr;
    previewCanvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    previewCtx.scale(dpr, dpr);
    
    // Initialize coordinate system
    coordSystemRef.current = new CoordinateSystem(canvas);
    coordSystemRef.current.fitToView(50);
    
    // Initialize render pipeline
    renderPipelineRef.current = new RenderPipeline(ctx, coordSystemRef.current, {
      showGrid: true,
      showSelection: true,
      backgroundColor: project.backgroundColor,
    });
    
    renderPipelineRef.current.startMarchingAnts();
    setIsInitialized(true);
    
    // Handle resize
    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      previewCanvas.width = rect.width * dpr;
      previewCanvas.height = rect.height * dpr;
      render();
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      renderPipelineRef.current?.stopMarchingAnts();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Update image dimensions and composite when layers change
  useEffect(() => {
    if (project.layers.length > 0) {
      // Find the actual image dimensions from layers
      let maxWidth = 0;
      let maxHeight = 0;
      
      for (const layer of project.layers) {
        if (layer.imageData) {
          maxWidth = Math.max(maxWidth, layer.imageData.width);
          maxHeight = Math.max(maxHeight, layer.imageData.height);
        }
      }
      
      if (maxWidth > 0 && maxHeight > 0) {
        setImageDimensions({ width: maxWidth, height: maxHeight });
        
        // Update coordinate system with actual image size
        if (coordSystemRef.current) {
          coordSystemRef.current.setImageSize(maxWidth, maxHeight);
          coordSystemRef.current.fitToView(50);
        }
        
        // Update render pipeline image size
        if (renderPipelineRef.current) {
          (renderPipelineRef.current as any).imageWidth = maxWidth;
          (renderPipelineRef.current as any).imageHeight = maxHeight;
        }
      }
      
      // Get composite at actual dimensions
      compositeRef.current = getCompositeImageData();
    } else {
      compositeRef.current = null;
    }
  }, [project.layers, getCompositeImageData]);

  // ============ RENDER LOOP ============

  const render = useCallback(() => {
    if (!renderPipelineRef.current) return;
    
    renderPipelineRef.current.render(
      project.layers,
      selection,
      hoverPreview,
      cursorPosition
    );
  }, [project.layers, selection, hoverPreview, cursorPosition]);

  useEffect(() => {
    if (isInitialized) {
      render();
    }
  }, [isInitialized, render]);

  // ============ PREVIEW RENDERING ============

  const drawPreviewMask = useCallback((mask: Uint8ClampedArray, width: number, height: number) => {
    const previewCanvas = previewCanvasRef.current;
    const coordSystem = coordSystemRef.current;
    if (!previewCanvas || !coordSystem) return;
    
    const ctx = previewCanvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    
    // Clear preview canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    
    // Apply coordinate transform
    ctx.save();
    coordSystem.applyTransform(ctx);
    
    // Create preview image data at actual image size
    const previewData = new ImageData(width, height);
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] > 0) {
        const idx = i * 4;
        const alpha = mask[i]; // Use mask value for alpha (supports fade out)
        previewData.data[idx] = 66;     // Primary color tint
        previewData.data[idx + 1] = 153;
        previewData.data[idx + 2] = 225;
        previewData.data[idx + 3] = Math.min(alpha, 120); // Semi-transparent
      }
    }
    
    // Draw to temp canvas then to preview
    const tempCanvas = new OffscreenCanvas(width, height);
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(previewData, 0, 0);
    
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.restore();
  }, []);

  const clearPreview = useCallback(() => {
    const previewCanvas = previewCanvasRef.current;
    if (!previewCanvas) return;
    const ctx = previewCanvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    }
    differentialPreviewRef.current.clear();
  }, []);

  // ============ EVENT HANDLERS ============

  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOffsetRef = useRef({ x: 0, y: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !coordSystemRef.current) return;
    
    canvas.setPointerCapture(e.pointerId);
    
    if (e.button === 1 || activeTool === 'pan') {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY };
      panOffsetRef.current = { x: canvasState.panX, y: canvasState.panY };
      setCanvasMode('panning');
      return;
    }
    
    if (activeTool === 'magic-wand' && e.button === 0) {
      const worldPoint = coordSystemRef.current.screenToWorld(e.clientX, e.clientY);
      handleMagicWandClick(worldPoint, e);
    }
  }, [activeTool, canvasState.panX, canvasState.panY, setCanvasMode]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!coordSystemRef.current) return;
    
    const worldPoint = coordSystemRef.current.screenToWorld(e.clientX, e.clientY);
    setCursorPosition(worldPoint);
    
    if (isPanningRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan(panOffsetRef.current.x + dx, panOffsetRef.current.y + dy);
      
      if (coordSystemRef.current) {
        coordSystemRef.current.setPan(panOffsetRef.current.x + dx, panOffsetRef.current.y + dy);
      }
      render();
      return;
    }
    
    if (activeTool === 'magic-wand' && coordSystemRef.current.isInBounds(worldPoint.x, worldPoint.y)) {
      handleMagicWandHover(worldPoint);
    }
  }, [activeTool, setPan, render]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.releasePointerCapture(e.pointerId);
    }
    
    if (isPanningRef.current) {
      isPanningRef.current = false;
      setCanvasMode('idle');
    }
  }, [setCanvasMode]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    if (!coordSystemRef.current) return;
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = canvasState.zoom * zoomFactor;
    
    coordSystemRef.current.zoomAroundPoint(e.clientX, e.clientY, newZoom);
    setZoom(coordSystemRef.current.zoom);
    setPan(coordSystemRef.current.panX, coordSystemRef.current.panY);
    
    render();
  }, [canvasState.zoom, setZoom, setPan, render]);

  // ============ MAGIC WAND LOGIC ============

  const handleMagicWandHover = useCallback((worldPoint: Point) => {
    if (!compositeRef.current || project.layers.length === 0) return;
    
    const composite = compositeRef.current;
    const imgWidth = composite.width;
    const imgHeight = composite.height;
    
    // Early bounds check
    if (worldPoint.x < 0 || worldPoint.x >= imgWidth || worldPoint.y < 0 || worldPoint.y >= imgHeight) {
      return;
    }
    
    const pointKey = `${Math.floor(worldPoint.x)}-${Math.floor(worldPoint.y)}`;
    if (pointKey === lastPreviewPointRef.current) return;
    lastPreviewPointRef.current = pointKey;
    
    // Cancel any existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    const { previewMode, batchSize, maxPixels, tolerance, contiguous, connectivity, expansionShape, useDifferentialPreview } = toolSettings.magicWand;
    
    if (previewMode === 'off') {
      clearPreview();
      setPreviewPixelCount(0);
      return;
    }
    
    const seedX = Math.floor(worldPoint.x);
    const seedY = Math.floor(worldPoint.y);
    
    // Instant mode
    if (previewMode === 'instant') {
      setIsProcessing(true);
      
      let result: { mask: Uint8ClampedArray; pixelCount: number; width: number; height: number };
      
      if (contiguous) {
        result = instantFloodFill(composite, seedX, seedY, {
          tolerance,
          contiguous: true,
          connectivity,
          batchSize: 200000,
          maxPixels,
        });
      } else {
        result = globalColorSelect(composite, seedX, seedY, tolerance);
      }
      
      // Apply differential preview for smooth transitions
      if (useDifferentialPreview) {
        const diff = differentialPreviewRef.current.update(result.mask, result.width, result.height);
        drawPreviewMask(diff.displayMask, result.width, result.height);
      } else {
        drawPreviewMask(result.mask, result.width, result.height);
      }
      
      setPreviewPixelCount(result.pixelCount);
      setIsProcessing(false);
      return;
    }
    
    // Animated modes
    floodFillRef.current = new FastFloodFill(composite);
    floodFillRef.current.initialize(seedX, seedY, {
      tolerance,
      contiguous,
      connectivity,
      batchSize: previewMode === 'fast' ? 30000 : 8000,
      maxPixels,
      expansionShape,
    });
    
    setIsProcessing(true);
    
    const animate = () => {
      if (!floodFillRef.current) return;
      
      const complete = floodFillRef.current.processBatch();
      const mask = floodFillRef.current.getMask();
      const width = floodFillRef.current.getWidth();
      const height = floodFillRef.current.getHeight();
      
      if (mask) {
        if (useDifferentialPreview) {
          const diff = differentialPreviewRef.current.update(mask, width, height);
          drawPreviewMask(diff.displayMask, width, height);
        } else {
          drawPreviewMask(mask, width, height);
        }
        setPreviewPixelCount(floodFillRef.current.getPixelCount());
      }
      
      if (!complete) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setIsProcessing(false);
      }
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [project.layers, toolSettings.magicWand, drawPreviewMask, clearPreview]);

  const handleMagicWandClick = useCallback((worldPoint: Point, e: React.PointerEvent) => {
    if (!compositeRef.current || project.layers.length === 0) return;
    
    const composite = compositeRef.current;
    const imgWidth = composite.width;
    const imgHeight = composite.height;
    
    const { tolerance, contiguous, connectivity, maxPixels } = toolSettings.magicWand;
    const seedX = Math.floor(worldPoint.x);
    const seedY = Math.floor(worldPoint.y);
    
    // Bounds check
    if (seedX < 0 || seedX >= imgWidth || seedY < 0 || seedY >= imgHeight) {
      return;
    }
    
    let result: { mask: Uint8ClampedArray; bounds: { x: number; y: number; width: number; height: number }; pixelCount: number; width: number; height: number };
    
    if (contiguous) {
      result = instantFloodFill(composite, seedX, seedY, {
        tolerance,
        contiguous: true,
        connectivity,
        batchSize: 200000,
        maxPixels,
      });
    } else {
      const globalResult = globalColorSelect(composite, seedX, seedY, tolerance);
      result = {
        mask: globalResult.mask,
        bounds: { x: 0, y: 0, width: imgWidth, height: imgHeight },
        pixelCount: globalResult.pixelCount,
        width: imgWidth,
        height: imgHeight,
      };
    }
    
    const selectionMask: SelectionMask = {
      id: crypto.randomUUID(),
      mask: result.mask,
      bounds: result.bounds,
      width: imgWidth,
      height: imgHeight,
      pixels: new Set(),
      feathered: false,
      metadata: {
        seedPoint: worldPoint,
        tolerance,
        pixelCount: result.pixelCount,
        createdAt: Date.now(),
      },
    };
    
    // Alt-click: Create layer from selection
    if (e.altKey) {
      const activeLayer = project.layers.find(l => l.id === project.activeLayerId) || project.layers[0];
      if (activeLayer) {
        const newLayer = LayerUtils.extractPixelsWithMask(
          activeLayer,
          result.mask,
          result.bounds,
          imgWidth
        );
        if (newLayer) {
          addLayer(newLayer);
        }
      }
    } else {
      setSelection(selectionMask);
    }
    
    clearPreview();
    render();
  }, [project, toolSettings.magicWand, addLayer, setSelection, clearPreview, render]);

  // ============ KEYBOARD SHORTCUTS ============

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelection(null);
        setHoverPreview(null);
        clearPreview();
      }
      
      if (e.key === ' ' && !e.repeat) {
        setCanvasMode('panning');
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        setCanvasMode('idle');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [setSelection, setHoverPreview, setCanvasMode, clearPreview]);

  // ============ RENDER ============

  const getCursor = () => {
    if (canvasState.mode === 'panning') return 'grabbing';
    if (activeTool === 'pan') return 'grab';
    if (activeTool === 'magic-wand') return 'crosshair';
    if (activeTool === 'move') return 'move';
    return 'default';
  };

  return (
    <div className={`relative w-full h-full canvas-container inset-canvas ${className}`}>
      {/* Main canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ cursor: getCursor() }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          setCursorPosition(null);
          clearPreview();
          lastPreviewPointRef.current = '';
        }}
        onWheel={handleWheel}
      />
      
      {/* Preview overlay canvas */}
      <canvas
        ref={previewCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
      
      {/* Status overlay */}
      <div className="absolute bottom-3 left-3 flex items-center gap-3 text-xs text-muted-foreground font-mono bg-background/80 px-2 py-1 rounded">
        <span>Zoom: {(canvasState.zoom * 100).toFixed(0)}%</span>
        <span className="text-muted-foreground/60">{imageDimensions.width}×{imageDimensions.height}</span>
        {cursorPosition && (
          <span>
            {Math.floor(cursorPosition.x)}, {Math.floor(cursorPosition.y)}
          </span>
        )}
        {previewPixelCount > 0 && (
          <span className="text-primary">
            {previewPixelCount.toLocaleString()} px
            {isProcessing && <span className="ml-1 animate-pulse">...</span>}
          </span>
        )}
      </div>
    </div>
  );
}
