// Comprehensive Magnetic Lasso Settings Panel
// Full control over all 4 lasso variations with real-time preview

import React, { useState, useCallback } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronDown, 
  Wand2, 
  Zap, 
  Target, 
  TrendingUp,
  Settings2,
  Palette,
  Eye,
  Activity,
  RotateCcw,
  Save,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  LassoSettings, 
  LassoVariation, 
  DEFAULT_LASSO_SETTINGS,
  LASSO_PRESETS 
} from '@/lib/editor/MagneticLasso';
import { EdgeDetectionOptions } from '@/lib/editor/EdgeDetection';
import { PathfindingOptions } from '@/lib/editor/Pathfinding';

interface LassoSettingsPanelProps {
  settings: LassoSettings;
  onSettingsChange: (settings: Partial<LassoSettings>) => void;
  metrics?: {
    fps: number;
    pathComputeTime: number;
    totalPoints: number;
    anchorCount: number;
    edgeQuality: number;
    cursorSpeed: number;
    predictionConfidence: number;
  };
}

const variationInfo: Record<LassoVariation, { icon: React.ReactNode; label: string; color: string; description: string }> = {
  classic: {
    icon: <Wand2 className="w-4 h-4" />,
    label: 'Classic Dijkstra',
    color: 'text-cyan-400',
    description: 'Pure edge-following with manual anchoring. Maximum precision.',
  },
  photoshop: {
    icon: <Zap className="w-4 h-4" />,
    label: 'Auto-Anchor',
    color: 'text-red-400',
    description: 'Photoshop-style with automatic anchor placement based on time and distance.',
  },
  elastic: {
    icon: <Target className="w-4 h-4" />,
    label: 'Elastic Progressive',
    color: 'text-yellow-400',
    description: 'Progressive anchor strength with rubber-band correction for recent paths.',
  },
  predictive: {
    icon: <TrendingUp className="w-4 h-4" />,
    label: 'Predictive',
    color: 'text-blue-400',
    description: 'AI-like pattern analysis for direction prediction and smart anchoring.',
  },
};

