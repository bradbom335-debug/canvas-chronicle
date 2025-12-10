// V3 Image Editor - Main Layout

import React from 'react';
import { EditorProvider } from '@/contexts/EditorContext';
import { EditorCanvas } from './EditorCanvas';
import { EditorToolbar } from './EditorToolbar';
import { EditorHeader } from './EditorHeader';
import { ToolSettingsPanel } from './ToolSettingsPanel';
import { RightPanelBar } from './RightPanelBar';

export function ImageEditor() {
  return (
    <EditorProvider>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
        {/* Header */}
        <EditorHeader />
        
        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left toolbar */}
          <EditorToolbar />
          
          {/* Tool settings */}
          <div className="w-56 border-r border-panel-border bg-panel-bg overflow-y-auto scrollbar-thin">
            <ToolSettingsPanel />
          </div>
          
          {/* Canvas area */}
          <div className="flex-1 relative">
            <EditorCanvas />
          </div>
          
          {/* Right panel bar with drawers */}
          <RightPanelBar />
        </div>
      </div>
    </EditorProvider>
  );
}
