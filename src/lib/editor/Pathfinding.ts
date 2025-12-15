// Advanced Pathfinding Engine for Magnetic Lasso
// Implements Dijkstra and A* with edge cost integration

import { Point } from '@/types/editor';
import { EdgeDetectionEngine } from './EdgeDetection';

export interface PathNode {
  x: number;
  y: number;
  cost: number;
  heuristic: number;
  parent: PathNode | null;
}

export interface PathfindingOptions {
  algorithm: 'dijkstra' | 'astar';
  connectivity: 4 | 8;
  edgeWeight: number;         // How much to prefer edges (0-1)
  directionWeight: number;    // Weight for direction continuity (0-1)
  distanceWeight: number;     // Weight for distance traveled (0-1)
  cursorInfluence: number;    // How much cursor position affects path (0-1)
  maxSearchRadius: number;    // Maximum search distance
  smoothingFactor: number;    // Path smoothing (0-1)
}

export const DEFAULT_PATHFINDING_OPTIONS: PathfindingOptions = {
  algorithm: 'dijkstra',
  connectivity: 8,
  edgeWeight: 0.8,
  directionWeight: 0.3,
  distanceWeight: 0.1,
  cursorInfluence: 0.2,
  maxSearchRadius: 100,
  smoothingFactor: 0.5,
};

// Min-heap for priority queue
class MinHeap {
  private heap: PathNode[] = [];

  push(node: PathNode): void {
    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): PathNode | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) return this.heap.pop();

    const min = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.bubbleDown(0);
    return min;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.getCost(index) >= this.getCost(parentIndex)) break;
      this.swap(index, parentIndex);
      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let smallest = index;

      if (left < this.heap.length && this.getCost(left) < this.getCost(smallest)) {
        smallest = left;
      }
      if (right < this.heap.length && this.getCost(right) < this.getCost(smallest)) {
        smallest = right;
      }

      if (smallest === index) break;
      this.swap(index, smallest);
      index = smallest;
    }
  }

  private getCost(index: number): number {
    const node = this.heap[index];
    return node.cost + node.heuristic;
  }

  private swap(i: number, j: number): void {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }
}

export class PathfindingEngine {
  private edgeEngine: EdgeDetectionEngine;
  private options: PathfindingOptions;
  private width: number;
  private height: number;

  constructor(
    edgeEngine: EdgeDetectionEngine,
    width: number,
    height: number,
    options: Partial<PathfindingOptions> = {}
  ) {
    this.edgeEngine = edgeEngine;
    this.width = width;
    this.height = height;
    this.options = { ...DEFAULT_PATHFINDING_OPTIONS, ...options };
  }