export function LassoSettingsPanel({ 
  settings, 
  onSettingsChange,
  metrics 
}: LassoSettingsPanelProps) {
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState({
    core: true,
    edge: false,
    pathfinding: false,
    anchoring: false,
    visualization: false,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleVariationChange = useCallback((variation: LassoVariation) => {
    onSettingsChange({ variation });
    setActivePreset(null);
  }, [onSettingsChange]);

  const handlePresetApply = useCallback((presetName: keyof typeof LASSO_PRESETS) => {
    const preset = LASSO_PRESETS[presetName];
    onSettingsChange(preset as Partial<LassoSettings>);
    setActivePreset(presetName);
  }, [onSettingsChange]);

  const handleReset = useCallback(() => {
    onSettingsChange(DEFAULT_LASSO_SETTINGS);
    setActivePreset(null);
  }, [onSettingsChange]);

  const updateEdge = (updates: Partial<EdgeDetectionOptions>) => {
    onSettingsChange({ edge: { ...settings.edge, ...updates } });
  };

  const updatePathfinding = (updates: Partial<PathfindingOptions>) => {
    onSettingsChange({ pathfinding: { ...settings.pathfinding, ...updates } });
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Header with metrics */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Magnetic Lasso
            </h3>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset
            </Button>
          </div>

          {/* Real-time metrics */}
          {settings.showMetrics && metrics && (
            <div className="grid grid-cols-3 gap-2 p-2 bg-muted/30 rounded-lg text-xs">
              <div className="text-center">
                <div className="text-muted-foreground">FPS</div>
                <div className={cn("font-mono font-bold", metrics.fps >= 30 ? 'text-green-400' : 'text-red-400')}>
                  {metrics.fps}
                </div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground">Points</div>
                <div className="font-mono font-bold text-foreground">{metrics.totalPoints}</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground">Anchors</div>
                <div className="font-mono font-bold text-foreground">{metrics.anchorCount}</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground">Path ms</div>
                <div className="font-mono font-bold text-foreground">{metrics.pathComputeTime.toFixed(1)}</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground">Edge Q</div>
                <div className={cn("font-mono font-bold", metrics.edgeQuality > 50 ? 'text-green-400' : 'text-yellow-400')}>
                  {metrics.edgeQuality.toFixed(0)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground">Speed</div>
                <div className="font-mono font-bold text-foreground">{metrics.cursorSpeed.toFixed(0)}</div>
              </div>
            </div>
          )}
        </div>

        {/* Variation Selection */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Lasso Variation</Label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(variationInfo) as [LassoVariation, typeof variationInfo['classic']][]).map(([key, info]) => (
              <button
                key={key}
                onClick={() => handleVariationChange(key)}
                className={cn(
                  "p-2 rounded-lg border text-left transition-all",
                  settings.variation === key
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                <div className={cn("flex items-center gap-1.5 text-xs font-medium", info.color)}>
                  {info.icon}
                  {info.label}
                </div>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {variationInfo[settings.variation].description}
          </p>
        </div>

        {/* Quick Presets */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Quick Presets</Label>
          <div className="flex flex-wrap gap-1">
            {Object.keys(LASSO_PRESETS).map((presetName) => (
              <Badge
                key={presetName}
                variant={activePreset === presetName ? "default" : "outline"}
                className="cursor-pointer capitalize text-xs"
                onClick={() => handlePresetApply(presetName as keyof typeof LASSO_PRESETS)}
              >
                {presetName.replace(/([A-Z])/g, ' $1').trim()}
              </Badge>
            ))}
          </div>
        </div>

        {/* Core Settings */}
        <Collapsible open={openSections.core} onOpenChange={() => toggleSection('core')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded hover:bg-muted/50">
            <span className="text-sm font-medium flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              Core Settings
            </span>
            <ChevronDown className={cn("w-4 h-4 transition-transform", openSections.core && "rotate-180")} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <Label>Cursor Radius</Label>
                <span className="text-muted-foreground">{settings.cursorRadius}px</span>
              </div>
              <Slider
                value={[settings.cursorRadius]}
                onValueChange={([v]) => onSettingsChange({ cursorRadius: v })}
                min={5}
                max={50}
                step={1}
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <Label>Edge Search Radius</Label>
                <span className="text-muted-foreground">{settings.edgeSearchRadius}px</span>
              </div>
              <Slider
                value={[settings.edgeSearchRadius]}
                onValueChange={([v]) => onSettingsChange({ edgeSearchRadius: v })}
                min={5}
                max={50}
                step={1}
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <Label>Smoothing Factor</Label>
                <span className="text-muted-foreground">{settings.smoothingFactor.toFixed(2)}</span>
              </div>
              <Slider
                value={[settings.smoothingFactor * 100]}
                onValueChange={([v]) => onSettingsChange({ smoothingFactor: v / 100 })}
                min={10}
                max={100}
                step={5}
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <Label>Path Memory</Label>
                <span className="text-muted-foreground">{settings.pathMemory} points</span>
              </div>
              <Slider
                value={[settings.pathMemory]}
                onValueChange={([v]) => onSettingsChange({ pathMemory: v })}
                min={2}
                max={15}
                step={1}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Edge Detection Settings */}
        <Collapsible open={openSections.edge} onOpenChange={() => toggleSection('edge')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded hover:bg-muted/50">
            <span className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Edge Detection
            </span>
            <ChevronDown className={cn("w-4 h-4 transition-transform", openSections.edge && "rotate-180")} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">Method</Label>
              <Select
                value={settings.edge.method}
                onValueChange={(v) => updateEdge({ method: v as EdgeDetectionOptions['method'] })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sobel">Sobel</SelectItem>
                  <SelectItem value="prewitt">Prewitt</SelectItem>
                  <SelectItem value="scharr">Scharr</SelectItem>
                  <SelectItem value="roberts">Roberts Cross</SelectItem>
                  <SelectItem value="log">Laplacian of Gaussian</SelectItem>
                  <SelectItem value="canny">Canny (Full Pipeline)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <Label>Sensitivity</Label>
                <span className="text-muted-foreground">{settings.edge.sensitivity}</span>
              </div>
              <Slider
                value={[settings.edge.sensitivity]}
                onValueChange={([v]) => updateEdge({ sensitivity: v })}
                min={0}
                max={100}
                step={1}
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <Label>Threshold</Label>
                <span className="text-muted-foreground">{settings.edge.threshold}</span>
              </div>
              <Slider
                value={[settings.edge.threshold]}
                onValueChange={([v]) => updateEdge({ threshold: v })}
                min={0}
                max={255}
                step={1}
              />
            </div>

            {settings.edge.method === 'canny' && (
              <>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <Label>Hysteresis Low</Label>
                    <span className="text-muted-foreground">{settings.edge.hysteresisLow}</span>
                  </div>
                  <Slider
                    value={[settings.edge.hysteresisLow]}
                    onValueChange={([v]) => updateEdge({ hysteresisLow: v })}
                    min={0}
                    max={255}
                    step={1}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <Label>Hysteresis High</Label>
                    <span className="text-muted-foreground">{settings.edge.hysteresisHigh}</span>
                  </div>
                  <Slider
                    value={[settings.edge.hysteresisHigh]}
                    onValueChange={([v]) => updateEdge({ hysteresisHigh: v })}
                    min={0}
                    max={255}
                    step={1}
                  />
                </div>
              </>
            )}

            <div className="flex items-center justify-between">
              <Label className="text-xs">Gaussian Blur</Label>
              <Switch
                checked={settings.edge.gaussianBlur}
                onCheckedChange={(v) => updateEdge({ gaussianBlur: v })}
              />
            </div>

            {settings.edge.gaussianBlur && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <Label>Blur Radius</Label>
                  <span className="text-muted-foreground">{settings.edge.blurRadius.toFixed(1)}</span>
                </div>
                <Slider
                  value={[settings.edge.blurRadius * 10]}
                  onValueChange={([v]) => updateEdge({ blurRadius: v / 10 })}
                  min={5}
                  max={50}
                  step={1}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label className="text-xs">Non-Maximum Suppression</Label>
              <Switch
                checked={settings.edge.nonMaxSuppression}
                onCheckedChange={(v) => updateEdge({ nonMaxSuppression: v })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Adaptive Edge</Label>
              <Switch
                checked={settings.edge.adaptiveEdge}
                onCheckedChange={(v) => updateEdge({ adaptiveEdge: v })}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Pathfinding Settings */}
        <Collapsible open={openSections.pathfinding} onOpenChange={() => toggleSection('pathfinding')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded hover:bg-muted/50">
            <span className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Pathfinding
            </span>
            <ChevronDown className={cn("w-4 h-4 transition-transform", openSections.pathfinding && "rotate-180")} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">Algorithm</Label>
              <Select
                value={settings.pathfinding.algorithm}
                onValueChange={(v) => updatePathfinding({ algorithm: v as 'dijkstra' | 'astar' })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dijkstra">Dijkstra</SelectItem>
                  <SelectItem value="astar">A* (Faster)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Connectivity</Label>
              <Select
                value={String(settings.pathfinding.connectivity)}
                onValueChange={(v) => updatePathfinding({ connectivity: Number(v) as 4 | 8 })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4-Connected</SelectItem>
                  <SelectItem value="8">8-Connected (Diagonals)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <Label>Edge Weight</Label>
                <span className="text-muted-foreground">{(settings.pathfinding.edgeWeight * 100).toFixed(0)}%</span>
              </div>
              <Slider
                value={[settings.pathfinding.edgeWeight * 100]}
                onValueChange={([v]) => updatePathfinding({ edgeWeight: v / 100 })}
                min={0}
                max={100}
                step={5}
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <Label>Direction Weight</Label>
                <span className="text-muted-foreground">{(settings.pathfinding.directionWeight * 100).toFixed(0)}%</span>
              </div>
              <Slider
                value={[settings.pathfinding.directionWeight * 100]}
                onValueChange={([v]) => updatePathfinding({ directionWeight: v / 100 })}
                min={0}
                max={100}
                step={5}
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <Label>Cursor Influence</Label>
                <span className="text-muted-foreground">{(settings.pathfinding.cursorInfluence * 100).toFixed(0)}%</span>
              </div>
              <Slider
                value={[settings.pathfinding.cursorInfluence * 100]}
                onValueChange={([v]) => updatePathfinding({ cursorInfluence: v / 100 })}
                min={0}
                max={100}
                step={5}
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <Label>Max Search Radius</Label>
                <span className="text-muted-foreground">{settings.pathfinding.maxSearchRadius}px</span>
              </div>
              <Slider
                value={[settings.pathfinding.maxSearchRadius]}
                onValueChange={([v]) => updatePathfinding({ maxSearchRadius: v })}
                min={20}
                max={200}
                step={10}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Anchoring Settings (varies by mode) */}
        <Collapsible open={openSections.anchoring} onOpenChange={() => toggleSection('anchoring')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded hover:bg-muted/50">
            <span className="text-sm font-medium flex items-center gap-2">
              <Target className="w-4 h-4" />
              Anchoring ({settings.variation})
            </span>
            <ChevronDown className={cn("w-4 h-4 transition-transform", openSections.anchoring && "rotate-180")} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">
            {(settings.variation === 'photoshop' || settings.variation === 'elastic' || settings.variation === 'predictive') && (
              <>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Auto-Anchor</Label>
                  <Switch
                    checked={settings.autoAnchorEnabled}
                    onCheckedChange={(v) => onSettingsChange({ autoAnchorEnabled: v })}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <Label>Anchor Distance</Label>
                    <span className="text-muted-foreground">{settings.autoAnchorDistance}px</span>
                  </div>
                  <Slider
                    value={[settings.autoAnchorDistance]}
                    onValueChange={([v]) => onSettingsChange({ autoAnchorDistance: v })}
                    min={10}
                    max={100}
                    step={5}
                  />
                </div>
              </>
            )}

            {settings.variation === 'photoshop' && (
              <>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <Label>Anchor Time</Label>
                    <span className="text-muted-foreground">{settings.autoAnchorTime}ms</span>
                  </div>
                  <Slider
                    value={[settings.autoAnchorTime]}
                    onValueChange={([v]) => onSettingsChange({ autoAnchorTime: v })}
                    min={100}
                    max={2000}
                    step={100}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <Label>Anchor Frequency</Label>
                    <span className="text-muted-foreground">{settings.anchorFrequency}</span>
                  </div>
                  <Slider
                    value={[settings.anchorFrequency]}
                    onValueChange={([v]) => onSettingsChange({ anchorFrequency: v })}
                    min={0}
                    max={100}
                    step={5}
                  />
                </div>
              </>
            )}

            {settings.variation === 'elastic' && (
              <>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <Label>Elastic Zone Length</Label>
                    <span className="text-muted-foreground">{settings.elasticZoneLength} anchors</span>
                  </div>
                  <Slider
                    value={[settings.elasticZoneLength]}
                    onValueChange={([v]) => onSettingsChange({ elasticZoneLength: v })}
                    min={1}
                    max={15}
                    step={1}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Strength Curve</Label>
                  <Select
                    value={settings.strengthCurve}
                    onValueChange={(v) => onSettingsChange({ strengthCurve: v as 'linear' | 'exponential' | 'ease-in-out' })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="linear">Linear</SelectItem>
                      <SelectItem value="exponential">Exponential</SelectItem>
                      <SelectItem value="ease-in-out">Ease In-Out</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <Label>Lock Threshold</Label>
                    <span className="text-muted-foreground">{(settings.lockThreshold * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    value={[settings.lockThreshold * 100]}
                    onValueChange={([v]) => onSettingsChange({ lockThreshold: v / 100 })}
                    min={50}
                    max={100}
                    step={5}
                  />
                </div>
              </>
            )}

            {settings.variation === 'predictive' && (
              <>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <Label>Prediction Cone Angle</Label>
                    <span className="text-muted-foreground">{settings.predictionConeAngle}°</span>
                  </div>
                  <Slider
                    value={[settings.predictionConeAngle]}
                    onValueChange={([v]) => onSettingsChange({ predictionConeAngle: v })}
                    min={15}
                    max={90}
                    step={5}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <Label>Confidence Threshold</Label>
                    <span className="text-muted-foreground">{(settings.predictionConfidenceThreshold * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    value={[settings.predictionConfidenceThreshold * 100]}
                    onValueChange={([v]) => onSettingsChange({ predictionConfidenceThreshold: v / 100 })}
                    min={20}
                    max={90}
                    step={5}
                  />
                </div>
              </>
            )}

            {settings.variation === 'classic' && (
              <p className="text-xs text-muted-foreground italic">
                Classic mode uses manual anchoring only. Click to place anchors.
              </p>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Visualization Settings */}
        <Collapsible open={openSections.visualization} onOpenChange={() => toggleSection('visualization')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded hover:bg-muted/50">
            <span className="text-sm font-medium flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Visualization
            </span>
            <ChevronDown className={cn("w-4 h-4 transition-transform", openSections.visualization && "rotate-180")} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <Label>Node Size</Label>
                <span className="text-muted-foreground">{settings.nodeSize}px</span>
              </div>
              <Slider
                value={[settings.nodeSize]}
                onValueChange={([v]) => onSettingsChange({ nodeSize: v })}
                min={2}
                max={12}
                step={1}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Show Edge Trail</Label>
              <Switch
                checked={settings.showEdgeTrail}
                onCheckedChange={(v) => onSettingsChange({ showEdgeTrail: v })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Show Elastic Gradient</Label>
              <Switch
                checked={settings.showElasticGradient}
                onCheckedChange={(v) => onSettingsChange({ showElasticGradient: v })}
                disabled={settings.variation !== 'elastic'}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Show Prediction Zone</Label>
              <Switch
                checked={settings.showPredictionZone}
                onCheckedChange={(v) => onSettingsChange({ showPredictionZone: v })}
                disabled={settings.variation !== 'predictive'}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Show Metrics</Label>
              <Switch
                checked={settings.showMetrics}
                onCheckedChange={(v) => onSettingsChange({ showMetrics: v })}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Keyboard shortcuts info */}
        <div className="p-3 bg-muted/30 rounded-lg space-y-1.5 text-xs">
          <div className="font-medium text-foreground">Keyboard Shortcuts</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
            <div><kbd className="px-1 bg-muted rounded text-2xs">Click</kbd> Add anchor</div>
            <div><kbd className="px-1 bg-muted rounded text-2xs">Backspace</kbd> Remove last</div>
            <div><kbd className="px-1 bg-muted rounded text-2xs">Double-click</kbd> Complete</div>
            <div><kbd className="px-1 bg-muted rounded text-2xs">Esc</kbd> Cancel</div>
            <div><kbd className="px-1 bg-muted rounded text-2xs">Enter</kbd> Close path</div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
