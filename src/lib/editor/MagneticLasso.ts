// Magnetic Lasso Tool Core Engine
// Supports 4 variations: Classic Dijkstra, Photoshop-style Auto-Anchoring,
// Elastic Progressive, and Predictive Directional

import { Point } from '@/types/editor';
import { EdgeDetectionEngine, EdgeDetectionOptions, DEFAULT_EDGE_OPTIONS } from './EdgeDetection';
import { PathfindingEngine, PathfindingOptions, DEFAULT_PATHFINDING_OPTIONS, smoothPath, simplifyPath } from './Pathfinding';

// Lasso variations
export type LassoVariation = 'classic' | 'photoshop' | 'elastic' | 'predictive';

export interface LassoAnchor {
  point: Point;
  strength: number;      // 0-1, for elastic mode
  locked: boolean;
  edgeQuality: number;   // Local edge quality at this point
  timestamp: number;
}

export interface LassoSettings {
  // Core settings
  variation: LassoVariation;
  cursorRadius: number;          // Dead zone radius for stabilization
  edgeSearchRadius: number;      // How far to search for edges
  smoothingFactor: number;       // Path smoothing 0-1
  pathMemory: number;            // How many cursor points to remember
  
  // Edge detection settings
  edge: EdgeDetectionOptions;
  
  // Pathfinding settings
  pathfinding: PathfindingOptions;
  
  // Auto-anchoring settings (Photoshop mode)
  autoAnchorEnabled: boolean;
  autoAnchorDistance: number;    // Distance threshold
  autoAnchorTime: number;        // Time interval (ms)
  anchorFrequency: number;       // 0-100 scale
  minMovementForAnchor: number;  // Minimum cursor movement
  
  // Elastic settings
  elasticZoneLength: number;     // Number of recent anchors in elastic zone
  strengthCurve: 'linear' | 'exponential' | 'ease-in-out';
  lockThreshold: number;         // Strength at which anchor locks
  
  // Predictive settings
  predictionConeAngle: number;   // Degrees
  predictionConfidenceThreshold: number;
  curveConsistencyWindow: number;
  
  // Visualization
  nodeSize: number;
  pathColor: string;
  previewColor: string;
  showEdgeTrail: boolean;
  showElasticGradient: boolean;
  showPredictionZone: boolean;
  showMetrics: boolean;
}

export const DEFAULT_LASSO_SETTINGS: LassoSettings = {
  variation: 'classic',
  cursorRadius: 15,
  edgeSearchRadius: 20,
  smoothingFactor: 0.5,
  pathMemory: 10,
  
  edge: DEFAULT_EDGE_OPTIONS,
  pathfinding: DEFAULT_PATHFINDING_OPTIONS,
  
  autoAnchorEnabled: true,
  autoAnchorDistance: 30,
  autoAnchorTime: 500,
  anchorFrequency: 50,
  minMovementForAnchor: 5,
  
  elasticZoneLength: 5,
  strengthCurve: 'ease-in-out',
  lockThreshold: 0.9,
  
  predictionConeAngle: 45,
  predictionConfidenceThreshold: 0.6,
  curveConsistencyWindow: 5,
  
  nodeSize: 6,
  pathColor: '#00ffff',
  previewColor: 'rgba(0, 255, 255, 0.5)',
  showEdgeTrail: true,
  showElasticGradient: true,
  showPredictionZone: true,
  showMetrics: true,
};

// Lazy cursor for stabilization
export class LazyCursor {
  private outerPos: Point;
  private innerPos: Point;
  private radius: number;
  private smoothing: number;

  constructor(initialPos: Point, radius: number = 15, smoothing: number = 0.5) {
    this.outerPos = { ...initialPos };
    this.innerPos = { ...initialPos };
    this.radius = radius;
    this.smoothing = smoothing;
  }

