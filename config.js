// config.js
// Ganti AI_PROVIDER ke 'groq' jika Ollama tidak tersedia

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const CONFIG = {
  // Pilihan: 'ollama' atau 'groq'
  AI_PROVIDER: 'ollama',

  // Ollama settings
  // Jika lokal di port 8000 (PHP server), gunakan PHP proxy.
  // Jika di Vercel (production), langsung tembak ke localhost client dari browser agar tidak diblokir cloud server.
  OLLAMA_URL: isLocalhost && window.location.port === '8000'
    ? 'http://localhost:8000/ollama-proxy.php?endpoint=api/generate'
    : 'http://localhost:11434/api/generate',
  OLLAMA_MODEL: 'gemma3:latest', // ganti sesuai model yang kamu pull

  // Groq settings (menggunakan Vercel proxy agar API key aman)
  GROQ_PROXY_URL: '/api/ai-proxy',
  GROQ_API_KEY: 'gsk_xxxx_ganti_dengan_key_kamu', // Hanya dipakai untuk test offline di localhost jika tidak melalui proxy
  GROQ_URL:     'https://api.groq.com/openai/v1/chat/completions',
  GROQ_MODEL:   'llama-3.1-8b-instant',

  // Bahasa respons
  LANGUAGE: 'Indonesian'
};