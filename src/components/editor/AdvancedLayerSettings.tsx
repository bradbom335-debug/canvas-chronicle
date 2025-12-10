// V3 Image Editor - Advanced Layer Settings Panel

import React from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BlendMode } from '@/types/editor';
import { RotateCcw, FlipHorizontal, FlipVertical } from 'lucide-react';

const BLEND_MODES: { value: BlendMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'soft-light', label: 'Soft Light' },
  { value: 'hard-light', label: 'Hard Light' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
];

export function AdvancedLayerSettings() {
  const { state, updateLayer } = useEditor();
  const { project } = state;
  
  const activeLayer = project.layers.find(l => l.id === project.activeLayerId);

  if (!activeLayer) {
    return (
      <div className="p-3">
        <p className="text-sm text-muted-foreground">
          Select a layer to see advanced settings
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4">
      {/* Layer Info */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Layer Name</Label>
        <Input
          value={activeLayer.name}
          onChange={(e) => updateLayer(activeLayer.id, { name: e.target.value })}
          className="h-8"
        />
      </div>

      <Separator />

      {/* Blend Mode */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Blend Mode</Label>
        <Select 
          value={activeLayer.blendMode}
          onValueChange={(v) => updateLayer(activeLayer.id, { blendMode: v as BlendMode })}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BLEND_MODES.map(mode => (
              <SelectItem key={mode.value} value={mode.value}>
                {mode.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Opacity */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Opacity</Label>
          <span className="text-xs text-muted-foreground">
            {Math.round(activeLayer.opacity * 100)}%
          </span>
        </div>
        <Slider
          value={[activeLayer.opacity * 100]}
          min={0}
          max={100}
          step={1}
          onValueChange={([v]) => updateLayer(activeLayer.id, { opacity: v / 100 })}
          className="py-1"
        />
      </div>

      <Separator />

      {/* Transform */}
      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground">Transform</Label>
        
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">X</Label>
            <Input
              type="number"
              value={Math.round(activeLayer.bounds.x)}
              onChange={(e) => updateLayer(activeLayer.id, { 
                bounds: { ...activeLayer.bounds, x: Number(e.target.value) }
              })}
              className="h-7 text-xs"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Y</Label>
            <Input
              type="number"
              value={Math.round(activeLayer.bounds.y)}
              onChange={(e) => updateLayer(activeLayer.id, { 
                bounds: { ...activeLayer.bounds, y: Number(e.target.value) }
              })}
              className="h-7 text-xs"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Width</Label>
            <Input
              type="number"
              value={activeLayer.bounds.width}
              className="h-7 text-xs"
              readOnly
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Height</Label>
            <Input
              type="number"
              value={activeLayer.bounds.height}
              className="h-7 text-xs"
              readOnly
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 h-7 text-xs">
            <FlipHorizontal className="h-3 w-3 mr-1" />
            Flip H
          </Button>
          <Button variant="outline" size="sm" className="flex-1 h-7 text-xs">
            <FlipVertical className="h-3 w-3 mr-1" />
            Flip V
          </Button>
          <Button variant="outline" size="sm" className="flex-1 h-7 text-xs">
            <RotateCcw className="h-3 w-3 mr-1" />
            90°
          </Button>
        </div>
      </div>

      <Separator />

      {/* Layer Options */}
      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground">Options</Label>
        
        <div className="flex items-center justify-between">
          <Label className="text-xs">Lock Position</Label>
          <Switch
            checked={activeLayer.locked}
            onCheckedChange={(v) => updateLayer(activeLayer.id, { locked: v })}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <Label className="text-xs">Visible</Label>
          <Switch
            checked={activeLayer.visible}
            onCheckedChange={(v) => updateLayer(activeLayer.id, { visible: v })}
          />
        </div>
      </div>

      <Separator />

      {/* Layer Stats */}
      <div className="space-y-2 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Type:</span>
          <span className="capitalize">{activeLayer.type}</span>
        </div>
        <div className="flex justify-between">
          <span>Modifiers:</span>
          <span>{activeLayer.modifiers.length}</span>
        </div>
        <div className="flex justify-between">
          <span>Created:</span>
          <span>{new Date(activeLayer.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}