  update(mousePos: Point): Point {
    this.outerPos = { ...mousePos };
    
    const dx = this.outerPos.x - this.innerPos.x;
    const dy = this.outerPos.y - this.innerPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > this.radius) {
      // Push inner node along the vector
      const pushDistance = distance - this.radius;
      const angle = Math.atan2(dy, dx);
      
      this.innerPos = {
        x: this.innerPos.x + Math.cos(angle) * pushDistance * this.smoothing,
        y: this.innerPos.y + Math.sin(angle) * pushDistance * this.smoothing,
      };
    }
    
    return this.getPosition();
  }

  getPosition(): Point {
    return { ...this.innerPos };
  }

  getOuterPosition(): Point {
    return { ...this.outerPos };
  }

  setRadius(radius: number): void {
    this.radius = radius;
  }

  setSmoothing(smoothing: number): void {
    this.smoothing = smoothing;
  }

  reset(pos: Point): void {
    this.outerPos = { ...pos };
    this.innerPos = { ...pos };
  }
}

export interface LassoState {
  isActive: boolean;
  anchors: LassoAnchor[];
  currentPath: Point[];
  previewPath: Point[];
  cursorHistory: Point[];
  metrics: LassoMetrics;
}

export interface LassoMetrics {
  fps: number;
  pathComputeTime: number;
  totalPoints: number;
  anchorCount: number;
  edgeQuality: number;
  cursorSpeed: number;
  predictionConfidence: number;
}

export class MagneticLassoEngine {
  private settings: LassoSettings;
  private edgeEngine: EdgeDetectionEngine | null = null;
  private pathfinder: PathfindingEngine | null = null;
  private lazyCursor: LazyCursor;
  private imageData: ImageData | null = null;
  
  private state: LassoState = {
    isActive: false,
    anchors: [],
    currentPath: [],
    previewPath: [],
    cursorHistory: [],
    metrics: {
      fps: 0,
      pathComputeTime: 0,
      totalPoints: 0,
      anchorCount: 0,
      edgeQuality: 0,
      cursorSpeed: 0,
      predictionConfidence: 0,
    },
  };
  
  private lastAnchorTime: number = 0;
  private lastUpdateTime: number = 0;
  private frameCount: number = 0;
  private fpsUpdateTime: number = 0;

  constructor(settings: Partial<LassoSettings> = {}) {
    this.settings = { ...DEFAULT_LASSO_SETTINGS, ...settings };
    this.lazyCursor = new LazyCursor({ x: 0, y: 0 }, this.settings.cursorRadius, this.settings.smoothingFactor);
  }

  initialize(imageData: ImageData): void {
    this.imageData = imageData;
    this.edgeEngine = new EdgeDetectionEngine(imageData, this.settings.edge);
    this.edgeEngine.compute();
    this.pathfinder = new PathfindingEngine(
      this.edgeEngine,
      imageData.width,
      imageData.height,
      this.settings.pathfinding
    );
  }

  start(point: Point): void {
    this.state.isActive = true;
    this.state.anchors = [{
      point: { ...point },
      strength: 1,
      locked: true,
      edgeQuality: this.getEdgeQuality(point),
      timestamp: Date.now(),
    }];
    this.state.currentPath = [{ ...point }];
    this.state.previewPath = [];
    this.state.cursorHistory = [{ ...point }];
    this.lazyCursor.reset(point);
    this.lastAnchorTime = Date.now();
  }

  update(mousePos: Point): void {
    if (!this.state.isActive || !this.pathfinder) return;
    
    const startTime = performance.now();
    
    // Update cursor with lazy stabilization
    const stabilizedPos = this.lazyCursor.update(mousePos);
    
    // Update cursor history
    this.state.cursorHistory.push({ ...stabilizedPos });
    if (this.state.cursorHistory.length > this.settings.pathMemory) {
      this.state.cursorHistory.shift();
    }
    
    // Calculate cursor speed
    this.updateCursorSpeed(stabilizedPos);
    
    // Get last anchor
    const lastAnchor = this.state.anchors[this.state.anchors.length - 1];
    
    // Find path from last anchor to current position
    const path = this.pathfinder.findPath(lastAnchor.point, stabilizedPos, this.state.cursorHistory);
    this.state.previewPath = smoothPath(path, 2, this.settings.smoothingFactor);
    
    // Handle auto-anchoring based on variation
    this.handleAutoAnchoring(stabilizedPos);
    
    // Update metrics
    this.state.metrics.pathComputeTime = performance.now() - startTime;
    this.state.metrics.edgeQuality = this.getEdgeQuality(stabilizedPos);
    this.updateFPS();
    
    this.lastUpdateTime = Date.now();
  }

