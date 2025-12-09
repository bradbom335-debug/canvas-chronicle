// V3 Image Editor - Header Component

import React, { useCallback, useRef } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { Button } from '@/components/ui/button';
import { 
  Undo2, 
  Redo2, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Download,
  Upload,
  Save,
  FolderOpen
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function EditorHeader() {
  const { state, addImageLayer, undo, redo, canUndo, canRedo } = useEditor();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        await addImageLayer(file);
      }
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [addImageLayer]);

  const handleOpenFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleExport = useCallback(() => {
    const { project } = state;
    if (project.layers.length === 0) return;
    
    // Create composite and download
    const canvas = document.createElement('canvas');
    canvas.width = project.width;
    canvas.height = project.height;
    const ctx = canvas.getContext('2d')!;
    
    // Draw layers
    for (const layer of project.layers) {
      if (!layer.visible || !layer.imageData) continue;
      
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = layer.imageData.width;
      tempCanvas.height = layer.imageData.height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.putImageData(layer.imageData, 0, 0);
      
      ctx.globalAlpha = layer.opacity;
      ctx.drawImage(tempCanvas, layer.bounds.x, layer.bounds.y);
    }
    
    // Download
    const link = document.createElement('a');
    link.download = `${project.name || 'export'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [state]);

  return (
    <header className="flex items-center gap-2 h-12 px-3 bg-toolbar-bg border-b border-panel-border">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-4">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
          <span className="text-xs font-bold text-primary-foreground">V3</span>
        </div>
        <span className="font-semibold text-sm hidden sm:block">Image Editor</span>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* File actions */}
      <div className="flex items-center gap-1">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleOpenFile}>
              <FolderOpen className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open Image</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Save className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Save Project</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleExport}>
              <Download className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Export Image</TooltipContent>
        </Tooltip>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* History */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              disabled={!canUndo}
              onClick={undo}
            >
              <Undo2 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              disabled={!canRedo}
              onClick={redo}
            >
              <Redo2 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
        </Tooltip>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Project name */}
      <div className="text-sm text-muted-foreground">
        {state.project.name}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Zoom controls */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ZoomOut className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom Out</TooltipContent>
        </Tooltip>

        <span className="text-xs text-muted-foreground w-12 text-center font-mono">
          {Math.round(state.canvasState.zoom * 100)}%
        </span>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ZoomIn className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom In</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Maximize2 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Fit to Screen</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
