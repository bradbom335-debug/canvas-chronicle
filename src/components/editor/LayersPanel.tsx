// V3 Image Editor - Layers Panel with Modifier Support

import React, { useCallback, useState } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { Layer, Modifier } from '@/types/editor';
import { 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  Trash2, 
  Copy, 
  ChevronUp, 
  ChevronDown,
  Image,
  Type,
  Square,
  Folder,
  ChevronRight,
  ChevronDown as ChevronDownIcon,
  Palette,
  Scissors,
  Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

export function LayersPanel() {
  const { state, selectLayer, updateLayer, removeLayer } = useEditor();
  const { project } = state;
  const { layers, activeLayerId } = project;
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set());

  const getLayerIcon = (layer: Layer) => {
    if (layer.isSegmentLayer) return Palette;
    switch (layer.type) {
      case 'text': return Type;
      case 'shape': return Square;
      case 'group': return Folder;
      default: return Image;
    }
  };

  const toggleLayerExpand = (layerId: string) => {
    setExpandedLayers(prev => {
      const next = new Set(prev);
      if (next.has(layerId)) {
        next.delete(layerId);
      } else {
        next.add(layerId);
      }
      return next;
    });
  };

  const handleVisibilityToggle = useCallback((layer: Layer) => {
    updateLayer(layer.id, { visible: !layer.visible });
  }, [updateLayer]);

  const handleLockToggle = useCallback((layer: Layer) => {
    updateLayer(layer.id, { locked: !layer.locked });
  }, [updateLayer]);

  const handleOpacityChange = useCallback((layerId: string, value: number[]) => {
    updateLayer(layerId, { opacity: value[0] / 100 });
  }, [updateLayer]);

  const handleModifierOpacityChange = useCallback((layerId: string, modifierId: string, value: number[]) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;
    
    const updatedModifiers = layer.modifiers.map(m =>
      m.id === modifierId ? { ...m, opacity: value[0] / 100 } : m
    );
    updateLayer(layerId, { modifiers: updatedModifiers });
  }, [layers, updateLayer]);

  const handleModifierToggle = useCallback((layerId: string, modifierId: string) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;
    
    const updatedModifiers = layer.modifiers.map(m =>
      m.id === modifierId ? { ...m, enabled: !m.enabled } : m
    );
    updateLayer(layerId, { modifiers: updatedModifiers });
  }, [layers, updateLayer]);

  const handleRemoveModifier = useCallback((layerId: string, modifierId: string) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;
    
    const updatedModifiers = layer.modifiers.filter(m => m.id !== modifierId);
    updateLayer(layerId, { 
      modifiers: updatedModifiers,
      isModifierHost: updatedModifiers.length > 0
    });
  }, [layers, updateLayer]);

  return (
    <div className="flex flex-col h-full bg-panel-bg border-l border-panel-border">
      {/* Header */}
      <div className="panel-header flex items-center justify-between">
        <span className="text-sm font-medium">Layers</span>
        <span className="text-2xs text-muted-foreground">{layers.length}</span>
      </div>

      {/* Layer list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {layers.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              No layers yet
              <p className="text-2xs mt-1">Drop an image to start</p>
            </div>
          ) : (
            [...layers].reverse().map((layer) => {
              const Icon = getLayerIcon(layer);
              const isSelected = layer.id === activeLayerId;
              const isExpanded = expandedLayers.has(layer.id);
              const hasModifiers = layer.modifiers.length > 0;
              
              return (
                <div key={layer.id}>
                  <div
                    className={cn(
                      'layer-item group',
                      isSelected && 'selected',
                      layer.isSegmentLayer && 'border-l-2',
                    )}
                    style={layer.isSegmentLayer && layer.segmentColor ? {
                      borderLeftColor: layer.segmentColor,
                    } : undefined}
                    onClick={() => selectLayer(layer.id)}
                  >
                    {/* Expand/Collapse for modifier host */}
                    {hasModifiers ? (
                      <button
                        className="p-1 hover:bg-muted/50 rounded transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLayerExpand(layer.id);
                        }}
                      >
                        {isExpanded ? (
                          <ChevronDownIcon className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </button>
                    ) : (
                      <div className="w-5" />
                    )}

                    {/* Visibility */}
                    <button
                      className="p-1 hover:bg-muted/50 rounded transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVisibilityToggle(layer);
                      }}
                    >
                      {layer.visible ? (
                        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5 text-muted-foreground/50" />
                      )}
                    </button>

                    {/* Thumbnail */}
                    <div className="w-10 h-10 rounded border border-border/50 bg-canvas-bg overflow-hidden flex-shrink-0 relative">
                      {layer.imageData && (
                        <LayerThumbnail imageData={layer.imageData} />
                      )}
                      {layer.segmentGlow && (
                        <div className="absolute inset-0 ring-2 ring-primary/50 animate-pulse" />
                      )}
                    </div>

                    {/* Layer info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Icon className="w-3 h-3 text-muted-foreground" />
                        <span className="text-sm truncate">{layer.name}</span>
                        {layer.isSegmentLayer && (
                          <span className="text-2xs px-1 py-0.5 rounded bg-primary/20 text-primary">
                            SEG
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-2xs text-muted-foreground">
                          {Math.round(layer.opacity * 100)}%
                        </span>
                        {layer.blendMode !== 'normal' && (
                          <span className="text-2xs text-primary/70 capitalize">
                            {layer.blendMode}
                          </span>
                        )}
                        {hasModifiers && (
                          <span className="text-2xs text-accent flex items-center gap-0.5">
                            <Layers className="w-2.5 h-2.5" />
                            {layer.modifiers.length}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Lock toggle */}
                    <button
                      className="p-1 hover:bg-muted/50 rounded transition-colors opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLockToggle(layer);
                      }}
                    >
                      {layer.locked ? (
                        <Lock className="w-3.5 h-3.5 text-accent" />
                      ) : (
                        <Unlock className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </button>

                    {/* Delete */}
                    <button
                      className="p-1 hover:bg-destructive/20 hover:text-destructive rounded transition-colors opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeLayer(layer.id);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Modifiers (expanded) */}
                  {isExpanded && hasModifiers && (
                    <div className="ml-6 mt-1 space-y-1 border-l-2 border-accent/30 pl-2">
                      {layer.modifiers.map((modifier) => (
                        <ModifierItem
                          key={modifier.id}
                          modifier={modifier}
                          layerId={layer.id}
                          onToggle={handleModifierToggle}
                          onOpacityChange={handleModifierOpacityChange}
                          onRemove={handleRemoveModifier}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Opacity slider for selected layer */}
      {activeLayerId && (
        <div className="p-3 border-t border-panel-border">
          <div className="flex items-center gap-3">
            <span className="text-2xs text-muted-foreground w-12">Opacity</span>
            <Slider
              value={[Math.round((layers.find(l => l.id === activeLayerId)?.opacity || 1) * 100)]}
              onValueChange={(v) => handleOpacityChange(activeLayerId, v)}
              min={0}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="text-2xs text-muted-foreground w-8 text-right">
              {Math.round((layers.find(l => l.id === activeLayerId)?.opacity || 1) * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="p-2 border-t border-panel-border flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <Copy className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <ChevronUp className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <ChevronDown className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

// Modifier item component
interface ModifierItemProps {
  modifier: Modifier;
  layerId: string;
  onToggle: (layerId: string, modifierId: string) => void;
  onOpacityChange: (layerId: string, modifierId: string, value: number[]) => void;
  onRemove: (layerId: string, modifierId: string) => void;
}

function ModifierItem({ modifier, layerId, onToggle, onOpacityChange, onRemove }: ModifierItemProps) {
  const getModifierIcon = () => {
    switch (modifier.type) {
      case 'transparency-mask': return Scissors;
      default: return Layers;
    }
  };
  
  const Icon = getModifierIcon();
  
  return (
    <div className={cn(
      'flex items-center gap-2 p-2 rounded bg-muted/30 text-sm',
      !modifier.enabled && 'opacity-50'
    )}>
      <button
        className="p-1 hover:bg-muted/50 rounded"
        onClick={() => onToggle(layerId, modifier.id)}
      >
        {modifier.enabled ? (
          <Eye className="w-3 h-3 text-accent" />
        ) : (
          <EyeOff className="w-3 h-3 text-muted-foreground" />
        )}
      </button>
      
      <Icon className="w-3 h-3 text-accent" />
      
      <span className="flex-1 truncate text-xs capitalize">
        {modifier.type.replace('-', ' ')}
      </span>
      
      <div className="flex items-center gap-1 w-20">
        <Slider
          value={[Math.round(modifier.opacity * 100)]}
          onValueChange={(v) => onOpacityChange(layerId, modifier.id, v)}
          min={0}
          max={100}
          step={1}
          className="flex-1"
        />
        <span className="text-2xs w-6 text-right">{Math.round(modifier.opacity * 100)}%</span>
      </div>
      
      <button
        className="p-1 hover:bg-destructive/20 hover:text-destructive rounded"
        onClick={() => onRemove(layerId, modifier.id)}
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

// Layer thumbnail component
function LayerThumbnail({ imageData }: { imageData: ImageData }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create a scaled version
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(imageData, 0, 0);

    // Draw scaled
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
  }, [imageData]);

  return (
    <canvas
      ref={canvasRef}
      width={40}
      height={40}
      className="w-full h-full object-contain"
    />
  );
}
