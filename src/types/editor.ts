// V3 Image Editor - Complete Type System

// ============ COORDINATE TYPES ============

export interface Point {
  x: number;
  y: number;
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Transform {
  tx: number;  // Translation X
  ty: number;  // Translation Y
  sx: number;  // Scale X
  sy: number;  // Scale Y
  rotation: number;  // Radians
}

// ============ CANVAS CONSTANTS ============

export const CANVAS_WIDTH = 1920;
export const CANVAS_HEIGHT = 1080;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 10;
export const ZOOM_SPEED = 0.001;
export const PAN_SPEED = 1;

// ============ LAYER TYPES ============

export type LayerType = 'raster' | 'text' | 'shape' | 'group';
export type BlendMode = 
  | 'normal' 
  | 'multiply' 
  | 'screen' 
  | 'overlay' 
  | 'darken' 
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'soft-light'
  | 'hard-light'
  | 'difference'
  | 'exclusion';

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: BlendMode;
  bounds: Rectangle;
  transform: Transform;
  imageData: ImageData | null;
  modifiers: Modifier[];
  parentId: string | null;
  children: string[];
  createdAt: number;
  modifiedAt: number;
}

// ============ MODIFIER TYPES ============

export type ModifierType = 
  | 'transparency-mask'
  | 'brightness'
  | 'contrast'
  | 'saturation'
  | 'hue-shift'
  | 'blur'
  | 'sharpen'
  | 'invert';

export interface Modifier {
  id: string;
  type: ModifierType;
  enabled: boolean;
  opacity: number;
  parameters: Record<string, unknown>;
}

export interface TransparencyMaskParams {
  mask: Uint8ClampedArray;
  bounds: Rectangle;
  feather: number;
  invert: boolean;
}

// ============ SELECTION TYPES ============

export interface SelectionMask {
  id: string;
  mask: Uint8ClampedArray;
  bounds: Rectangle;
  width: number;
  height: number;
  pixels: Set<number>;
  feathered: boolean;
  metadata: SelectionMetadata;
}

export interface SelectionMetadata {
  seedPoint: Point;
  tolerance: number;
  pixelCount: number;
  createdAt: number;
}

// ============ TOOL TYPES ============

export type ToolType = 
  | 'select'
  | 'magic-wand'
  | 'brush'
  | 'eraser'
  | 'move'
  | 'pan'
  | 'zoom'
  | 'lasso'
  | 'rectangle-select'
  | 'text'
  | 'shape';

export type ToolState = 'idle' | 'hover' | 'active' | 'processing' | 'complete';

export interface ToolSettings {
  magicWand: MagicWandSettings;
  brush: BrushSettings;
  eraser: BrushSettings;
}

export interface MagicWandSettings {
  tolerance: number;
  contiguous: boolean;
  antiAlias: boolean;
  feather: number;
  sampleAllLayers: boolean;
  // Advanced settings
  previewMode: 'instant' | 'expanding' | 'fast' | 'off';
  previewQuality: number;
  showMarchingAnts: boolean;
  batchSize: number;
  maxPixels: number;
  useWorker: boolean;
  connectivity: 4 | 8;
  colorSpace: 'rgb' | 'hsl' | 'lab';
  includeAlpha: boolean;
  edgeMode: boolean;
  contractExpand: number;
  smoothEdges: number;
}

export interface BrushSettings {
  size: number;
  hardness: number;
  opacity: number;
  flow: number;
  color: string;
}

// ============ CANVAS STATE ============

export type CanvasMode = 'idle' | 'panning' | 'selecting' | 'transforming' | 'drawing';

export interface CanvasState {
  mode: CanvasMode;
  panX: number;
  panY: number;
  zoom: number;
  isDirty: boolean;
  isAnimating: boolean;
  cursorPosition: Point | null;
  hoverPreview: SelectionMask | null;
}

// ============ PROJECT TYPES ============

export interface Project {
  id: string;
  name: string;
  width: number;
  height: number;
  layers: Layer[];
  activeLayerId: string | null;
  selectedLayerIds: string[];
  backgroundColor: string;
  createdAt: number;
  modifiedAt: number;
}