  private getNeighbors(x: number, y: number): Point[] {
    const neighbors: Point[] = [];
    const dirs4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const dirs8 = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
    const dirs = this.options.connectivity === 8 ? dirs8 : dirs4;

    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
        neighbors.push({ x: nx, y: ny });
      }
    }

    return neighbors;
  }

  private euclideanDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  private manhattanDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.abs(x2 - x1) + Math.abs(y2 - y1);
  }

  private computeMoveCost(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    previousDirection?: number
  ): number {
    const { edgeWeight, directionWeight, distanceWeight } = this.options;
    
    // Base distance cost
    const isDiagonal = fromX !== toX && fromY !== toY;
    const distanceCost = isDiagonal ? Math.SQRT2 : 1;
    
    // Edge cost (lower for stronger edges)
    const edgeCost = this.edgeEngine.getEdgeCost(toX, toY) / 255;
    
    // Direction continuity cost
    let directionCost = 0;
    if (previousDirection !== undefined) {
      const currentDirection = Math.atan2(toY - fromY, toX - fromX);
      const angleDiff = Math.abs(currentDirection - previousDirection);
      directionCost = Math.min(angleDiff, 2 * Math.PI - angleDiff) / Math.PI;
    }
    
    // Combined weighted cost
    const totalCost = 
      distanceCost * distanceWeight +
      edgeCost * edgeWeight +
      directionCost * directionWeight;
    
    return totalCost;
  }

  findPath(start: Point, end: Point, cursorPath?: Point[]): Point[] {
    if (this.options.algorithm === 'astar') {
      return this.astar(start, end, cursorPath);
    }
    return this.dijkstra(start, end, cursorPath);
  }

  private dijkstra(start: Point, end: Point, cursorPath?: Point[]): Point[] {
    const visited = new Set<string>();
    const costs = new Map<string, number>();
    const parents = new Map<string, Point | null>();
    const heap = new MinHeap();
    
    const key = (p: Point) => `${p.x},${p.y}`;
    
    costs.set(key(start), 0);
    parents.set(key(start), null);
    heap.push({ x: start.x, y: start.y, cost: 0, heuristic: 0, parent: null });
    
    let iterations = 0;
    const maxIterations = this.width * this.height;
    
    while (!heap.isEmpty() && iterations < maxIterations) {
      iterations++;
      const current = heap.pop()!;
      const currentKey = key(current);
      
      if (visited.has(currentKey)) continue;
      visited.add(currentKey);
      
      // Check if we reached the goal
      if (current.x === end.x && current.y === end.y) {
        return this.reconstructPath(parents, end);
      }
      
      // Check if we're too far from the search area
      const distToEnd = this.euclideanDistance(current.x, current.y, end.x, end.y);
      if (distToEnd > this.options.maxSearchRadius) continue;
      
      const neighbors = this.getNeighbors(current.x, current.y);
      const prevDirection = current.parent 
        ? Math.atan2(current.y - current.parent.y, current.x - current.parent.x)
        : undefined;
      
      for (const neighbor of neighbors) {
        const neighborKey = key(neighbor);
        if (visited.has(neighborKey)) continue;
        
        let moveCost = this.computeMoveCost(
          current.x, current.y,
          neighbor.x, neighbor.y,
          prevDirection
        );
        
        // Apply cursor influence if cursor path is provided
        if (cursorPath && cursorPath.length > 0) {
          const cursorInfluence = this.computeCursorInfluence(neighbor, cursorPath);
          moveCost *= (1 - cursorInfluence * this.options.cursorInfluence);
        }
        
        const newCost = (costs.get(currentKey) || 0) + moveCost;
        
        if (!costs.has(neighborKey) || newCost < costs.get(neighborKey)!) {
          costs.set(neighborKey, newCost);
          parents.set(neighborKey, current);
          heap.push({
            x: neighbor.x,
            y: neighbor.y,
            cost: newCost,
            heuristic: 0,
            parent: current,
          });
        }
      }
    }
    
    // If no path found, return direct line
    return this.directPath(start, end);
  }

  private astar(start: Point, end: Point, cursorPath?: Point[]): Point[] {
    const visited = new Set<string>();
    const costs = new Map<string, number>();
    const parents = new Map<string, Point | null>();
    const heap = new MinHeap();
    
    const key = (p: Point) => `${p.x},${p.y}`;
    
    costs.set(key(start), 0);
    parents.set(key(start), null);
    
    const startHeuristic = this.euclideanDistance(start.x, start.y, end.x, end.y);
    heap.push({ x: start.x, y: start.y, cost: 0, heuristic: startHeuristic, parent: null });
    
    let iterations = 0;
    const maxIterations = this.options.maxSearchRadius * this.options.maxSearchRadius;
    
    while (!heap.isEmpty() && iterations < maxIterations) {
      iterations++;
      const current = heap.pop()!;
      const currentKey = key(current);
      
      if (visited.has(currentKey)) continue;
      visited.add(currentKey);
      
      if (current.x === end.x && current.y === end.y) {
        return this.reconstructPath(parents, end);
      }
      
      const neighbors = this.getNeighbors(current.x, current.y);
      const prevDirection = current.parent 
        ? Math.atan2(current.y - current.parent.y, current.x - current.parent.x)
        : undefined;
      
      for (const neighbor of neighbors) {
        const neighborKey = key(neighbor);
        if (visited.has(neighborKey)) continue;
        
        let moveCost = this.computeMoveCost(
          current.x, current.y,
          neighbor.x, neighbor.y,
          prevDirection
        );
        
        if (cursorPath && cursorPath.length > 0) {
          const cursorInfluence = this.computeCursorInfluence(neighbor, cursorPath);
          moveCost *= (1 - cursorInfluence * this.options.cursorInfluence);
        }
        
        const newCost = (costs.get(currentKey) || 0) + moveCost;
        
        if (!costs.has(neighborKey) || newCost < costs.get(neighborKey)!) {
          costs.set(neighborKey, newCost);
          parents.set(neighborKey, current);
          
          const heuristic = this.euclideanDistance(neighbor.x, neighbor.y, end.x, end.y);
          heap.push({
            x: neighbor.x,
            y: neighbor.y,
            cost: newCost,
            heuristic,
            parent: current,
          });
        }
      }
    }
    
    return this.directPath(start, end);
  }

  private computeCursorInfluence(point: Point, cursorPath: Point[]): number {
    let minDist = Infinity;
    for (const cp of cursorPath) {
      const dist = this.euclideanDistance(point.x, point.y, cp.x, cp.y);
      if (dist < minDist) minDist = dist;
    }
    // Closer to cursor path = higher influence (0-1)
    return Math.max(0, 1 - minDist / 10);
  }

  private reconstructPath(parents: Map<string, Point | null>, end: Point): Point[] {
    const path: Point[] = [];
    let current: Point | null = end;
    const key = (p: Point) => `${p.x},${p.y}`;
    
    while (current) {
      path.unshift({ ...current });
      current = parents.get(key(current)) || null;
    }
    
    return path;
  }

  private directPath(start: Point, end: Point): Point[] {
    const path: Point[] = [];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    
    if (steps === 0) return [{ ...start }];
    
    for (let i = 0; i <= steps; i++) {
      path.push({
        x: Math.round(start.x + (dx * i) / steps),
        y: Math.round(start.y + (dy * i) / steps),
      });
    }
    
    return path;
  }

  updateOptions(options: Partial<PathfindingOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

// Path utilities
export function simplifyPath(path: Point[], epsilon: number = 1.0): Point[] {
  if (path.length < 3) return [...path];
  
  // Ramer-Douglas-Peucker algorithm
  const rdp = (points: Point[], start: number, end: number, result: Point[]): void => {
    let maxDist = 0;
    let maxIndex = 0;
    
    const startPoint = points[start];
    const endPoint = points[end];
    
    for (let i = start + 1; i < end; i++) {
      const dist = perpendicularDistance(points[i], startPoint, endPoint);
      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = i;
      }
    }
    
    if (maxDist > epsilon) {
      rdp(points, start, maxIndex, result);
      rdp(points, maxIndex, end, result);
    } else {
      if (!result.includes(startPoint)) result.push(startPoint);
      if (!result.includes(endPoint)) result.push(endPoint);
    }
  };
  
  const result: Point[] = [];
  rdp(path, 0, path.length - 1, result);
  return result;
}

