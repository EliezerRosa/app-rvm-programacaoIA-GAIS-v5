const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
};

const GOOGLE_MODEL_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

interface Env {
  GEMINI_API_KEY: string;
}

type ProxyRequestBody = {
  prompt: string;
  responseSchema?: unknown;
};

async function callGemini(prompt: string, responseSchema: unknown, apiKey: string) {
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema
    }
  };

  const response = await fetch(`${GOOGLE_MODEL_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Gemini API error (${response.status}): ${JSON.stringify(data)}`);
  }

  const text = (data?.candidates ?? [])
    .flatMap((candidate: any) => candidate?.content?.parts ?? [])
    .map((part: any) => part?.text ?? '')
    .join('');

  if (!text) {
    throw new Error('Gemini API response did not include any text output.');
  }

  return { text, raw: data };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
    }

    if (!env.GEMINI_API_KEY) {
      return new Response('GEMINI_API_KEY is not configured.', { status: 500, headers: CORS_HEADERS });
    }

    let body: ProxyRequestBody;
    try {
      body = await request.json();
    } catch (error) {
      return new Response(`Invalid JSON body: ${error}`, { status: 400, headers: CORS_HEADERS });
    }

    if (!body?.prompt) {
      return new Response('Missing "prompt" in request body.', { status: 400, headers: CORS_HEADERS });
    }

    try {
      const { text, raw } = await callGemini(body.prompt, body.responseSchema, env.GEMINI_API_KEY);
      return new Response(JSON.stringify({ text, raw }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    } catch (error) {
      return new Response(`Proxy error: ${error instanceof Error ? error.message : String(error)}`, {
        status: 502,
        headers: CORS_HEADERS
      });
    }
  }
};
