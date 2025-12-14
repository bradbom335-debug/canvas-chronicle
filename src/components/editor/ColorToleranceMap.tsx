import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { RotateCcw, Plus, Minus, Eye, EyeOff } from 'lucide-react';

interface ColorPoint {
  x: number; // 0-1 hue position
  y: number; // 0-1 saturation/lightness position
}

interface BezierHandle {
  x: number;
  y: number;
}

interface ToleranceCurvePoint {
  position: ColorPoint;
  handleIn: BezierHandle;
  handleOut: BezierHandle;
}

interface SegmentPixelData {
  seedColor: { h: number; s: number; l: number };
  pixelsInRange: Array<{ h: number; s: number; l: number; count: number }>;
  toleranceRadius: number;
}

export const ColorToleranceMap: React.FC = () => {
  const { state, updateToolSettings } = useEditor();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [curvePoints, setCurvePoints] = useState<ToleranceCurvePoint[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTarget, setDragTarget] = useState<'point' | 'handleIn' | 'handleOut' | null>(null);
  const [segmentData, setSegmentData] = useState<SegmentPixelData | null>(null);
  const [showPixelCloud, setShowPixelCloud] = useState(true);
  const [showToleranceCurve, setShowToleranceCurve] = useState(true);
  const [hoverPosition, setHoverPosition] = useState<ColorPoint | null>(null);
  
  const tolerance = state.toolSettings.magicWand?.tolerance ?? 32;
  const mapWidth = 280;
  const mapHeight = 200;

  // Render the HSL color map with perfect gradients
  const renderColorMap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Create SVG-quality gradients using multiple passes
    const imageData = ctx.createImageData(mapWidth, mapHeight);
    const data = imageData.data;

    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const hue = (x / mapWidth) * 360;
        const saturation = 100;
        
        // Y axis: top = white (100% lightness), middle = color (50%), bottom = black (0%)
        let lightness: number;
        const normalizedY = y / mapHeight;
        
        if (normalizedY < 0.5) {
          // Top half: white to full color
          lightness = 100 - (normalizedY * 100);
        } else {
          // Bottom half: full color to black
          lightness = 50 - ((normalizedY - 0.5) * 100);
        }

        // Also add saturation gradient: left edge can be desaturated
        const effectiveSaturation = saturation;
        
        const rgb = hslToRgb(hue, effectiveSaturation, Math.max(0, Math.min(100, lightness)));
        const idx = (y * mapWidth + x) * 4;
        data[idx] = rgb.r;
        data[idx + 1] = rgb.g;
        data[idx + 2] = rgb.b;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }, [mapWidth, mapHeight]);

  // Render overlay with tolerance curve, pixel cloud, and seed point
  const renderOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, mapWidth, mapHeight);

    // Draw pixel cloud if segment data exists
    if (segmentData && showPixelCloud) {
      ctx.globalAlpha = 0.6;
      
      segmentData.pixelsInRange.forEach(pixel => {
        const x = (pixel.h / 360) * mapWidth;
        const y = lightnessToY(pixel.l);
        const size = Math.max(1, Math.min(4, Math.sqrt(pixel.count) * 0.5));
        
        ctx.fillStyle = `hsl(${pixel.h}, ${pixel.s}%, ${pixel.l}%)`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      });
      
      ctx.globalAlpha = 1;
    }

    // Draw tolerance curve
    if (showToleranceCurve && curvePoints.length > 0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      
      ctx.beginPath();
      
      if (curvePoints.length === 1) {
        // Single point - draw circle
        const p = curvePoints[0];
        const radius = (tolerance / 255) * mapWidth * 0.3;
        ctx.arc(p.position.x * mapWidth, p.position.y * mapHeight, radius, 0, Math.PI * 2);
      } else {
        // Multiple points - draw bezier curve
        ctx.moveTo(curvePoints[0].position.x * mapWidth, curvePoints[0].position.y * mapHeight);
        
        for (let i = 0; i < curvePoints.length - 1; i++) {
          const p1 = curvePoints[i];
          const p2 = curvePoints[i + 1];
          
          const cp1x = (p1.position.x + p1.handleOut.x) * mapWidth;
          const cp1y = (p1.position.y + p1.handleOut.y) * mapHeight;
          const cp2x = (p2.position.x + p2.handleIn.x) * mapWidth;
          const cp2y = (p2.position.y + p2.handleIn.y) * mapHeight;
          
          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.position.x * mapWidth, p2.position.y * mapHeight);
        }
        
        // Close the curve
        if (curvePoints.length > 2) {
          const last = curvePoints[curvePoints.length - 1];
          const first = curvePoints[0];
          
          const cp1x = (last.position.x + last.handleOut.x) * mapWidth;
          const cp1y = (last.position.y + last.handleOut.y) * mapHeight;
          const cp2x = (first.position.x + first.handleIn.x) * mapWidth;
          const cp2y = (first.position.y + first.handleIn.y) * mapHeight;
          
          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, first.position.x * mapWidth, first.position.y * mapHeight);
        }
      }
      
      ctx.stroke();
      
      // Draw glow effect
      ctx.strokeStyle = 'rgba(100, 200, 255, 0.5)';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Draw control points and handles
      curvePoints.forEach((point, idx) => {
        const px = point.position.x * mapWidth;
        const py = point.position.y * mapHeight;
        
        // Draw handles
        if (selectedPoint === idx) {
          ctx.strokeStyle = 'rgba(255, 200, 100, 0.8)';
          ctx.lineWidth = 1;
          
          // Handle in
          const hInX = (point.position.x + point.handleIn.x) * mapWidth;
          const hInY = (point.position.y + point.handleIn.y) * mapHeight;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(hInX, hInY);
          ctx.stroke();
          
          ctx.fillStyle = 'rgba(255, 200, 100, 0.9)';
          ctx.beginPath();
          ctx.arc(hInX, hInY, 4, 0, Math.PI * 2);
          ctx.fill();
          
          // Handle out
          const hOutX = (point.position.x + point.handleOut.x) * mapWidth;
          const hOutY = (point.position.y + point.handleOut.y) * mapHeight;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(hOutX, hOutY);
          ctx.stroke();
          
          ctx.fillStyle = 'rgba(255, 200, 100, 0.9)';
          ctx.beginPath();
          ctx.arc(hOutX, hOutY, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Draw main control point
        ctx.fillStyle = selectedPoint === idx ? '#FFD700' : '#FFFFFF';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }

    // Draw seed color marker
    if (segmentData) {
      const seedX = (segmentData.seedColor.h / 360) * mapWidth;
      const seedY = lightnessToY(segmentData.seedColor.l);
      
      // Crosshair
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      
      ctx.beginPath();
      ctx.moveTo(seedX - 12, seedY);
      ctx.lineTo(seedX + 12, seedY);
      ctx.moveTo(seedX, seedY - 12);
      ctx.lineTo(seedX, seedY + 12);
      ctx.stroke();
      
      ctx.setLineDash([]);
      
      // Center dot
      ctx.fillStyle = `hsl(${segmentData.seedColor.h}, ${segmentData.seedColor.s}%, ${segmentData.seedColor.l}%)`;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(seedX, seedY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Tolerance radius circle
      const toleranceRadius = (segmentData.toleranceRadius / 255) * mapWidth * 0.4;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(seedX, seedY, toleranceRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw hover position
    if (hoverPosition) {
      const hx = hoverPosition.x * mapWidth;
      const hy = hoverPosition.y * mapHeight;
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(hx, 0);
      ctx.lineTo(hx, mapHeight);
      ctx.moveTo(0, hy);
      ctx.lineTo(mapWidth, hy);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [segmentData, showPixelCloud, showToleranceCurve, curvePoints, selectedPoint, tolerance, hoverPosition, mapWidth, mapHeight]);

  // Helper: Convert lightness to Y position
  const lightnessToY = (l: number): number => {
    // l: 0-100, where 100=white (top), 50=middle, 0=black (bottom)
    if (l >= 50) {
      return ((100 - l) / 50) * (mapHeight / 2);
    } else {
      return (mapHeight / 2) + ((50 - l) / 50) * (mapHeight / 2);
    }
  };

  // Helper: Convert Y to lightness
  const yToLightness = (y: number): number => {
    const normalizedY = y / mapHeight;
    if (normalizedY < 0.5) {
      return 100 - (normalizedY * 100);
    } else {
      return 50 - ((normalizedY - 0.5) * 100);
    }
  };

  // Initialize default tolerance curve
  const initializeDefaultCurve = useCallback(() => {
    if (!segmentData) return;
    
    const seedX = segmentData.seedColor.h / 360;
    const seedY = lightnessToY(segmentData.seedColor.l) / mapHeight;
    const radius = (tolerance / 255) * 0.15;
    
    // Create ellipse-like curve around seed point
    const points: ToleranceCurvePoint[] = [
      {
        position: { x: seedX, y: Math.max(0, seedY - radius) },
        handleIn: { x: -radius * 0.55, y: 0 },
        handleOut: { x: radius * 0.55, y: 0 }
      },
      {
        position: { x: Math.min(1, seedX + radius), y: seedY },
        handleIn: { x: 0, y: -radius * 0.55 },
        handleOut: { x: 0, y: radius * 0.55 }
      },
      {
        position: { x: seedX, y: Math.min(1, seedY + radius) },
        handleIn: { x: radius * 0.55, y: 0 },
        handleOut: { x: -radius * 0.55, y: 0 }
      },
      {
        position: { x: Math.max(0, seedX - radius), y: seedY },
        handleIn: { x: 0, y: radius * 0.55 },
        handleOut: { x: 0, y: -radius * 0.55 }
      }
    ];
    
    setCurvePoints(points);
  }, [segmentData, tolerance, mapHeight]);

  // Mouse event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = (e.clientX - rect.left) / mapWidth;
    const y = (e.clientY - rect.top) / mapHeight;
    
    // Check if clicking on a control point or handle
    for (let i = 0; i < curvePoints.length; i++) {
      const point = curvePoints[i];
      const px = point.position.x;
      const py = point.position.y;
      
      // Check main point
      if (Math.abs(x - px) < 0.03 && Math.abs(y - py) < 0.04) {
        setSelectedPoint(i);
        setDragTarget('point');
        setIsDragging(true);
        return;
      }
      
      // Check handles if selected
      if (selectedPoint === i) {
        const hInX = px + point.handleIn.x;
        const hInY = py + point.handleIn.y;
        if (Math.abs(x - hInX) < 0.025 && Math.abs(y - hInY) < 0.035) {
          setDragTarget('handleIn');
          setIsDragging(true);
          return;
        }
        
        const hOutX = px + point.handleOut.x;
        const hOutY = py + point.handleOut.y;
        if (Math.abs(x - hOutX) < 0.025 && Math.abs(y - hOutY) < 0.035) {
          setDragTarget('handleOut');
          setIsDragging(true);
          return;
        }
      }
    }
    
    // If shift-click, add new point
    if (e.shiftKey) {
      const newPoint: ToleranceCurvePoint = {
        position: { x, y },
        handleIn: { x: -0.05, y: 0 },
        handleOut: { x: 0.05, y: 0 }
      };
      setCurvePoints([...curvePoints, newPoint]);
      setSelectedPoint(curvePoints.length);
    }
  }, [curvePoints, selectedPoint, mapWidth, mapHeight]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / mapWidth));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / mapHeight));
    
    setHoverPosition({ x, y });
    
    if (!isDragging || selectedPoint === null) return;
    
    setCurvePoints(prev => {
      const updated = [...prev];
      const point = { ...updated[selectedPoint] };
      
      if (dragTarget === 'point') {
        point.position = { x, y };
      } else if (dragTarget === 'handleIn') {
        point.handleIn = { 
          x: x - point.position.x, 
          y: y - point.position.y 
        };
      } else if (dragTarget === 'handleOut') {
        point.handleOut = { 
          x: x - point.position.x, 
          y: y - point.position.y 
        };
      }
      
      updated[selectedPoint] = point;
      return updated;
    });
  }, [isDragging, selectedPoint, dragTarget, mapWidth, mapHeight]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragTarget(null);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoverPosition(null);
    setIsDragging(false);
    setDragTarget(null);
  }, []);

  // Delete selected point
  const deleteSelectedPoint = useCallback(() => {
    if (selectedPoint !== null && curvePoints.length > 3) {
      setCurvePoints(prev => prev.filter((_, i) => i !== selectedPoint));
      setSelectedPoint(null);
    }
  }, [selectedPoint, curvePoints.length]);

  // Generate sample segment data for demo
  useEffect(() => {
    // Listen for segment creation events from EditorCanvas
    const handleSegmentCreated = (e: CustomEvent<SegmentPixelData>) => {
      setSegmentData(e.detail);
      initializeDefaultCurve();
    };
    
    window.addEventListener('segmentCreated' as any, handleSegmentCreated);
    
    // Demo data for visualization
    if (!segmentData) {
      setSegmentData({
        seedColor: { h: 200, s: 70, l: 50 },
        pixelsInRange: [
          { h: 195, s: 65, l: 48, count: 150 },
          { h: 205, s: 72, l: 52, count: 120 },
          { h: 198, s: 68, l: 45, count: 200 },
          { h: 202, s: 75, l: 55, count: 80 },
          { h: 190, s: 60, l: 42, count: 100 },
          { h: 210, s: 78, l: 58, count: 60 },
        ],
        toleranceRadius: tolerance
      });
    }
    
    return () => {
      window.removeEventListener('segmentCreated' as any, handleSegmentCreated);
    };
  }, [tolerance, segmentData, initializeDefaultCurve]);

  // Update curve when tolerance changes
  useEffect(() => {
    if (segmentData && curvePoints.length === 0) {
      initializeDefaultCurve();
    }
  }, [segmentData, curvePoints.length, initializeDefaultCurve]);

  // Render effects
  useEffect(() => {
    renderColorMap();
  }, [renderColorMap]);

  useEffect(() => {
    renderOverlay();
  }, [renderOverlay]);

  return (
    <div className="space-y-4 p-3 bg-background/50 rounded-lg border border-border/50">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Color Tolerance Map</Label>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setShowPixelCloud(!showPixelCloud)}
            title={showPixelCloud ? "Hide pixel cloud" : "Show pixel cloud"}
          >
            {showPixelCloud ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={initializeDefaultCurve}
            title="Reset curve"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      </div>
      
      <div 
        ref={containerRef}
        className="relative rounded-lg overflow-hidden border border-border shadow-lg"
        style={{ width: mapWidth, height: mapHeight }}
      >
        <canvas
          ref={canvasRef}
          width={mapWidth}
          height={mapHeight}
          className="absolute inset-0"
        />
        <canvas
          ref={overlayRef}
          width={mapWidth}
          height={mapHeight}
          className="absolute inset-0 cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />
      </div>

      {hoverPosition && (
        <div className="text-xs text-muted-foreground font-mono">
          H: {Math.round(hoverPosition.x * 360)}° | L: {Math.round(yToLightness(hoverPosition.y * mapHeight))}%
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Show Tolerance Curve</Label>
          <Switch
            checked={showToleranceCurve}
            onCheckedChange={setShowToleranceCurve}
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Base Tolerance</Label>
            <span className="text-xs text-muted-foreground font-mono">{tolerance}</span>
          </div>
          <Slider
            value={[tolerance]}
            min={0}
            max={255}
            step={1}
            onValueChange={([v]) => updateToolSettings({ magicWand: { ...state.toolSettings.magicWand, tolerance: v } })}
            className="w-full"
          />
        </div>

        {curvePoints.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs h-7"
              onClick={() => {
                const newPoint: ToleranceCurvePoint = {
                  position: { x: 0.5, y: 0.5 },
                  handleIn: { x: -0.05, y: 0 },
                  handleOut: { x: 0.05, y: 0 }
                };
                setCurvePoints([...curvePoints, newPoint]);
              }}
            >
              <Plus className="h-3 w-3 mr-1" /> Add Point
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs h-7"
              onClick={deleteSelectedPoint}
              disabled={selectedPoint === null || curvePoints.length <= 3}
            >
              <Minus className="h-3 w-3 mr-1" /> Remove
            </Button>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Click + drag points to adjust tolerance shape</p>
          <p>• Select point to show bezier handles</p>
          <p>• Shift+click to add new control points</p>
        </div>
      </div>
    </div>
  );
};

// HSL to RGB conversion helper
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return {
    r: Math.round(f(0) * 255),
    g: Math.round(f(8) * 255),
    b: Math.round(f(4) * 255)
  };
}

export default ColorToleranceMap;
