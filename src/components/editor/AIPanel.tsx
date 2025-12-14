// AI Panel - Chat, Vision & Image Generation
import React, { useState, useRef, useCallback } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MessageSquare, 
  Eye, 
  Wand2, 
  Send, 
  ImagePlus, 
  Layers,
  Upload,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function AIPanel() {
  const { state, addLayer, getCompositeImageData } = useEditor();
  const { project } = state;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  
  // Vision state
  const [visionPrompt, setVisionPrompt] = useState('');
  const [visionResult, setVisionResult] = useState('');
  const [visionSource, setVisionSource] = useState<'canvas' | 'layer' | 'upload'>('canvas');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  
  // Image gen state
  const [genPrompt, setGenPrompt] = useState('');
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [useReference, setUseReference] = useState(false);
  const [refSource, setRefSource] = useState<'canvas' | 'layer'>('canvas');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get image data for vision/reference
  const getImageDataUrl = useCallback((source: 'canvas' | 'layer', layerId?: string): string | null => {
    if (source === 'canvas') {
      const composite = getCompositeImageData();
      if (!composite) return null;
      
      const canvas = new OffscreenCanvas(composite.width, composite.height);
      const ctx = canvas.getContext('2d')!;
      ctx.putImageData(composite, 0, 0);
      
      // Convert to data URL via blob
      const blob = canvas.convertToBlob ? null : null; // OffscreenCanvas doesn't support toDataURL directly
      // Fallback to regular canvas
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = composite.width;
      tempCanvas.height = composite.height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.putImageData(composite, 0, 0);
      return tempCanvas.toDataURL('image/png');
    } else if (source === 'layer') {
      const layer = project.layers.find(l => l.id === (layerId || project.activeLayerId));
      if (!layer?.imageData) return null;
      
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = layer.imageData.width;
      tempCanvas.height = layer.imageData.height;
      const ctx = tempCanvas.getContext('2d')!;
      ctx.putImageData(layer.imageData, 0, 0);
      return tempCanvas.toDataURL('image/png');
    }
    return null;
  }, [getCompositeImageData, project.layers, project.activeLayerId]);

  // Stream chat messages
  const sendChatMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    let assistantContent = '';
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: [...messages, userMessage] }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Chat failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response stream');

      let textBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => 
                    i === prev.length - 1 ? { ...m, content: assistantContent } : m
                  );
                }
                return [...prev, { role: 'assistant', content: assistantContent }];
              });
            }
          } catch {
            // Incomplete JSON, will be completed in next chunk
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast.error(error instanceof Error ? error.message : 'Chat failed');
    } finally {
      setIsLoading(false);
    }
  }, [input, messages, isLoading]);

  // Vision analysis
  const analyzeImage = useCallback(async () => {
    if (!visionPrompt.trim() || isLoading) return;
    
    setIsLoading(true);
    setVisionResult('');
    
    try {
      let imageData: string | null = null;
      
      if (visionSource === 'upload' && uploadedImage) {
        imageData = uploadedImage;
      } else if (visionSource === 'canvas' || visionSource === 'layer') {
        imageData = getImageDataUrl(visionSource);
      }

      if (!imageData) {
        toast.error('No image available to analyze');
        return;
      }

      const { data, error } = await supabase.functions.invoke('ai-vision', {
        body: { prompt: visionPrompt, imageData }
      });

      if (error) throw error;
      setVisionResult(data.result);
    } catch (error) {
      console.error('Vision error:', error);
      toast.error('Image analysis failed');
    } finally {
      setIsLoading(false);
    }
  }, [visionPrompt, visionSource, uploadedImage, getImageDataUrl, isLoading]);

  // Image generation
  const generateImage = useCallback(async () => {
    if (!genPrompt.trim() || isLoading) return;
    
    setIsLoading(true);
    setGeneratedImages([]);
    
    try {
      let referenceImage: string | null = null;
      
      if (useReference) {
        referenceImage = getImageDataUrl(refSource);
      }

      const { data, error } = await supabase.functions.invoke('ai-generate-image', {
        body: { prompt: genPrompt, referenceImage }
      });

      if (error) throw error;
      
      if (data.images && data.images.length > 0) {
        setGeneratedImages(data.images);
        toast.success('Image generated!');
      } else {
        toast.error('No image was generated');
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Image generation failed');
    } finally {
      setIsLoading(false);
    }
  }, [genPrompt, useReference, refSource, getImageDataUrl, isLoading]);

  // Add generated image as layer
  const addGeneratedImageAsLayer = useCallback(async (imageDataUrl: string) => {
    try {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        
        addLayer({
          id: crypto.randomUUID(),
          name: `AI Generated ${Date.now() % 10000}`,
          type: 'raster',
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: 'normal',
          bounds: { x: 0, y: 0, width: img.width, height: img.height },
          transform: { tx: 0, ty: 0, sx: 1, sy: 1, rotation: 0 },
          imageData,
          modifiers: [],
          parentId: null,
          children: [],
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        });
        
        toast.success('Added as new layer');
      };
      img.src = imageDataUrl;
    } catch (error) {
      toast.error('Failed to add image');
    }
  }, [addLayer]);

  // File upload handler
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      setUploadedImage(evt.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  return (
    <div className="flex flex-col h-full bg-panel-bg border-l border-panel-border">
      <div className="panel-header">
        <span className="text-sm font-medium">AI Assistant</span>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full grid grid-cols-3 mx-2 mt-2">
          <TabsTrigger value="chat" className="text-xs gap-1">
            <MessageSquare className="w-3 h-3" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="vision" className="text-xs gap-1">
            <Eye className="w-3 h-3" />
            Vision
          </TabsTrigger>
          <TabsTrigger value="generate" className="text-xs gap-1">
            <Wand2 className="w-3 h-3" />
            Generate
          </TabsTrigger>
        </TabsList>

        {/* Chat Tab */}
        <TabsContent value="chat" className="flex-1 flex flex-col p-2 gap-2 mt-0">
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-3 pr-2">
              {messages.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Ask about image editing, color theory, or creative ideas
                </p>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={cn(
                  "text-xs p-2 rounded-lg",
                  msg.role === 'user' 
                    ? "bg-primary/20 ml-4" 
                    : "bg-muted mr-4"
                )}>
                  {msg.content}
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="bg-muted mr-4 text-xs p-2 rounded-lg flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Thinking...
                </div>
              )}
            </div>
          </ScrollArea>
          
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
              className="min-h-[60px] text-xs resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendChatMessage();
                }
              }}
            />
            <Button 
              size="icon" 
              onClick={sendChatMessage} 
              disabled={isLoading || !input.trim()}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </TabsContent>

        {/* Vision Tab */}
        <TabsContent value="vision" className="flex-1 flex flex-col p-2 gap-2 mt-0">
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={visionSource === 'canvas' ? 'default' : 'outline'}
              onClick={() => setVisionSource('canvas')}
              className="text-xs flex-1"
            >
              <Layers className="w-3 h-3 mr-1" />
              Canvas
            </Button>
            <Button
              size="sm"
              variant={visionSource === 'layer' ? 'default' : 'outline'}
              onClick={() => setVisionSource('layer')}
              className="text-xs flex-1"
            >
              <ImagePlus className="w-3 h-3 mr-1" />
              Layer
            </Button>
            <Button
              size="sm"
              variant={visionSource === 'upload' ? 'default' : 'outline'}
              onClick={() => {
                setVisionSource('upload');
                fileInputRef.current?.click();
              }}
              className="text-xs flex-1"
            >
              <Upload className="w-3 h-3 mr-1" />
              Upload
            </Button>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
          
          {uploadedImage && visionSource === 'upload' && (
            <img src={uploadedImage} alt="Uploaded" className="max-h-24 rounded border object-contain" />
          )}
          
          <Textarea
            value={visionPrompt}
            onChange={(e) => setVisionPrompt(e.target.value)}
            placeholder="Describe what to analyze..."
            className="min-h-[60px] text-xs resize-none"
          />
          
          <Button onClick={analyzeImage} disabled={isLoading || !visionPrompt.trim()}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            Analyze
          </Button>
          
          {visionResult && (
            <ScrollArea className="flex-1 min-h-0">
              <div className="text-xs bg-muted p-2 rounded-lg whitespace-pre-wrap">
                {visionResult}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* Generate Tab */}
        <TabsContent value="generate" className="flex-1 flex flex-col p-2 gap-2 mt-0">
          <Textarea
            value={genPrompt}
            onChange={(e) => setGenPrompt(e.target.value)}
            placeholder="Describe the image to generate..."
            className="min-h-[80px] text-xs resize-none"
          />
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="useRef"
              checked={useReference}
              onChange={(e) => setUseReference(e.target.checked)}
              className="w-3 h-3"
            />
            <label htmlFor="useRef" className="text-xs">Use reference image</label>
            
            {useReference && (
              <select
                value={refSource}
                onChange={(e) => setRefSource(e.target.value as 'canvas' | 'layer')}
                className="text-xs bg-background border rounded px-2 py-1 ml-auto"
              >
                <option value="canvas">Canvas</option>
                <option value="layer">Active Layer</option>
              </select>
            )}
          </div>
          
          <Button onClick={generateImage} disabled={isLoading || !genPrompt.trim()}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
            Generate
          </Button>
          
          {generatedImages.length > 0 && (
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-2">
                {generatedImages.map((img, i) => (
                  <div key={i} className="relative group">
                    <img 
                      src={img} 
                      alt={`Generated ${i + 1}`} 
                      className="w-full rounded border" 
                    />
                    <Button
                      size="sm"
                      className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                      onClick={() => addGeneratedImageAsLayer(img)}
                    >
                      <ImagePlus className="w-3 h-3 mr-1" />
                      Add as Layer
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
