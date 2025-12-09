// V3 Image Editor - Toolbar Component

import React from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { ToolType } from '@/types/editor';
import { 
  MousePointer2, 
  Wand2, 
  Paintbrush, 
  Eraser, 
  Move, 
  Hand, 
  ZoomIn,
  Lasso,
  Square,
  Type,
  Circle
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ToolConfig {
  id: ToolType;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut: string;
}

const tools: ToolConfig[] = [
  { id: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V' },
  { id: 'magic-wand', icon: Wand2, label: 'Magic Wand', shortcut: 'W' },
  { id: 'lasso', icon: Lasso, label: 'Lasso', shortcut: 'L' },
  { id: 'rectangle-select', icon: Square, label: 'Rectangle Select', shortcut: 'M' },
  { id: 'brush', icon: Paintbrush, label: 'Brush', shortcut: 'B' },
  { id: 'eraser', icon: Eraser, label: 'Eraser', shortcut: 'E' },
  { id: 'move', icon: Move, label: 'Move', shortcut: 'V' },
  { id: 'pan', icon: Hand, label: 'Pan', shortcut: 'H' },
  { id: 'zoom', icon: ZoomIn, label: 'Zoom', shortcut: 'Z' },
  { id: 'text', icon: Type, label: 'Text', shortcut: 'T' },
  { id: 'shape', icon: Circle, label: 'Shape', shortcut: 'U' },
];

export function EditorToolbar() {
  const { state, setActiveTool } = useEditor();
  const { activeTool } = state;

  return (
    <div className="flex flex-col gap-1 p-1.5 bg-toolbar-bg border-r border-panel-border">
      {tools.map((tool) => (
        <Tooltip key={tool.id} delayDuration={300}>
          <TooltipTrigger asChild>
            <button
              className={cn(
                'tool-button',
                activeTool === tool.id && 'active'
              )}
              onClick={() => setActiveTool(tool.id)}
            >
              <tool.icon className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2">
            <span>{tool.label}</span>
            <kbd className="px-1.5 py-0.5 text-2xs bg-muted rounded font-mono">
              {tool.shortcut}
            </kbd>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