function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  
  if (dx === 0 && dy === 0) {
    return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
  }
  
  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
  const clampedT = Math.max(0, Math.min(1, t));
  
  const nearestX = lineStart.x + clampedT * dx;
  const nearestY = lineStart.y + clampedT * dy;
  
  return Math.sqrt((point.x - nearestX) ** 2 + (point.y - nearestY) ** 2);
}

export function smoothPath(path: Point[], iterations: number = 2, factor: number = 0.25): Point[] {
  if (path.length < 3) return [...path];
  
  let smoothed = [...path];
  
  for (let iter = 0; iter < iterations; iter++) {
    const newPath: Point[] = [smoothed[0]];
    
    for (let i = 1; i < smoothed.length - 1; i++) {
      const prev = smoothed[i - 1];
      const curr = smoothed[i];
      const next = smoothed[i + 1];
      
      newPath.push({
        x: curr.x + factor * (prev.x + next.x - 2 * curr.x),
        y: curr.y + factor * (prev.y + next.y - 2 * curr.y),
      });
    }
    
    newPath.push(smoothed[smoothed.length - 1]);
    smoothed = newPath;
  }
  
  return smoothed;
}

export function chaikinSmooth(path: Point[], iterations: number = 2): Point[] {
  if (path.length < 3) return [...path];
  
  let result = [...path];
  
  for (let iter = 0; iter < iterations; iter++) {
    const newPath: Point[] = [result[0]];
    
    for (let i = 0; i < result.length - 1; i++) {
      const p0 = result[i];
      const p1 = result[i + 1];
      
      newPath.push({
        x: 0.75 * p0.x + 0.25 * p1.x,
        y: 0.75 * p0.y + 0.25 * p1.y,
      });
      newPath.push({
        x: 0.25 * p0.x + 0.75 * p1.x,
        y: 0.25 * p0.y + 0.75 * p1.y,
      });
    }
    
    newPath.push(result[result.length - 1]);
    result = newPath;
  }
  
  return result;
}

export function getPathLength(path: Point[]): number {
  let length = 0;
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x;
    const dy = path[i].y - path[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}

export function resamplePath(path: Point[], spacing: number = 5): Point[] {
  if (path.length < 2) return [...path];
  
  const totalLength = getPathLength(path);
  const numPoints = Math.ceil(totalLength / spacing);
  if (numPoints < 2) return [...path];
  
  const resampled: Point[] = [path[0]];
  let currentDist = spacing;
  let segmentStart = 0;
  let distSoFar = 0;
  
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x;
    const dy = path[i].y - path[i - 1].y;
    const segmentLength = Math.sqrt(dx * dx + dy * dy);
    
    while (distSoFar + segmentLength >= currentDist) {
      const t = (currentDist - distSoFar) / segmentLength;
      resampled.push({
        x: path[i - 1].x + t * dx,
        y: path[i - 1].y + t * dy,
      });
      currentDist += spacing;
    }
    
    distSoFar += segmentLength;
  }
  
  if (resampled.length > 0 && 
      (resampled[resampled.length - 1].x !== path[path.length - 1].x ||
       resampled[resampled.length - 1].y !== path[path.length - 1].y)) {
    resampled.push(path[path.length - 1]);
  }
  
  return resampled;
}
