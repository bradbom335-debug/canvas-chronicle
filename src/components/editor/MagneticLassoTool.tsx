// Magnetic Lasso Tool - Canvas Integration Component
// Renders lasso paths, anchors, and handles user interaction

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Point } from '@/types/editor';
import { 
  MagneticLassoEngine, 
  LassoSettings, 
  LassoState,
  DEFAULT_LASSO_SETTINGS,
  LassoAnchor
} from '@/lib/editor/MagneticLasso';

interface MagneticLassoToolProps {
  canvas: HTMLCanvasElement | null;
  imageData: ImageData | null;
  settings: LassoSettings;
  isActive: boolean;
  panX: number;
  panY: number;
  zoom: number;
  onComplete: (path: Point[]) => void;
  onCancel: () => void;
  onMetricsUpdate: (metrics: LassoState['metrics']) => void;
}

export function MagneticLassoTool({
  canvas,
  imageData,
  settings,
  isActive,
  panX,
  panY,
  zoom,
  onComplete,
  onCancel,
  onMetricsUpdate,
}: MagneticLassoToolProps) {
  const engineRef = useRef<MagneticLassoEngine | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number>(0);
  const [lassoState, setLassoState] = useState<LassoState | null>(null);

  // Initialize engine when image data changes
  useEffect(() => {
    if (!imageData) return;
    
    const engine = new MagneticLassoEngine(settings);
    engine.initialize(imageData);
    engineRef.current = engine;

    return () => {
      engineRef.current = null;
    };
  }, [imageData]);

  // Update settings when they change
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.updateSettings(settings);
    }
  }, [settings]);

  // Create overlay canvas
  useEffect(() => {
    if (!canvas) return;

    const overlay = document.createElement('canvas');
    overlay.width = canvas.width;
    overlay.height = canvas.height;
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '100';
    
    canvas.parentElement?.appendChild(overlay);
    overlayCanvasRef.current = overlay;

    return () => {
      overlay.remove();
      overlayCanvasRef.current = null;
    };
  }, [canvas]);

  // Convert screen coordinates to image coordinates
  const screenToImage = useCallback((screenX: number, screenY: number): Point => {
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const canvasX = (screenX - rect.left) * (canvas.width / rect.width);
    const canvasY = (screenY - rect.top) * (canvas.height / rect.height);
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    const imageX = (canvasX - centerX - panX) / zoom + centerX;
    const imageY = (canvasY - centerY - panY) / zoom + centerY;
    
    return { x: Math.round(imageX), y: Math.round(imageY) };
  }, [canvas, panX, panY, zoom]);

  // Convert image coordinates to screen coordinates
  const imageToScreen = useCallback((imageX: number, imageY: number): Point => {
    if (!canvas) return { x: 0, y: 0 };
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    const screenX = (imageX - centerX) * zoom + centerX + panX;
    const screenY = (imageY - centerY) * zoom + centerY + panY;
    
    return { x: screenX, y: screenY };
  }, [canvas, panX, panY, zoom]);

  // Render lasso visualization
  const render = useCallback(() => {
    const overlay = overlayCanvasRef.current;
    const engine = engineRef.current;
    if (!overlay || !engine) return;

    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const state = engine.getState();
    if (!state.isActive && state.anchors.length === 0) return;

    const engineSettings = engine.getSettings();

    // Draw completed path
    if (state.currentPath.length > 1) {
      ctx.beginPath();
      const firstScreen = imageToScreen(state.currentPath[0].x, state.currentPath[0].y);
      ctx.moveTo(firstScreen.x, firstScreen.y);
      
      for (let i = 1; i < state.currentPath.length; i++) {
        const screen = imageToScreen(state.currentPath[i].x, state.currentPath[i].y);
        ctx.lineTo(screen.x, screen.y);
      }
      
      ctx.strokeStyle = engineSettings.pathColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw preview path
    if (state.previewPath.length > 1) {
      ctx.beginPath();
      const firstScreen = imageToScreen(state.previewPath[0].x, state.previewPath[0].y);
      ctx.moveTo(firstScreen.x, firstScreen.y);
      
      for (let i = 1; i < state.previewPath.length; i++) {
        const screen = imageToScreen(state.previewPath[i].x, state.previewPath[i].y);
        ctx.lineTo(screen.x, screen.y);
      }
      
      ctx.strokeStyle = engineSettings.previewColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw anchors with variation-specific styling
    for (let i = 0; i < state.anchors.length; i++) {
      const anchor = state.anchors[i];
      const screen = imageToScreen(anchor.point.x, anchor.point.y);
      
      ctx.beginPath();
      
      // Different colors based on variation and anchor state
      let color = '#ffffff';
      let size = engineSettings.nodeSize;
      
      switch (engineSettings.variation) {
        case 'classic':
          color = '#00ffff';
          break;
        case 'photoshop':
          color = '#ff4444';
          size = engineSettings.nodeSize * 0.8;
          break;
        case 'elastic':
          // Gradient from yellow (elastic) to green (locked)
          if (engineSettings.showElasticGradient) {
            const hue = 60 - anchor.strength * 60; // Yellow to green
            color = `hsl(${hue}, 100%, 50%)`;
          } else {
            color = anchor.locked ? '#44ff44' : '#ffff44';
          }
          break;
        case 'predictive':
          color = '#66ccff';
          break;
      }
      
      ctx.arc(screen.x, screen.y, size, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // First anchor gets special marker
      if (i === 0) {
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, size + 3, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Draw edge trail point
    if (engineSettings.showEdgeTrail) {
      const edgeTrailPoint = engine.getEdgeTrailPoint();
      if (edgeTrailPoint) {
        const screen = imageToScreen(edgeTrailPoint.x, edgeTrailPoint.y);
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, engineSettings.nodeSize + 2, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd700';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Draw prediction zone for predictive mode
    if (engineSettings.variation === 'predictive' && engineSettings.showPredictionZone) {
      const predictionZone = engine.getPredictionZone();
      if (predictionZone) {
        const screen = imageToScreen(predictionZone.center.x, predictionZone.center.y);
        
        ctx.save();
        ctx.translate(screen.x, screen.y);
        ctx.rotate(predictionZone.angle);
        
        ctx.beginPath();
        ctx.ellipse(0, 0, predictionZone.width * zoom / 2, predictionZone.height * zoom / 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 165, 0, 0.2)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 165, 0, 0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.restore();
      }
    }

    // Draw cursor stabilization circle
    if (state.isActive) {
      const lastAnchor = state.anchors[state.anchors.length - 1];
      if (lastAnchor) {
        const cursorHistory = state.cursorHistory;
        if (cursorHistory.length > 0) {
          const currentPos = cursorHistory[cursorHistory.length - 1];
          const screen = imageToScreen(currentPos.x, currentPos.y);
          
          // Outer cursor circle
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, engineSettings.cursorRadius * zoom, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    setLassoState(state);
    onMetricsUpdate(state.metrics);
  }, [imageToScreen, onMetricsUpdate]);

  // Animation loop
  useEffect(() => {
    if (!isActive) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const animate = () => {
      render();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, render]);

  // Handle mouse events
  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (!isActive || !engineRef.current || !canvas) return;
    if (e.button !== 0) return; // Only left click
    
    const imagePos = screenToImage(e.clientX, e.clientY);
    const state = engineRef.current.getState();
    
    if (!state.isActive) {
      // Start new lasso
      engineRef.current.start(imagePos);
    } else {
      // Add anchor (for manual modes)
      if (settings.variation === 'classic') {
        engineRef.current.addAnchor(imagePos);
      }
    }
  }, [isActive, canvas, screenToImage, settings.variation]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isActive || !engineRef.current || !canvas) return;
    
    const state = engineRef.current.getState();
    if (!state.isActive) return;
    
    const imagePos = screenToImage(e.clientX, e.clientY);
    engineRef.current.update(imagePos);
  }, [isActive, canvas, screenToImage]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    // Not used for lasso - handled by clicks
  }, []);

  const handleDoubleClick = useCallback((e: MouseEvent) => {
    if (!isActive || !engineRef.current) return;
    
    const state = engineRef.current.getState();
    if (!state.isActive) return;
    
    // Complete the path
    const finalPath = engineRef.current.complete(true);
    onComplete(finalPath);
  }, [isActive, onComplete]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isActive || !engineRef.current) return;
    
    const state = engineRef.current.getState();
    
    switch (e.key) {
      case 'Escape':
        engineRef.current.cancel();
        onCancel();
        break;
      case 'Backspace':
      case 'Delete':
        if (state.isActive) {
          engineRef.current.removeLastAnchor();
        }
        break;
      case 'Enter':
        if (state.isActive) {
          const finalPath = engineRef.current.complete(true);
          onComplete(finalPath);
        }
        break;
    }
  }, [isActive, onComplete, onCancel]);

  // Attach event listeners
  useEffect(() => {
    if (!canvas || !isActive) return;

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('dblclick', handleDoubleClick);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('dblclick', handleDoubleClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [canvas, isActive, handleMouseDown, handleMouseMove, handleMouseUp, handleDoubleClick, handleKeyDown]);

  // Resize overlay when canvas resizes
  useEffect(() => {
    if (!canvas || !overlayCanvasRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (overlayCanvasRef.current && canvas) {
        overlayCanvasRef.current.width = canvas.width;
        overlayCanvasRef.current.height = canvas.height;
      }
    });

    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, [canvas]);

  // Re-render when pan/zoom changes
  useEffect(() => {
    render();
  }, [panX, panY, zoom, render]);

  return null; // This component renders to an overlay canvas
}
