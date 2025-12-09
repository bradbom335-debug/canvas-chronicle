// V3 Image Editor - History Management

import { Project, CanvasState, HistorySnapshot, HistoryState } from '@/types/editor';

const MAX_HISTORY_SIZE = 50;

/**
 * Deep clone utility for immutable snapshots
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Uint8ClampedArray) {
    return new Uint8ClampedArray(obj) as unknown as T;
  }
  
  if (obj instanceof Set) {
    return new Set(obj) as unknown as T;
  }
  
  if (obj instanceof Map) {
    return new Map(obj) as unknown as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }
  
  if (obj instanceof ImageData) {
    return new ImageData(
      new Uint8ClampedArray(obj.data),
      obj.width,
      obj.height
    ) as unknown as T;
  }
  
  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      (cloned as Record<string, unknown>)[key] = deepClone((obj as Record<string, unknown>)[key]);
    }
  }
  return cloned;
}

/**
 * History Manager - Undo/Redo functionality
 */
export class HistoryManager {
  private snapshots: HistorySnapshot[] = [];
  private currentIndex: number = -1;
  private maxSnapshots: number;

  constructor(maxSnapshots: number = MAX_HISTORY_SIZE) {
    this.maxSnapshots = maxSnapshots;
  }

  /**
   * Push a new snapshot to history
   */
  push(description: string, project: Project, canvasState: Partial<CanvasState>): void {
    // If we're not at the end, discard forward history
    if (this.currentIndex < this.snapshots.length - 1) {
      this.snapshots = this.snapshots.slice(0, this.currentIndex + 1);
    }
    
    // Create snapshot with deep clones
    const snapshot: HistorySnapshot = {
      id: crypto.randomUUID(),
      description,
      project: deepClone(project),
      canvasState: deepClone(canvasState),
      timestamp: Date.now(),
    };
    
    this.snapshots.push(snapshot);
    this.currentIndex++;
    
    // Limit history size
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
      this.currentIndex--;
    }
  }

  /**
   * Undo - move back in history
   */
  undo(): HistorySnapshot | null {
    if (!this.canUndo) return null;
    
    this.currentIndex--;
    return deepClone(this.snapshots[this.currentIndex]);
  }

  /**
   * Redo - move forward in history
   */
  redo(): HistorySnapshot | null {
    if (!this.canRedo) return null;
    
    this.currentIndex++;
    return deepClone(this.snapshots[this.currentIndex]);
  }

  /**
   * Get current snapshot
   */
  getCurrent(): HistorySnapshot | null {
    if (this.currentIndex < 0 || this.currentIndex >= this.snapshots.length) {
      return null;
    }
    return deepClone(this.snapshots[this.currentIndex]);
  }

  /**
   * Get history state
   */
  getState(): HistoryState {
    return {
      snapshots: this.snapshots,
      currentIndex: this.currentIndex,
      maxSnapshots: this.maxSnapshots,
    };
  }

  /**
   * Check if can undo
   */
  get canUndo(): boolean {
    return this.currentIndex > 0;
  }

  /**
   * Check if can redo
   */
  get canRedo(): boolean {
    return this.currentIndex < this.snapshots.length - 1;
  }

  /**
   * Get undo description
   */
  get undoDescription(): string | null {
    if (!this.canUndo) return null;
    return this.snapshots[this.currentIndex].description;
  }

  /**
   * Get redo description
   */
  get redoDescription(): string | null {
    if (!this.canRedo) return null;
    return this.snapshots[this.currentIndex + 1].description;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.snapshots = [];
    this.currentIndex = -1;
  }

  /**
   * Get history list for display
   */
  getHistoryList(): Array<{ id: string; description: string; isCurrent: boolean }> {
    return this.snapshots.map((s, i) => ({
      id: s.id,
      description: s.description,
      isCurrent: i === this.currentIndex,
    }));
  }
}
