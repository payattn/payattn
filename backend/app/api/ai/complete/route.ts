/**
 * Venice AI LLM Endpoint
 * 
 * Proxies requests to Venice AI API with secure API key management
 * Docs: https://docs.venice.ai/overview/getting-started
 * 
 * POST /api/ai/complete
 * Body: {
 *   model?: string (default: 'venice-uncensored'),
 *   messages: Array<{role: 'system' | 'user' | 'assistant', content: string}>,
 *   temperature?: number,
 *   max_tokens?: number
 * }
 */

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface CompleteRequest {
  model?: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
}

interface VeniceResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    // Get API key from environment
    const apiKey = process.env.VENICE_API_KEY;
    
    if (!apiKey) {
      return Response.json(
        { error: 'Venice API key not configured' },
        { status: 500 }
      );
    }

    // Parse request body
    const body: CompleteRequest = await request.json();

    // Validate messages
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return Response.json(
        { error: 'Messages array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Default model
    const model = body.model || 'venice-uncensored';

    // Prepare request payload
    const payload = {
      model,
      messages: body.messages,
      temperature: body.temperature ?? 0.7,
      max_tokens: body.max_tokens ?? 512,
    };

    console.log('[Venice API] Sending request to Venice AI:', {
      model,
      messageCount: body.messages.length,
      maxTokens: payload.max_tokens,
    });

    // Call Venice AI API
    const veniceResponse = await fetch('https://api.venice.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!veniceResponse.ok) {
      const errorText = await veniceResponse.text();
      console.error('[Venice API] Error response:', {
        status: veniceResponse.status,
        statusText: veniceResponse.statusText,
        body: errorText,
      });

      return Response.json(
        { 
          error: `Venice API error: ${veniceResponse.statusText}`,
          details: errorText
        },
        { status: veniceResponse.status }
      );
    }

    const data: VeniceResponse = await veniceResponse.json();

    console.log('[Venice API] Success response:', {
      model: data.model,
      choicesCount: data.choices.length,
      tokensUsed: data.usage.total_tokens,
    });

    // Extract the completion text
    const completion = data.choices[0]?.message?.content;

    if (!completion) {
      return Response.json(
        { error: 'No completion in Venice response' },
        { status: 500 }
      );
    }

    // Return simplified response
    return Response.json({
      success: true,
      model: data.model,
      content: completion,
      usage: data.usage,
      raw: data, // Include full response for debugging
    });

  } catch (error) {
    console.error('[Venice API] Request failed:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    return Response.json(
      { 
        error: 'Failed to call Venice API',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