  private handleAutoAnchoring(currentPos: Point): void {
    const lastAnchor = this.state.anchors[this.state.anchors.length - 1];
    const now = Date.now();
    
    switch (this.settings.variation) {
      case 'classic':
        // Manual anchoring only
        break;
        
      case 'photoshop':
        this.handlePhotoshopAnchoring(currentPos, lastAnchor, now);
        break;
        
      case 'elastic':
        this.handleElasticAnchoring(currentPos, lastAnchor, now);
        break;
        
      case 'predictive':
        this.handlePredictiveAnchoring(currentPos, lastAnchor, now);
        break;
    }
  }

  private handlePhotoshopAnchoring(currentPos: Point, lastAnchor: LassoAnchor, now: number): void {
    if (!this.settings.autoAnchorEnabled) return;
    
    const distance = this.distance(lastAnchor.point, currentPos);
    const timeSinceLastAnchor = now - this.lastAnchorTime;
    
    // Scale thresholds by anchor frequency
    const frequencyScale = this.settings.anchorFrequency / 50;
    const distanceThreshold = this.settings.autoAnchorDistance / frequencyScale;
    const timeThreshold = this.settings.autoAnchorTime / frequencyScale;
    
    // Check if we should drop an anchor
    const shouldAnchor = 
      distance >= distanceThreshold ||
      (timeSinceLastAnchor >= timeThreshold && distance >= this.settings.minMovementForAnchor);
    
    if (shouldAnchor) {
      this.addAnchor(currentPos, 1, true);
    }
  }

  private handleElasticAnchoring(currentPos: Point, lastAnchor: LassoAnchor, now: number): void {
    const distance = this.distance(lastAnchor.point, currentPos);
    
    if (distance >= this.settings.autoAnchorDistance) {
      // Calculate strength based on position in elastic zone
      const elasticCount = Math.min(this.state.anchors.length, this.settings.elasticZoneLength);
      const baseStrength = this.calculateElasticStrength(elasticCount);
      
      this.addAnchor(currentPos, baseStrength, false);
      
      // Update strengths of elastic zone anchors
      this.updateElasticStrengths();
    }
  }

  private handlePredictiveAnchoring(currentPos: Point, lastAnchor: LassoAnchor, now: number): void {
    const distance = this.distance(lastAnchor.point, currentPos);
    if (distance < this.settings.minMovementForAnchor) return;
    
    // Analyze movement pattern
    const prediction = this.analyzePrediction();
    this.state.metrics.predictionConfidence = prediction.confidence;
    
    // Anchor when prediction confidence drops or distance threshold reached
    if (prediction.confidence < this.settings.predictionConfidenceThreshold ||
        distance >= this.settings.autoAnchorDistance) {
      this.addAnchor(currentPos, 1, true);
    }
  }

  private analyzePrediction(): { direction: number; confidence: number } {
    const history = this.state.cursorHistory;
    if (history.length < 3) {
      return { direction: 0, confidence: 0 };
    }
    
    // Calculate recent movement directions
    const directions: number[] = [];
    for (let i = 1; i < history.length; i++) {
      const dx = history[i].x - history[i - 1].x;
      const dy = history[i].y - history[i - 1].y;
      if (dx !== 0 || dy !== 0) {
        directions.push(Math.atan2(dy, dx));
      }
    }
    
    if (directions.length < 2) {
      return { direction: 0, confidence: 0 };
    }
    
    // Calculate direction consistency
    const avgDirection = directions.reduce((a, b) => a + b, 0) / directions.length;
    let variance = 0;
    for (const d of directions) {
      const diff = Math.abs(d - avgDirection);
      variance += Math.min(diff, 2 * Math.PI - diff) ** 2;
    }
    variance /= directions.length;
    
    // Higher variance = lower confidence
    const maxVariance = (Math.PI / 2) ** 2;
    const confidence = Math.max(0, 1 - variance / maxVariance);
    
    return { direction: avgDirection, confidence };
  }

