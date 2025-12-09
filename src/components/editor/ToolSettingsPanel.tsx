// V3 Image Editor - Tool Settings Panel

import React from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Wand2, Paintbrush, Eraser } from 'lucide-react';

export function ToolSettingsPanel() {
  const { state, updateToolSettings } = useEditor();
  const { activeTool, toolSettings } = state;

  return (
    <div className="flex flex-col bg-panel-bg border-b border-panel-border">
      {/* Tool-specific settings */}
      {activeTool === 'magic-wand' && (
        <MagicWandSettings
          settings={toolSettings.magicWand}
          onChange={(updates) =>
            updateToolSettings({
              magicWand: { ...toolSettings.magicWand, ...updates },
            })
          }
        />
      )}

      {activeTool === 'brush' && (
        <BrushSettings
          settings={toolSettings.brush}
          onChange={(updates) =>
            updateToolSettings({
              brush: { ...toolSettings.brush, ...updates },
            })
          }
        />
      )}

      {activeTool === 'eraser' && (
        <BrushSettings
          settings={toolSettings.eraser}
          onChange={(updates) =>
            updateToolSettings({
              eraser: { ...toolSettings.eraser, ...updates },
            })
          }
          isEraser
        />
      )}
    </div>
  );
}

// Magic Wand Settings
interface MagicWandSettingsProps {
  settings: {
    tolerance: number;
    contiguous: boolean;
    antiAlias: boolean;
    feather: number;
    sampleAllLayers: boolean;
  };
  onChange: (updates: Partial<MagicWandSettingsProps['settings']>) => void;
}

function MagicWandSettings({ settings, onChange }: MagicWandSettingsProps) {
  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Wand2 className="w-4 h-4" />
        <span>Magic Wand</span>
      </div>

      {/* Tolerance */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Tolerance</Label>
          <span className="text-xs text-muted-foreground font-mono w-8 text-right">
            {settings.tolerance}
          </span>
        </div>
        <Slider
          value={[settings.tolerance]}
          onValueChange={([v]) => onChange({ tolerance: v })}
          min={0}
          max={255}
          step={1}
        />
      </div>

      {/* Feather */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Feather</Label>
          <span className="text-xs text-muted-foreground font-mono w-8 text-right">
            {settings.feather}px
          </span>
        </div>
        <Slider
          value={[settings.feather]}
          onValueChange={([v]) => onChange({ feather: v })}
          min={0}
          max={50}
          step={1}
        />
      </div>

      {/* Toggles */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Contiguous</Label>
          <Switch
            checked={settings.contiguous}
            onCheckedChange={(v) => onChange({ contiguous: v })}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <Label className="text-xs">Anti-alias</Label>
          <Switch
            checked={settings.antiAlias}
            onCheckedChange={(v) => onChange({ antiAlias: v })}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <Label className="text-xs">Sample all layers</Label>
          <Switch
            checked={settings.sampleAllLayers}
            onCheckedChange={(v) => onChange({ sampleAllLayers: v })}
          />
        </div>
      </div>

      {/* Hint */}
      <div className="pt-2 text-2xs text-muted-foreground/70">
        <p>• Click to select similar colors</p>
        <p>• Alt+click to extract to new layer</p>
        <p>• Scroll to adjust tolerance</p>
      </div>
    </div>
  );
}

// Brush Settings
interface BrushSettingsProps {
  settings: {
    size: number;
    hardness: number;
    opacity: number;
    flow: number;
    color: string;
  };
  onChange: (updates: Partial<BrushSettingsProps['settings']>) => void;
  isEraser?: boolean;
}

function BrushSettings({ settings, onChange, isEraser }: BrushSettingsProps) {
  const Icon = isEraser ? Eraser : Paintbrush;
  const label = isEraser ? 'Eraser' : 'Brush';

  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon className="w-4 h-4" />
        <span>{label}</span>
      </div>

      {/* Size */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Size</Label>
          <span className="text-xs text-muted-foreground font-mono w-12 text-right">
            {settings.size}px
          </span>
        </div>
        <Slider
          value={[settings.size]}
          onValueChange={([v]) => onChange({ size: v })}
          min={1}
          max={500}
          step={1}
        />
      </div>

      {/* Hardness */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Hardness</Label>
          <span className="text-xs text-muted-foreground font-mono w-8 text-right">
            {settings.hardness}%
          </span>
        </div>
        <Slider
          value={[settings.hardness]}
          onValueChange={([v]) => onChange({ hardness: v })}
          min={0}
          max={100}
          step={1}
        />
      </div>

      {/* Opacity */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Opacity</Label>
          <span className="text-xs text-muted-foreground font-mono w-8 text-right">
            {Math.round(settings.opacity * 100)}%
          </span>
        </div>
        <Slider
          value={[settings.opacity * 100]}
          onValueChange={([v]) => onChange({ opacity: v / 100 })}
          min={0}
          max={100}
          step={1}
        />
      </div>

      {/* Flow */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Flow</Label>
          <span className="text-xs text-muted-foreground font-mono w-8 text-right">
            {Math.round(settings.flow * 100)}%
          </span>
        </div>
        <Slider
          value={[settings.flow * 100]}
          onValueChange={([v]) => onChange({ flow: v / 100 })}
          min={0}
          max={100}
          step={1}
        />
      </div>

      {/* Color (only for brush) */}
      {!isEraser && (
        <div className="flex items-center gap-3 pt-2">
          <Label className="text-xs">Color</Label>
          <div
            className="w-8 h-8 rounded border border-border cursor-pointer"
            style={{ backgroundColor: settings.color }}
          />
          <input
            type="color"
            value={settings.color}
            onChange={(e) => onChange({ color: e.target.value })}
            className="w-0 h-0 opacity-0"
            id="brush-color"
          />
        </div>
      )}
    </div>
  );
}
