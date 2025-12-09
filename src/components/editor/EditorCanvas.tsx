// V3 Image Editor - Main Canvas Component

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { CoordinateSystem } from '@/lib/editor/CoordinateSystem';
import { RenderPipeline } from '@/lib/editor/RenderPipeline';
import { FloodFill, PreviewWaveEngine } from '@/lib/editor/FloodFill';
import { LayerUtils } from '@/lib/editor/LayerUtils';
import { Point, SelectionMask, CANVAS_WIDTH, CANVAS_HEIGHT, createLayer } from '@/types/editor';

interface EditorCanvasProps {
  className?: string;
}

export function EditorCanvas({ className }: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const interactionCanvasRef = useRef<HTMLCanvasElement>(null);
  const coordSystemRef = useRef<CoordinateSystem | null>(null);
  const renderPipelineRef = useRef<RenderPipeline | null>(null);
  const previewEngineRef = useRef<PreviewWaveEngine | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastPreviewIdRef = useRef<string>('');
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [cursorPosition, setCursorPosition] = useState<Point | null>(null);
  
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
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Setup canvas size
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
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
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
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

  // ============ EVENT HANDLERS ============

  // Pan state
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOffsetRef = useRef({ x: 0, y: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !coordSystemRef.current) return;
    
    canvas.setPointerCapture(e.pointerId);
    
    // Check for pan (space+drag or middle mouse)
    if (e.button === 1 || activeTool === 'pan') {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY };
      panOffsetRef.current = { x: canvasState.panX, y: canvasState.panY };
      setCanvasMode('panning');
      return;
    }
    
    // Magic wand click
    if (activeTool === 'magic-wand' && e.button === 0) {
      const worldPoint = coordSystemRef.current.screenToWorld(e.clientX, e.clientY);
      handleMagicWandClick(worldPoint, e);
    }
  }, [activeTool, canvasState.panX, canvasState.panY, setCanvasMode]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!coordSystemRef.current) return;
    
    const worldPoint = coordSystemRef.current.screenToWorld(e.clientX, e.clientY);
    setCursorPosition(worldPoint);
    
    // Handle panning
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
    
    // Magic wand hover preview
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
    
    // Zoom with scroll
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = canvasState.zoom * zoomFactor;
    
    coordSystemRef.current.zoomAroundPoint(e.clientX, e.clientY, newZoom);
    setZoom(coordSystemRef.current.zoom);
    setPan(coordSystemRef.current.panX, coordSystemRef.current.panY);
    
    render();
  }, [canvasState.zoom, setZoom, setPan, render]);

  // ============ MAGIC WAND LOGIC ============

  const handleMagicWandHover = useCallback((worldPoint: Point) => {
    if (project.layers.length === 0) return;
    
    const previewId = `${Math.floor(worldPoint.x)}-${Math.floor(worldPoint.y)}`;
    if (previewId === lastPreviewIdRef.current) return;
    lastPreviewIdRef.current = previewId;
    
    // Cancel any running animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    // Get composite image data
    const compositeImageData = getCompositeImageData();
    
    // Initialize preview engine
    previewEngineRef.current = new PreviewWaveEngine(compositeImageData);
    previewEngineRef.current.startWave(
      Math.floor(worldPoint.x),
      Math.floor(worldPoint.y),
      toolSettings.magicWand.tolerance
    );
    
    // Animate preview expansion
    const animatePreview = () => {
      if (!previewEngineRef.current) return;
      
      const isComplete = previewEngineRef.current.processRing(6);
      
      const mask = previewEngineRef.current.getMask();
      const bounds = previewEngineRef.current.getBounds();
      
      const preview: SelectionMask = {
        id: previewId,
        mask,
        bounds,
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        pixels: new Set(),
        feathered: false,
        metadata: {
          seedPoint: worldPoint,
          tolerance: toolSettings.magicWand.tolerance,
          pixelCount: previewEngineRef.current.getPixelCount(),
          createdAt: Date.now(),
        },
      };
      
      setHoverPreview(preview);
      render();
      
      if (!isComplete) {
        animationFrameRef.current = requestAnimationFrame(animatePreview);
      }
    };
    
    animationFrameRef.current = requestAnimationFrame(animatePreview);
  }, [project.layers, toolSettings.magicWand.tolerance, getCompositeImageData, setHoverPreview, render]);

  const handleMagicWandClick = useCallback((worldPoint: Point, e: React.PointerEvent) => {
    if (project.layers.length === 0) return;
    
    // Get composite image data
    const compositeImageData = getCompositeImageData();
    
    // Run full flood fill
    const floodFill = new FloodFill(compositeImageData);
    const result = floodFill.execute(worldPoint, {
      tolerance: toolSettings.magicWand.tolerance,
      contiguous: toolSettings.magicWand.contiguous,
    });
    
    const selectionMask: SelectionMask = {
      id: crypto.randomUUID(),
      mask: result.mask,
      bounds: result.bounds,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      pixels: new Set(result.pixels),
      feathered: false,
      metadata: {
        seedPoint: worldPoint,
        tolerance: toolSettings.magicWand.tolerance,
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
          CANVAS_WIDTH
        );
        if (newLayer) {
          addLayer(newLayer);
        }
      }
    } else {
      // Normal click: Set selection
      setSelection(selectionMask);
    }
    
    setHoverPreview(null);
    render();
  }, [project.layers, project.activeLayerId, toolSettings.magicWand, getCompositeImageData, addLayer, setSelection, setHoverPreview, render]);

  // ============ KEYBOARD SHORTCUTS ============

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo/Redo
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        // Would call undo/redo from context
      }
      
      // Escape - clear selection
      if (e.key === 'Escape') {
        setSelection(null);
        setHoverPreview(null);
      }
      
      // Space - temporary pan tool
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
  }, [setSelection, setHoverPreview, setCanvasMode]);

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
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ cursor: getCursor() }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          setCursorPosition(null);
          setHoverPreview(null);
        }}
        onWheel={handleWheel}
      />
      
      {/* Status overlay */}
      <div className="absolute bottom-3 left-3 flex items-center gap-3 text-xs text-muted-foreground font-mono">
        <span>Zoom: {(canvasState.zoom * 100).toFixed(0)}%</span>
        {cursorPosition && (
          <span>
            {Math.floor(cursorPosition.x)}, {Math.floor(cursorPosition.y)}
          </span>
        )}
        {hoverPreview && (
          <span className="text-primary">
            {hoverPreview.metadata.pixelCount.toLocaleString()} px
          </span>
        )}
      </div>
    </div>
  );
}
