// V3 Image Editor - Advanced Tool Settings Panel

import React from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Zap, Eye, Gauge, Waves } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AdvancedToolSettings() {
  const { state, updateToolSettings } = useEditor();
  const { activeTool, toolSettings } = state;

  if (activeTool !== 'magic-wand') {
    return (
      <div className="p-3">
        <p className="text-sm text-muted-foreground">
          Select Magic Wand tool to see advanced settings
        </p>
      </div>
    );
  }

  const wandSettings = toolSettings.magicWand;

  const updateMagicWand = (updates: Partial<typeof wandSettings>) => {
    updateToolSettings({
      magicWand: { ...wandSettings, ...updates },
    });
  };

  return (
    <div className="p-3 space-y-4">
      {/* Preview Mode Section */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center gap-2 w-full text-left group">
          <ChevronDown className="h-4 w-4 transition-transform group-data-[state=closed]:-rotate-90" />
          <Eye className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Preview Mode</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Preview Type</Label>
            <Select 
              value={wandSettings.previewMode || 'expanding'}
              onValueChange={(v) => updateMagicWand({ previewMode: v as any })}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instant">Instant (No Animation)</SelectItem>
                <SelectItem value="expanding">Expanding Wave</SelectItem>
                <SelectItem value="fast">Fast Expand</SelectItem>
                <SelectItem value="off">Preview Off</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Preview Quality</Label>
              <span className="text-xs text-muted-foreground">
                {wandSettings.previewQuality || 100}%
              </span>
            </div>
            <Slider
              value={[wandSettings.previewQuality || 100]}
              min={25}
              max={100}
              step={25}
              onValueChange={([v]) => updateMagicWand({ previewQuality: v })}
              className="py-1"
            />
            <p className="text-xs text-muted-foreground">
              Lower quality = faster preview
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">Show Marching Ants</Label>
            <Switch
              checked={wandSettings.showMarchingAnts ?? true}
              onCheckedChange={(v) => updateMagicWand({ showMarchingAnts: v })}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Speed & Performance */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center gap-2 w-full text-left group">
          <ChevronDown className="h-4 w-4 transition-transform group-data-[state=closed]:-rotate-90" />
          <Zap className="h-4 w-4 text-yellow-500" />
          <span className="text-sm font-medium">Speed & Performance</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Batch Size</Label>
              <span className="text-xs text-muted-foreground">
                {wandSettings.batchSize || 5000} px/frame
              </span>
            </div>
            <Slider
              value={[wandSettings.batchSize || 5000]}
              min={1000}
              max={50000}
              step={1000}
              onValueChange={([v]) => updateMagicWand({ batchSize: v })}
              className="py-1"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Max Pixels</Label>
              <span className="text-xs text-muted-foreground">
                {((wandSettings.maxPixels || 500000) / 1000).toFixed(0)}K
              </span>
            </div>
            <Slider
              value={[wandSettings.maxPixels || 500000]}
              min={50000}
              max={2000000}
              step={50000}
              onValueChange={([v]) => updateMagicWand({ maxPixels: v })}
              className="py-1"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">Use Web Worker</Label>
            <Switch
              checked={wandSettings.useWorker ?? false}
              onCheckedChange={(v) => updateMagicWand({ useWorker: v })}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Algorithm Settings */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center gap-2 w-full text-left group">
          <ChevronDown className="h-4 w-4 transition-transform group-data-[state=closed]:-rotate-90" />
          <Gauge className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium">Algorithm</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Connectivity</Label>
            <Select 
              value={String(wandSettings.connectivity || 4)}
              onValueChange={(v) => updateMagicWand({ connectivity: Number(v) as 4 | 8 })}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4">4-Connected (Cardinal)</SelectItem>
                <SelectItem value="8">8-Connected (Diagonal)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Color Space</Label>
            <Select 
              value={wandSettings.colorSpace || 'rgb'}
              onValueChange={(v) => updateMagicWand({ colorSpace: v as any })}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rgb">RGB (Standard)</SelectItem>
                <SelectItem value="hsl">HSL (Perceptual)</SelectItem>
                <SelectItem value="lab">LAB (Best Quality)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">Include Alpha Channel</Label>
            <Switch
              checked={wandSettings.includeAlpha ?? false}
              onCheckedChange={(v) => updateMagicWand({ includeAlpha: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">Edge Detection Mode</Label>
            <Switch
              checked={wandSettings.edgeMode ?? false}
              onCheckedChange={(v) => updateMagicWand({ edgeMode: v })}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Feathering & Refinement */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center gap-2 w-full text-left group">
          <ChevronDown className="h-4 w-4 transition-transform group-data-[state=closed]:-rotate-90" />
          <Waves className="h-4 w-4 text-cyan-500" />
          <span className="text-sm font-medium">Edge Refinement</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Feather Radius</Label>
              <span className="text-xs text-muted-foreground">{wandSettings.feather}px</span>
            </div>
            <Slider
              value={[wandSettings.feather]}
              min={0}
              max={50}
              step={1}
              onValueChange={([v]) => updateMagicWand({ feather: v })}
              className="py-1"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Contract/Expand</Label>
              <span className="text-xs text-muted-foreground">
                {(wandSettings.contractExpand || 0) > 0 ? '+' : ''}{wandSettings.contractExpand || 0}px
              </span>
            </div>
            <Slider
              value={[wandSettings.contractExpand || 0]}
              min={-20}
              max={20}
              step={1}
              onValueChange={([v]) => updateMagicWand({ contractExpand: v })}
              className="py-1"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Smooth Edges</Label>
              <span className="text-xs text-muted-foreground">{wandSettings.smoothEdges || 0}px</span>
            </div>
            <Slider
              value={[wandSettings.smoothEdges || 0]}
              min={0}
              max={10}
              step={1}
              onValueChange={([v]) => updateMagicWand({ smoothEdges: v })}
              className="py-1"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">Fill Holes in Segments</Label>
            <Switch
              checked={wandSettings.fillHoles ?? true}
              onCheckedChange={(v) => updateMagicWand({ fillHoles: v })}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
