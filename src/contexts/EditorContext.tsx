// V3 Image Editor - Editor Context (State Management)

import React, { createContext, useContext, useReducer, useCallback, useRef, ReactNode } from 'react';
import { 
  Project, Layer, ToolType, ToolSettings, CanvasState, SelectionMask,
  createProject, createCanvasState, createMagicWandSettings, createLayer,
  Point, CANVAS_WIDTH, CANVAS_HEIGHT
} from '@/types/editor';
import { HistoryManager } from '@/lib/editor/HistoryManager';
import { LayerUtils } from '@/lib/editor/LayerUtils';

// ============ STATE TYPES ============

interface EditorState {
  project: Project;
  canvasState: CanvasState;
  activeTool: ToolType;
  toolSettings: ToolSettings;
  selection: SelectionMask | null;
  hoverPreview: SelectionMask | null;
}

type EditorAction =
  | { type: 'SET_PROJECT'; payload: Project }
  | { type: 'ADD_LAYER'; payload: Layer }
  | { type: 'REMOVE_LAYER'; payload: string }
  | { type: 'UPDATE_LAYER'; payload: { id: string; updates: Partial<Layer> } }
  | { type: 'SELECT_LAYER'; payload: string | null }
  | { type: 'SET_ACTIVE_TOOL'; payload: ToolType }
  | { type: 'UPDATE_TOOL_SETTINGS'; payload: Partial<ToolSettings> }
  | { type: 'SET_CANVAS_STATE'; payload: Partial<CanvasState> }
  | { type: 'SET_SELECTION'; payload: SelectionMask | null }
  | { type: 'SET_HOVER_PREVIEW'; payload: SelectionMask | null }
  | { type: 'RESTORE_SNAPSHOT'; payload: { project: Project; canvasState: Partial<CanvasState> } };

// ============ INITIAL STATE ============

const initialState: EditorState = {
  project: createProject(),
  canvasState: createCanvasState(),
  activeTool: 'magic-wand',
  toolSettings: {
    magicWand: createMagicWandSettings(),
    brush: { size: 20, hardness: 100, opacity: 1, flow: 1, color: '#ffffff' },
    eraser: { size: 20, hardness: 100, opacity: 1, flow: 1, color: '#000000' },
  },
  selection: null,
  hoverPreview: null,
};

// ============ REDUCER ============

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_PROJECT':
      return { ...state, project: action.payload };
    
    case 'ADD_LAYER':
      return {
        ...state,
        project: {
          ...state.project,
          layers: [...state.project.layers, action.payload],
          activeLayerId: action.payload.id,
          selectedLayerIds: [action.payload.id],
          modifiedAt: Date.now(),
        },
      };
    
    case 'REMOVE_LAYER':
      return {
        ...state,
        project: {
          ...state.project,
          layers: state.project.layers.filter(l => l.id !== action.payload),
          activeLayerId: state.project.activeLayerId === action.payload 
            ? state.project.layers[0]?.id || null 
            : state.project.activeLayerId,
          selectedLayerIds: state.project.selectedLayerIds.filter(id => id !== action.payload),
          modifiedAt: Date.now(),
        },
      };
    
    case 'UPDATE_LAYER':
      return {
        ...state,
        project: {
          ...state.project,
          layers: state.project.layers.map(l =>
            l.id === action.payload.id
              ? { ...l, ...action.payload.updates, modifiedAt: Date.now() }
              : l
          ),
          modifiedAt: Date.now(),
        },
      };
    
    case 'SELECT_LAYER':
      return {
        ...state,
        project: {
          ...state.project,
          activeLayerId: action.payload,
          selectedLayerIds: action.payload ? [action.payload] : [],
        },
      };
    
    case 'SET_ACTIVE_TOOL':
      return { ...state, activeTool: action.payload };
    
    case 'UPDATE_TOOL_SETTINGS':
      return {
        ...state,
        toolSettings: { ...state.toolSettings, ...action.payload },
      };
    
    case 'SET_CANVAS_STATE':
      return {
        ...state,
        canvasState: { ...state.canvasState, ...action.payload },
      };
    
    case 'SET_SELECTION':
      return { ...state, selection: action.payload };
    
    case 'SET_HOVER_PREVIEW':
      return { ...state, hoverPreview: action.payload };
    
    case 'RESTORE_SNAPSHOT':
      return {
        ...state,
        project: action.payload.project,
        canvasState: { ...state.canvasState, ...action.payload.canvasState },
      };
    
    default:
      return state;
  }
}

// ============ CONTEXT ============

interface EditorContextValue {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  
  // Layer actions
  addLayer: (layer: Layer) => void;
  removeLayer: (id: string) => void;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  selectLayer: (id: string | null) => void;
  addImageLayer: (file: File) => Promise<void>;
  
  // Tool actions
  setActiveTool: (tool: ToolType) => void;
  updateToolSettings: (settings: Partial<ToolSettings>) => void;
  
  // Canvas actions
  setPan: (x: number, y: number) => void;
  setZoom: (zoom: number) => void;
  setCanvasMode: (mode: CanvasState['mode']) => void;
  
  // Selection actions
  setSelection: (selection: SelectionMask | null) => void;
  setHoverPreview: (preview: SelectionMask | null) => void;
  createLayerFromSelection: () => void;
  
