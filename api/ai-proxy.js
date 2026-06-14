// api/ai-proxy.js

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { provider, prompt, messages, model } = req.body || {};

    if (provider === 'groq') {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: 'Groq API Key tidak terkonfigurasi di Vercel Environment Variables. Silakan tambahkan GROQ_API_KEY di dashboard Vercel.'
        });
      }

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || 'llama-3.1-8b-instant',
          messages: messages,
          max_tokens: 500,
          temperature: 0.3
        })
      });

      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json({
          error: data.error?.message || 'Terjadi kesalahan dari API Groq.'
        });
      }
      return res.status(200).json(data);

    } else if (provider === 'ollama') {
      // Proxy ke Ollama lokal (berfungsi di local environment / vercel dev)
      const targetUrl = 'http://localhost:11434/api/generate';

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model || 'gemma3:latest',
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.3,
            num_predict: 800
          }
        })
      });

      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json({
          error: 'Terjadi kesalahan pada layanan local Ollama.'
        });
      }
      return res.status(200).json(data);

    } else {
      return res.status(400).json({ error: 'Provider tidak didukung atau tidak ditentukan.' });
    }
  } catch (error) {
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
}