  private calculateElasticStrength(position: number): number {
    const maxPosition = this.settings.elasticZoneLength;
    const t = position / maxPosition;
    
    switch (this.settings.strengthCurve) {
      case 'linear':
        return t;
      case 'exponential':
        return t * t;
      case 'ease-in-out':
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      default:
        return t;
    }
  }

  private updateElasticStrengths(): void {
    const zoneStart = Math.max(0, this.state.anchors.length - this.settings.elasticZoneLength);
    
    for (let i = zoneStart; i < this.state.anchors.length; i++) {
      const posInZone = i - zoneStart;
      const strength = this.calculateElasticStrength(posInZone + 1);
      this.state.anchors[i].strength = strength;
      this.state.anchors[i].locked = strength >= this.settings.lockThreshold;
    }
  }

  addAnchor(point: Point, strength: number = 1, locked: boolean = true): void {
    // Add path segment from last anchor
    if (this.state.previewPath.length > 0) {
      this.state.currentPath.push(...this.state.previewPath.slice(1));
    }
    
    this.state.anchors.push({
      point: { ...point },
      strength,
      locked,
      edgeQuality: this.getEdgeQuality(point),
      timestamp: Date.now(),
    });
    
    this.lastAnchorTime = Date.now();
    this.state.metrics.anchorCount = this.state.anchors.length;
    this.state.metrics.totalPoints = this.state.currentPath.length;
  }

  removeLastAnchor(): void {
    if (this.state.anchors.length <= 1) return;
    
    const removed = this.state.anchors.pop();
    if (removed) {
      // Truncate path to previous anchor
      const prevAnchor = this.state.anchors[this.state.anchors.length - 1];
      const idx = this.state.currentPath.findIndex(
        p => p.x === prevAnchor.point.x && p.y === prevAnchor.point.y
      );
      if (idx >= 0) {
        this.state.currentPath = this.state.currentPath.slice(0, idx + 1);
      }
    }
    
    this.state.metrics.anchorCount = this.state.anchors.length;
    this.state.metrics.totalPoints = this.state.currentPath.length;
  }

  complete(closePath: boolean = true): Point[] {
    if (!this.state.isActive) return [];
    
    // Add final preview segment
    if (this.state.previewPath.length > 0) {
      this.state.currentPath.push(...this.state.previewPath.slice(1));
    }
    
    // Close path if requested
    if (closePath && this.state.anchors.length > 1 && this.pathfinder) {
      const lastPoint = this.state.currentPath[this.state.currentPath.length - 1];
      const firstPoint = this.state.anchors[0].point;
      
      if (this.distance(lastPoint, firstPoint) > 3) {
        const closingPath = this.pathfinder.findPath(lastPoint, firstPoint);
        this.state.currentPath.push(...closingPath.slice(1));
      }
    }
    
    // Simplify and smooth final path
    let finalPath = simplifyPath(this.state.currentPath, 1.5);
    finalPath = smoothPath(finalPath, 2, this.settings.smoothingFactor);
    
    this.state.isActive = false;
    return finalPath;
  }

  cancel(): void {
    this.state.isActive = false;
    this.state.anchors = [];
    this.state.currentPath = [];
    this.state.previewPath = [];
    this.state.cursorHistory = [];
  }

  getState(): LassoState {
    return { ...this.state };
  }

  getSettings(): LassoSettings {
    return { ...this.settings };
  }