  // History actions
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  
  // Utilities
  getCompositeImageData: () => ImageData;
}

const EditorContext = createContext<EditorContextValue | null>(null);

// ============ PROVIDER ============

export function EditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(editorReducer, initialState);
  const historyRef = useRef(new HistoryManager());
  
  // Initialize history with initial state
  React.useEffect(() => {
    historyRef.current.push('Initial state', state.project, state.canvasState);
  }, []);

  // ============ LAYER ACTIONS ============

  const addLayer = useCallback((layer: Layer) => {
    dispatch({ type: 'ADD_LAYER', payload: layer });
    historyRef.current.push(`Add layer: ${layer.name}`, state.project, state.canvasState);
  }, [state.project, state.canvasState]);

  const removeLayer = useCallback((id: string) => {
    const layer = state.project.layers.find(l => l.id === id);
    dispatch({ type: 'REMOVE_LAYER', payload: id });
    historyRef.current.push(`Remove layer: ${layer?.name || 'Unknown'}`, state.project, state.canvasState);
  }, [state.project, state.canvasState]);

  const updateLayer = useCallback((id: string, updates: Partial<Layer>) => {
    dispatch({ type: 'UPDATE_LAYER', payload: { id, updates } });
  }, []);

  const selectLayer = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_LAYER', payload: id });
  }, []);

  const addImageLayer = useCallback(async (file: File) => {
    try {
      const layer = await LayerUtils.createFromFile(file);
      dispatch({ type: 'ADD_LAYER', payload: layer });
      historyRef.current.push(`Add image: ${layer.name}`, state.project, state.canvasState);
    } catch (error) {
      console.error('Failed to add image layer:', error);
    }
  }, [state.project, state.canvasState]);

  // ============ TOOL ACTIONS ============

  const setActiveTool = useCallback((tool: ToolType) => {
    dispatch({ type: 'SET_ACTIVE_TOOL', payload: tool });
  }, []);

  const updateToolSettings = useCallback((settings: Partial<ToolSettings>) => {
    dispatch({ type: 'UPDATE_TOOL_SETTINGS', payload: settings });
  }, []);

  // ============ CANVAS ACTIONS ============

  const setPan = useCallback((x: number, y: number) => {
    dispatch({ type: 'SET_CANVAS_STATE', payload: { panX: x, panY: y } });
  }, []);

  const setZoom = useCallback((zoom: number) => {
    dispatch({ type: 'SET_CANVAS_STATE', payload: { zoom } });
  }, []);

  const setCanvasMode = useCallback((mode: CanvasState['mode']) => {
    dispatch({ type: 'SET_CANVAS_STATE', payload: { mode } });
  }, []);

  // ============ SELECTION ACTIONS ============

  const setSelection = useCallback((selection: SelectionMask | null) => {
    dispatch({ type: 'SET_SELECTION', payload: selection });
  }, []);

  const setHoverPreview = useCallback((preview: SelectionMask | null) => {
    dispatch({ type: 'SET_HOVER_PREVIEW', payload: preview });
  }, []);

  const createLayerFromSelection = useCallback(() => {
    if (!state.selection) return;
    
    const activeLayer = state.project.layers.find(l => l.id === state.project.activeLayerId);
    if (!activeLayer) return;
    
    const newLayer = LayerUtils.extractPixelsWithMask(
      activeLayer,
      state.selection.mask,
      state.selection.bounds,
      state.selection.width
    );
    
    if (newLayer) {
      dispatch({ type: 'ADD_LAYER', payload: newLayer });
      historyRef.current.push(`Create layer from selection`, state.project, state.canvasState);
    }
  }, [state.selection, state.project, state.canvasState]);

  // ============ HISTORY ACTIONS ============

  const undo = useCallback(() => {
    const snapshot = historyRef.current.undo();
    if (snapshot) {
      dispatch({ 
        type: 'RESTORE_SNAPSHOT', 
        payload: { project: snapshot.project, canvasState: snapshot.canvasState } 
      });
    }
  }, []);

  const redo = useCallback(() => {
    const snapshot = historyRef.current.redo();
    if (snapshot) {
      dispatch({ 
        type: 'RESTORE_SNAPSHOT', 
        payload: { project: snapshot.project, canvasState: snapshot.canvasState } 
      });
    }
  }, []);

  // ============ UTILITIES ============

  const getCompositeImageData = useCallback((): ImageData => {
    return LayerUtils.compositeLayers(state.project.layers);
  }, [state.project.layers]);

  const value: EditorContextValue = {
    state,
    dispatch,
    addLayer,
    removeLayer,
    updateLayer,
    selectLayer,
    addImageLayer,
    setActiveTool,
    updateToolSettings,
    setPan,
    setZoom,
    setCanvasMode,
    setSelection,
    setHoverPreview,
    createLayerFromSelection,
    undo,
    redo,
    canUndo: historyRef.current.canUndo,
    canRedo: historyRef.current.canRedo,
    getCompositeImageData,
  };

  return (
    <EditorContext.Provider value={value}>
      {children}
    </EditorContext.Provider>
  );
}

// ============ HOOK ============

export function useEditor(): EditorContextValue {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditor must be used within an EditorProvider');
  }
  return context;
}
