// V3 Image Editor - Right Icon Bar with Drawer Panels

import React, { useState } from 'react';
import { 
  Layers, 
  Settings2, 
  Wand2, 
  SlidersHorizontal,
  History,
  Palette,
  Info,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { LayersPanel } from './LayersPanel';
import { AdvancedToolSettings } from './AdvancedToolSettings';
import { AdvancedLayerSettings } from './AdvancedLayerSettings';
import { AIPanel } from './AIPanel';

type DrawerType = 'layers' | 'tool-advanced' | 'layer-advanced' | 'history' | 'colors' | 'info' | 'ai' | null;

interface PanelConfig {
  id: DrawerType;
  icon: React.ElementType;
  label: string;
  shortcut?: string;
}

const panels: PanelConfig[] = [
  { id: 'layers', icon: Layers, label: 'Layers', shortcut: 'L' },
  { id: 'tool-advanced', icon: SlidersHorizontal, label: 'Advanced Tool Settings', shortcut: 'T' },
  { id: 'layer-advanced', icon: Settings2, label: 'Advanced Layer Settings' },
  { id: 'ai', icon: Sparkles, label: 'AI Assistant', shortcut: 'A' },
  { id: 'history', icon: History, label: 'History', shortcut: 'H' },
  { id: 'colors', icon: Palette, label: 'Color Palette', shortcut: 'C' },
  { id: 'info', icon: Info, label: 'Document Info', shortcut: 'I' },
];

export function RightPanelBar() {
  const [activeDrawer, setActiveDrawer] = useState<DrawerType>(null);
  const [isPinned, setIsPinned] = useState(true);

  const toggleDrawer = (id: DrawerType) => {
    setActiveDrawer(prev => prev === id ? null : id);
  };

  const renderDrawerContent = () => {
    switch (activeDrawer) {
      case 'layers':
        return <LayersPanel />;
      case 'tool-advanced':
        return <AdvancedToolSettings />;
      case 'layer-advanced':
        return <AdvancedLayerSettings />;
      case 'ai':
        return <AIPanel />;
      case 'history':
        return <HistoryPanel />;
      case 'colors':
        return <ColorPalettePanel />;
      case 'info':
        return <DocumentInfoPanel />;
      default:
        return null;
    }
  };

  const getDrawerTitle = () => {
    return panels.find(p => p.id === activeDrawer)?.label || '';
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full">
        {/* Pinned drawer content */}
        {isPinned && activeDrawer && (
          <div className="w-72 border-l border-panel-border bg-panel-bg overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-panel-border">
              <span className="text-sm font-medium text-foreground">{getDrawerTitle()}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsPinned(false)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {renderDrawerContent()}
            </div>
          </div>
        )}

        {/* Icon bar */}
        <div className="w-12 border-l border-panel-border bg-panel-bg flex flex-col items-center py-2 gap-1">
          {panels.map(panel => (
            <Tooltip key={panel.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-9 w-9 rounded-lg transition-colors",
                    activeDrawer === panel.id && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => toggleDrawer(panel.id)}
                >
                  <panel.icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="flex items-center gap-2">
                <span>{panel.label}</span>
                {panel.shortcut && (
                  <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded">
                    {panel.shortcut}
                  </kbd>
                )}
              </TooltipContent>
            </Tooltip>
          ))}

          <div className="flex-1" />

          {/* Pin toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-9 w-9 rounded-lg",
                  isPinned && "bg-muted"
                )}
                onClick={() => setIsPinned(!isPinned)}
              >
                {isPinned ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              {isPinned ? 'Use floating drawers' : 'Pin drawers'}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Sheet drawer for unpinned mode */}
        {!isPinned && (
          <Sheet open={activeDrawer !== null} onOpenChange={(open) => !open && setActiveDrawer(null)}>
            <SheetContent side="right" className="w-80 p-0">
              <SheetHeader className="px-4 py-3 border-b border-panel-border">
                <SheetTitle className="text-sm font-medium">{getDrawerTitle()}</SheetTitle>
              </SheetHeader>
              <div className="overflow-y-auto h-[calc(100%-52px)]">
                {renderDrawerContent()}
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </TooltipProvider>
  );
}

// Placeholder panels
function HistoryPanel() {
  return (
    <div className="p-3">
      <p className="text-sm text-muted-foreground">History panel - showing undo/redo steps</p>
      <div className="mt-3 space-y-1">
        {['Initial state', 'Add layer', 'Magic wand selection', 'Adjust tolerance'].map((item, i) => (
          <div 
            key={i}
            className={cn(
              "px-2 py-1.5 text-sm rounded cursor-pointer hover:bg-muted/50",
              i === 3 && "bg-accent/50"
            )}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function ColorPalettePanel() {
  return (
    <div className="p-3">
      <p className="text-sm text-muted-foreground mb-3">Color Palette</p>
      <div className="grid grid-cols-6 gap-1">
        {['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#8b00ff',
          '#ffffff', '#cccccc', '#999999', '#666666', '#333333', '#000000'].map(color => (
          <div 
            key={color}
            className="w-8 h-8 rounded cursor-pointer border border-white/20 hover:scale-110 transition-transform"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  );
}

function DocumentInfoPanel() {
  return (
    <div className="p-3 space-y-3">
      <div>
        <span className="text-xs text-muted-foreground">Dimensions</span>
        <p className="text-sm">1920 × 1080 px</p>
      </div>
      <div>
        <span className="text-xs text-muted-foreground">Color Mode</span>
        <p className="text-sm">RGBA (8-bit)</p>
      </div>
      <div>
        <span className="text-xs text-muted-foreground">Layers</span>
        <p className="text-sm">3 layers</p>
      </div>
    </div>
  );
}