  updateSettings(settings: Partial<LassoSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.lazyCursor.setRadius(this.settings.cursorRadius);
    this.lazyCursor.setSmoothing(this.settings.smoothingFactor);
    
    if (this.edgeEngine) {
      this.edgeEngine.updateOptions(this.settings.edge);
      this.edgeEngine.compute();
    }
    
    if (this.pathfinder) {
      this.pathfinder.updateOptions(this.settings.pathfinding);
    }
  }

  private getEdgeQuality(point: Point): number {
    if (!this.edgeEngine) return 0;
    return this.edgeEngine.getLocalEdgeQuality(point.x, point.y);
  }

  private distance(a: Point, b: Point): number {
    return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
  }

  private updateCursorSpeed(currentPos: Point): void {
    const history = this.state.cursorHistory;
    if (history.length < 2) {
      this.state.metrics.cursorSpeed = 0;
      return;
    }
    
    const prev = history[history.length - 2];
    const dt = Date.now() - this.lastUpdateTime;
    if (dt > 0) {
      const distance = this.distance(prev, currentPos);
      this.state.metrics.cursorSpeed = (distance / dt) * 1000; // pixels per second
    }
  }

  private updateFPS(): void {
    this.frameCount++;
    const now = Date.now();
    
    if (now - this.fpsUpdateTime >= 1000) {
      this.state.metrics.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsUpdateTime = now;
    }
  }

  // Get edge trail point (where edge quality drops significantly)
  getEdgeTrailPoint(): Point | null {
    if (!this.settings.showEdgeTrail || this.state.previewPath.length < 2) {
      return null;
    }
    
    let minQuality = Infinity;
    let minPoint: Point | null = null;
    
    for (const point of this.state.previewPath) {
      const quality = this.getEdgeQuality(point);
      if (quality < minQuality) {
        minQuality = quality;
        minPoint = point;
      }
    }
    
    // Only show if quality is significantly low
    if (minQuality < 30) {
      return minPoint;
    }
    
    return null;
  }

  // Get prediction zone for predictive mode
  getPredictionZone(): { center: Point; angle: number; width: number; height: number } | null {
    if (this.settings.variation !== 'predictive' || !this.settings.showPredictionZone) {
      return null;
    }
    
    const history = this.state.cursorHistory;
    if (history.length < 3) return null;
    
    const currentPos = history[history.length - 1];
    const prediction = this.analyzePrediction();
    
    if (prediction.confidence < 0.2) return null;
    
    const zoneLength = 30 + prediction.confidence * 50;
    
    return {
      center: {
        x: currentPos.x + Math.cos(prediction.direction) * zoneLength / 2,
        y: currentPos.y + Math.sin(prediction.direction) * zoneLength / 2,
      },
      angle: prediction.direction,
      width: zoneLength,
      height: 20 + (1 - prediction.confidence) * 30,
    };
  }
}

// Preset configurations
export const LASSO_PRESETS = {
  sharpEdges: {
    edge: { method: 'canny', sensitivity: 70, threshold: 40 },
    pathfinding: { edgeWeight: 0.9, directionWeight: 0.2 },
    cursorRadius: 10,
  },
  softEdges: {
    edge: { method: 'sobel', sensitivity: 40, gaussianBlur: true, blurRadius: 2 },
    pathfinding: { edgeWeight: 0.6, cursorInfluence: 0.4 },
    cursorRadius: 20,
  },
  fastMode: {
    edge: { method: 'roberts', nonMaxSuppression: false },
    pathfinding: { maxSearchRadius: 50, algorithm: 'dijkstra' },
    autoAnchorDistance: 50,
  },
  preciseMode: {
    edge: { method: 'canny', sensitivity: 80, hysteresisLow: 15, hysteresisHigh: 90 },
    pathfinding: { edgeWeight: 0.95, maxSearchRadius: 150, algorithm: 'astar' },
    cursorRadius: 8,
    autoAnchorDistance: 20,
  },
} as const;
