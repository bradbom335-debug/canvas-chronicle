// V3 Image Editor - Crop Tool Component

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { Point, Rectangle, CANVAS_WIDTH, CANVAS_HEIGHT } from '@/types/editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, X, RotateCcw, Lock, Unlock } from 'lucide-react';
import { cn } from '@/lib/utils';

type AnchorPoint = 'top-left' | 'top' | 'top-right' | 'left' | 'center' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right';

interface CropState {
  isActive: boolean;
  bounds: Rectangle;
  anchor: AnchorPoint;
  aspectLocked: boolean;
  aspectRatio: number;
}

const ANCHOR_POSITIONS: Record<AnchorPoint, { x: number; y: number }> = {
  'top-left': { x: 0, y: 0 },
  'top': { x: 0.5, y: 0 },
  'top-right': { x: 1, y: 0 },
  'left': { x: 0, y: 0.5 },
  'center': { x: 0.5, y: 0.5 },
  'right': { x: 1, y: 0.5 },
  'bottom-left': { x: 0, y: 1 },
  'bottom': { x: 0.5, y: 1 },
  'bottom-right': { x: 1, y: 1 },
};

interface CropToolProps {
  onApply: (bounds: Rectangle) => void;
  onCancel: () => void;
}

export function CropTool({ onApply, onCancel }: CropToolProps) {
  const { state } = useEditor();
  const { project } = state;
  
  const [cropState, setCropState] = useState<CropState>({
    isActive: true,
    bounds: { x: 0, y: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
    anchor: 'center',
    aspectLocked: false,
    aspectRatio: CANVAS_WIDTH / CANVAS_HEIGHT,
  });

  const handleBoundsChange = useCallback((updates: Partial<Rectangle>) => {
    setCropState(prev => ({
      ...prev,
      bounds: { ...prev.bounds, ...updates },
    }));
  }, []);

  const handleAnchorChange = useCallback((anchor: AnchorPoint) => {
    setCropState(prev => ({ ...prev, anchor }));
  }, []);

  const handleApply = useCallback(() => {
    onApply(cropState.bounds);
  }, [cropState.bounds, onApply]);

  const handleReset = useCallback(() => {
    setCropState(prev => ({
      ...prev,
      bounds: { x: 0, y: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
    }));
  }, []);

  const toggleAspectLock = useCallback(() => {
    setCropState(prev => ({
      ...prev,
      aspectLocked: !prev.aspectLocked,
      aspectRatio: prev.bounds.width / prev.bounds.height,
    }));
  }, []);

  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <span>Crop & Resize</span>
      </div>

      {/* Dimensions */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-2xs">Width</Label>
          <Input
            type="number"
            value={cropState.bounds.width}
            onChange={(e) => {
              const width = parseInt(e.target.value) || 1;
              const height = cropState.aspectLocked 
                ? Math.round(width / cropState.aspectRatio)
                : cropState.bounds.height;
              handleBoundsChange({ width, height });
            }}
            min={1}
            max={CANVAS_WIDTH * 2}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-2xs">Height</Label>
          <Input
            type="number"
            value={cropState.bounds.height}
            onChange={(e) => {
              const height = parseInt(e.target.value) || 1;
              const width = cropState.aspectLocked
                ? Math.round(height * cropState.aspectRatio)
                : cropState.bounds.width;
              handleBoundsChange({ width, height });
            }}
            min={1}
            max={CANVAS_HEIGHT * 2}
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* Aspect lock */}
      <div className="flex items-center justify-between">
        <Label className="text-xs">Lock aspect ratio</Label>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={toggleAspectLock}
        >
          {cropState.aspectLocked ? (
            <Lock className="w-3.5 h-3.5 text-primary" />
          ) : (
            <Unlock className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </Button>
      </div>

      {/* Anchor point selector */}
      <div className="space-y-2">
        <Label className="text-xs">Anchor Point</Label>
        <AnchorSelector
          selected={cropState.anchor}
          onChange={handleAnchorChange}
        />
      </div>

      {/* Position */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-2xs">X Position</Label>
          <Input
            type="number"
            value={cropState.bounds.x}
            onChange={(e) => handleBoundsChange({ x: parseInt(e.target.value) || 0 })}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-2xs">Y Position</Label>
          <Input
            type="number"
            value={cropState.bounds.y}
            onChange={(e) => handleBoundsChange({ y: parseInt(e.target.value) || 0 })}
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* Preset sizes */}
      <div className="space-y-2">
        <Label className="text-xs">Presets</Label>
        <div className="grid grid-cols-3 gap-1">
          {[
            { label: '16:9', w: 1920, h: 1080 },
            { label: '4:3', w: 1600, h: 1200 },
            { label: '1:1', w: 1080, h: 1080 },
            { label: 'HD', w: 1280, h: 720 },
            { label: '2K', w: 2560, h: 1440 },
            { label: '4K', w: 3840, h: 2160 },
          ].map(preset => (
            <Button
              key={preset.label}
              variant="outline"
              size="sm"
              className="h-7 text-2xs"
              onClick={() => handleBoundsChange({ width: preset.w, height: preset.h })}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1"
          onClick={handleReset}
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1" />
          Reset
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
        >
          <X className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="sm"
          onClick={handleApply}
        >
          <Check className="w-3.5 h-3.5 mr-1" />
          Apply
        </Button>
      </div>
    </div>
  );
}

// Anchor point selector component
interface AnchorSelectorProps {
  selected: AnchorPoint;
  onChange: (anchor: AnchorPoint) => void;
}

function AnchorSelector({ selected, onChange }: AnchorSelectorProps) {
  const anchors: AnchorPoint[] = [
    'top-left', 'top', 'top-right',
    'left', 'center', 'right',
    'bottom-left', 'bottom', 'bottom-right',
  ];

  return (
    <div className="grid grid-cols-3 gap-0.5 w-16 h-16 p-1 bg-muted/50 rounded-md">
      {anchors.map(anchor => (
        <button
          key={anchor}
          className={cn(
            'w-4 h-4 rounded-sm transition-all duration-150',
            'hover:bg-primary/30',
            selected === anchor 
              ? 'bg-primary shadow-sm shadow-primary/50' 
              : 'bg-muted-foreground/30'
          )}
          onClick={() => onChange(anchor)}
          title={anchor.replace('-', ' ')}
        />
      ))}
    </div>
  );
}

// Canvas resize utility
export function resizeCanvas(
  layers: any[],
  newWidth: number,
  newHeight: number,
  anchor: AnchorPoint
): any[] {
  const anchorPos = ANCHOR_POSITIONS[anchor];
  
  // Calculate offset based on anchor
  const offsetX = Math.round((newWidth - CANVAS_WIDTH) * anchorPos.x);
  const offsetY = Math.round((newHeight - CANVAS_HEIGHT) * anchorPos.y);
  
  // Update layer bounds
  return layers.map(layer => ({
    ...layer,
    bounds: {
      ...layer.bounds,
      x: layer.bounds.x + offsetX,
      y: layer.bounds.y + offsetY,
    },
  }));
}

// Crop layers to bounds
export function cropLayers(
  layers: any[],
  cropBounds: Rectangle
): any[] {
  return layers.map(layer => {
    if (!layer.imageData) return layer;
    
    // Calculate intersection
    const layerRight = layer.bounds.x + layer.bounds.width;
    const layerBottom = layer.bounds.y + layer.bounds.height;
    const cropRight = cropBounds.x + cropBounds.width;
    const cropBottom = cropBounds.y + cropBounds.height;
    
    const intersectX = Math.max(layer.bounds.x, cropBounds.x);
    const intersectY = Math.max(layer.bounds.y, cropBounds.y);
    const intersectRight = Math.min(layerRight, cropRight);
    const intersectBottom = Math.min(layerBottom, cropBottom);
    
    if (intersectRight <= intersectX || intersectBottom <= intersectY) {
      // Layer is completely outside crop area
      return { ...layer, visible: false };
    }
    
    // Adjust layer position relative to new canvas origin
    return {
      ...layer,
      bounds: {
        ...layer.bounds,
        x: layer.bounds.x - cropBounds.x,
        y: layer.bounds.y - cropBounds.y,
      },
    };
  });
}