// ============ HISTORY TYPES ============

export interface HistorySnapshot {
  id: string;
  description: string;
  project: Project;
  canvasState: Partial<CanvasState>;
  timestamp: number;
}

export interface HistoryState {
  snapshots: HistorySnapshot[];
  currentIndex: number;
  maxSnapshots: number;
}

// ============ WORKER MESSAGE TYPES ============

export type WorkerMessageType = 
  | 'segment'
  | 'segment-result'
  | 'preview'
  | 'preview-result'
  | 'cancel';

export interface SegmentRequest {
  type: 'segment';
  id: string;
  imageData: {
    data: ArrayBuffer;
    width: number;
    height: number;
  };
  startPoint: Point;
  options: MagicWandSettings;
}

export interface SegmentResult {
  type: 'segment-result';
  id: string;
  mask: ArrayBuffer;
  bounds: Rectangle;
  pixels: number[];
  hitLimit: boolean;
  metadata: {
    pixelCount: number;
    processingTime: number;
  };
}

export interface PreviewRequest {
  type: 'preview';
  id: string;
  imageData: {
    data: ArrayBuffer;
    width: number;
    height: number;
  };
  startPoint: Point;
  tolerance: number;
  maxPixels: number;
}

export interface PreviewResult {
  type: 'preview-result';
  id: string;
  mask: ArrayBuffer;
  bounds: Rectangle;
  pixelCount: number;
  isComplete: boolean;
}

// ============ EVENT TYPES ============

export type EditorEventType =
  | 'layer:add'
  | 'layer:remove'
  | 'layer:update'
  | 'layer:select'
  | 'selection:create'
  | 'selection:update'
  | 'selection:clear'
  | 'tool:change'
  | 'canvas:pan'
  | 'canvas:zoom'
  | 'history:push'
  | 'history:undo'
  | 'history:redo';

export interface EditorEvent<T = unknown> {
  type: EditorEventType;
  payload: T;
  timestamp: number;
}

// ============ UTILITY TYPES ============

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredKeys<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

// ============ FACTORY FUNCTIONS ============

export function createPoint(x: number = 0, y: number = 0): Point {
  return { x, y };
}

export function createRectangle(
  x: number = 0, 
  y: number = 0, 
  width: number = 0, 
  height: number = 0
): Rectangle {
  return { x, y, width, height };
}

export function createTransform(): Transform {
  return { tx: 0, ty: 0, sx: 1, sy: 1, rotation: 0 };
}

export function createLayer(partial: Partial<Layer> = {}): Layer {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: 'New Layer',
    type: 'raster',
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'normal',
    bounds: createRectangle(),
    transform: createTransform(),
    imageData: null,
    modifiers: [],
    parentId: null,
    children: [],
    createdAt: now,
    modifiedAt: now,
    ...partial,
  };
}

export function createProject(partial: Partial<Project> = {}): Project {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: 'Untitled',
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    layers: [],
    activeLayerId: null,
    selectedLayerIds: [],
    backgroundColor: '#1a1a2e',
    createdAt: now,
    modifiedAt: now,
    ...partial,
  };
}

export function createCanvasState(): CanvasState {
  return {
    mode: 'idle',
    panX: 0,
    panY: 0,
    zoom: 1,
    isDirty: false,
    isAnimating: false,
    cursorPosition: null,
    hoverPreview: null,
  };
}

export function createMagicWandSettings(): MagicWandSettings {
  return {
    tolerance: 32,
    contiguous: true,
    antiAlias: true,
    feather: 0,
    sampleAllLayers: true,
    previewMode: 'fast',
    previewQuality: 100,
    showMarchingAnts: true,
    batchSize: 10000,
    maxPixels: 500000,
    useWorker: false,
    connectivity: 4,
    colorSpace: 'rgb',
    includeAlpha: false,
    edgeMode: false,
    contractExpand: 0,
    smoothEdges: 0,
  };
}
