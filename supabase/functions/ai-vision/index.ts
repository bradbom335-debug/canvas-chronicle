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
    const { prompt, imageData, model = 'google/gemini-2.5-flash' } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('AI Vision request:', { model, hasImage: !!imageData, promptLength: prompt?.length });

    // Build content array with text and optional image
    const content: any[] = [
      { type: 'text', text: prompt }
    ];

    if (imageData) {
      content.push({
        type: 'image_url',
        image_url: {
          url: imageData // Expects data:image/png;base64,... or URL
        }
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
          { 
            role: 'system', 
            content: `You are an expert image analysis assistant. Analyze images carefully and provide detailed, actionable insights about:
- Composition and visual elements
- Color palette and contrast
- Suggested improvements and edits
- Technical observations (lighting, focus, perspective)
- Creative interpretations and ideas

Be specific and reference particular areas of the image when possible.`
          },
          { role: 'user', content }
        ],
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
      console.error('AI vision error:', response.status, errorText);
      throw new Error('AI gateway error');
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || 'No response generated';

    console.log('AI Vision response length:', result.length);

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('AI vision error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
