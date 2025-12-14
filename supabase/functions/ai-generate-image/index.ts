import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, referenceImage, model = 'google/gemini-2.5-flash-image-preview' } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('AI Image Generation request:', { model, promptLength: prompt?.length, hasReference: !!referenceImage });

    // Build content array
    const content: any[] = [];
    
    // Add reference image if provided
    if (referenceImage) {
      content.push({
        type: 'image_url',
        image_url: {
          url: referenceImage
        }
      });
      content.push({
        type: 'text',
        text: `Using the reference image as inspiration, ${prompt}`
      });
    } else {
      content.push({
        type: 'text',
        text: prompt
      });
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'user', content }
        ],
        modalities: ['image', 'text'],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI image generation error:', response.status, errorText);
      throw new Error('AI gateway error');
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;
    const textContent = message?.content || '';
    const images = message?.images || [];

    console.log('AI Image Generation response:', { 
      textLength: textContent.length, 
      imageCount: images.length 
    });

    return new Response(JSON.stringify({ 
      text: textContent,
      images: images.map((img: any) => img?.image_url?.url || img)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('AI image generation error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
