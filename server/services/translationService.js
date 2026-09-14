/**
 * TranslationService - Pluggable translation backend with adapter pattern.
 *
 * Supported backends:
 *   - mint       : Wikimedia MinT (free, no key required)
 *   - google     : Google Translate (via unofficial API, optional key)
 *   - microsoft  : Microsoft/Bing Translate (via unofficial API, optional key)
 *   - openai     : OpenAI GPT models (requires API key)
 *   - libretranslate : LibreTranslate (open-source, self-hostable)
 */

import axios from 'axios';

const REQUEST_TIMEOUT = 30000;
const CHUNK_SIZE = 4500; // Characters per chunk for APIs with limits
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

// ──────────────────────────── Public API ────────────────────────────

/**
 * Translate a single text string using the specified service.
 *
 * @param {string} text - Text to translate
 * @param {string} fromLang - Source language code
 * @param {string} toLang - Target language code
 * @param {string} service - Translation service name
 * @param {Object} options - { apiKey, apiEndpoint, model }
 * @returns {string} Translated text
 */
export async function translateText(text, fromLang, toLang, service, options = {}) {
  if (!text || text.trim() === '') return text;
  if (fromLang === toLang) return text;

  const adapter = ADAPTERS[service];
  if (!adapter) {
    console.warn(`Unknown translation service: ${service}. Falling back to mint.`);
    return callWithRetry(ADAPTERS.mint, text, fromLang, toLang, options);
  }

  // For long texts, chunk and translate
  if (text.length > CHUNK_SIZE) {
    return translateInChunks(text, fromLang, toLang, adapter, options);
  }

  return callWithRetry(adapter, text, fromLang, toLang, options);
}

/**
 * Translate an array of text strings in batch.
 * Returns a Map of { originalText: translatedText }.
 */
export async function translateTexts(texts, fromLang, toLang, service, options = {}) {
  const uniqueTrimmed = [...new Set(texts.filter(t => t && typeof t === 'string' && t.trim()).map(t => t.trim()))];
  const translatedMap = {};

  // Translate using batch adapter if available to minimize API calls and avoid 429 rate limits
  if (BATCH_ADAPTERS[service] && uniqueTrimmed.length > 1) {
    const BATCH_SIZE = 25;
    for (let i = 0; i < uniqueTrimmed.length; i += BATCH_SIZE) {
      const batch = uniqueTrimmed.slice(i, i + BATCH_SIZE);
      try {
        const batchResults = await BATCH_ADAPTERS[service](batch, fromLang, toLang, options);
        Object.assign(translatedMap, batchResults);
      } catch (err) {
        console.warn(`Batch translation failed for ${service}: ${err.message}. Falling back to single translations.`);
        for (const trimmed of batch) {
          try {
            const translated = await translateText(trimmed, fromLang, toLang, service, options);
            translatedMap[trimmed] = translated || trimmed;
          } catch (singleErr) {
            translatedMap[trimmed] = trimmed;
          }
        }
      }
    }
  } else {
    // Translate concurrently with concurrency limit
    const CONCURRENCY = 3;
    for (let i = 0; i < uniqueTrimmed.length; i += CONCURRENCY) {
      const batch = uniqueTrimmed.slice(i, i + CONCURRENCY);
      const translations = await Promise.all(
        batch.map(async (trimmed) => {
          try {
            const translated = await translateText(trimmed, fromLang, toLang, service, options);
            return { trimmed, translated: translated || trimmed };
          } catch (err) {
            console.error(`Translation failed for chunk (${trimmed.length} chars): ${err.message}`);
            return { trimmed, translated: trimmed };
          }
        })
      );
      for (const { trimmed, translated } of translations) {
        translatedMap[trimmed] = translated;
      }
    }
  }

  const result = {};
  for (const t of texts) {
    if (!t || typeof t !== 'string') continue;
    const trimmed = t.trim();
    if (!trimmed) {
      result[t] = t;
      continue;
    }
    const translated = translatedMap[trimmed] ?? trimmed;
    // Map under trimmed key
    result[trimmed] = translated;
    // Also map under original raw key with surrounding whitespace preserved
    const leadingWsMatch = t.match(/^\s+/);
    const trailingWsMatch = t.match(/\s+$/);
    const leadingWs = leadingWsMatch ? leadingWsMatch[0] : '';
    const trailingWs = trailingWsMatch ? trailingWsMatch[0] : '';
    result[t] = `${leadingWs}${translated ? translated.trim() : ''}${trailingWs}`;
  }

  return result;
}

/**
 * Get list of available translation services with metadata.
 */
export function getAvailableServices() {
  const hasServerGoogle = Boolean(process.env.GOOGLE_TRANSLATE_API_KEY);
  const hasServerGroq = Boolean(process.env.GROQ_API_KEY);
  const hasServerGemini = Boolean(process.env.GEMINI_API_KEY);

  return [
    { 
      id: 'mint', 
      name: 'Wikimedia MinT', 
      requiresKey: false, 
      description: 'Free neural machine translation by Wikimedia. Best for Wikipedia content.' 
    },
    { 
      id: 'gemini', 
      name: 'Google Gemini AI', 
      requiresKey: !hasServerGemini, 
      description: hasServerGemini 
        ? 'Google Gemini Flash AI with ultra-fast inference and high accuracy (Server key enabled).' 
        : 'Google Gemini Flash AI. Free API key available at aistudio.google.com.' 
    },
    { 
      id: 'google', 
      name: 'Google Cloud Translation', 
      requiresKey: !hasServerGoogle, 
      description: hasServerGoogle 
        ? 'Official Google Cloud Translation v2 (Server key enabled).' 
        : 'Official Google Cloud Translation API v2. Requires Google Cloud API key.' 
    },
    { 
      id: 'groq', 
      name: 'Groq Cloud AI', 
      requiresKey: !hasServerGroq, 
      description: hasServerGroq 
        ? 'Ultra-fast AI translation powered by Groq LPUs (Server key enabled for logged-in users).' 
        : 'Ultra-fast AI translation powered by Groq LPUs. Free API key available at console.groq.com.' 
    },
    { 
      id: 'deepl', 
      name: 'DeepL Translator', 
      requiresKey: true, 
      description: 'DeepL API (Free or Pro). Renowned quality for European and world languages.' 
    },
    { 
      id: 'openai', 
      name: 'OpenAI GPT', 
      requiresKey: true, 
      description: 'High-quality translation using OpenAI GPT-4o models. Requires API key.' 
    },
    { 
      id: 'custom_openai', 
      name: 'Universal AI / Custom LLM (DeepSeek, Ollama, OpenRouter)', 
      requiresKey: false, 
      description: 'Connect to any OpenAI-compatible AI API endpoint.' 
    },
    { 
      id: 'microsoft', 
      name: 'Microsoft Azure Translator', 
      requiresKey: true, 
      description: 'Official Azure AI Translator API. Requires API key.' 
    },
    { 
      id: 'libretranslate', 
      name: 'LibreTranslate', 
      requiresKey: false, 
      description: 'Open-source translation. Self-hostable or use public instance.' 
    },
    { 
      id: 'custom_rest', 
      name: 'Custom REST MT Endpoint', 
      requiresKey: false, 
      description: 'Connect to any custom machine translation HTTP API.' 
    },
  ];
}

// ──────────────────────────── Retry Logic ────────────────────────────

async function callWithRetry(adapter, text, fromLang, toLang, options) {
  if (!text || !text.trim()) return text;
  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await adapter(text, fromLang, toLang, options);
      if (result && typeof result === 'string') return result;
      throw new Error('Empty translation returned');
    } catch (err) {
      lastError = err;
      const status = err.response?.status;
      // Do not stall on auth (401/403) or rate-limit (429) failures
      if (status === 401 || status === 403 || status === 429) {
        console.warn(`Translation failed with HTTP ${status}: ${err.message}. Skipping retries.`);
        break;
      }
      if (attempt < MAX_RETRIES - 1) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
        console.warn(`Translation attempt ${attempt + 1} failed: ${err.message}. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  console.warn(`All translation retries exhausted for ${fromLang}→${toLang}. Returning original text.`);
  return text;
}

// ──────────────────────────── Endpoint Safety & Validation ────────────────────────────

/**
 * Validates whether a custom user-provided endpoint URL is safe to query (SSRF guard).
 * Blocks cloud metadata IPs, non-HTTPS protocols (in prod), and private subnet hosts.
 */
export function validateSafeEndpoint(urlString) {
  if (!urlString || typeof urlString !== 'string') {
    throw new Error('Custom endpoint URL is required');
  }

  let parsed;
  try {
    parsed = new URL(urlString.trim());
  } catch {
    throw new Error('Invalid custom endpoint URL format');
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block AWS / OpenStack / Cloud metadata service IPs
  if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal' || hostname === 'instance-data') {
    throw new Error('Access to internal cloud metadata endpoints is prohibited');
  }

  const isDev = process.env.NODE_ENV !== 'production';
  const protocol = parsed.protocol.toLowerCase();

  // Enforce HTTPS unless local dev against localhost/127.0.0.1 (e.g. local Ollama)
  if (protocol !== 'https:') {
    const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (!isDev || !isLocalhost || protocol !== 'http:') {
      throw new Error('Custom endpoints must use HTTPS protocol');
    }
  }

  // Block private network address patterns in production
  if (!isDev) {
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) {
      throw new Error('Access to internal/private network endpoints is prohibited');
    }
  }

  return parsed.toString();
}

// ──────────────────────────── Adapters ────────────────────────────

let wmcloudFailures = 0;
let lastWmcloudFailure = 0;
let wmcloudDownUntil = 0;

let cxserverFailures = 0;
let lastCxserverFailure = 0;
let cxserverDownUntil = 0;

/**
 * Wikimedia MinT - free MT service designed for Wikipedia content.
 * Primary:  https://translate.wmcloud.org/api/translate
 * Fallback 1: Wikimedia Content Translation API v2
 * Fallback 2: Google Free GTX translation
 * Fallback 3: Apertium via cxserver
 */
async function mintTranslate(text, fromLang, toLang, _options) {
  const now = Date.now();

  // Reset failure count if last failure was over 30s ago
  if (now - lastWmcloudFailure > 30000) {
    wmcloudFailures = 0;
  }
  if (now - lastCxserverFailure > 30000) {
    cxserverFailures = 0;
  }

  // 1. Primary: MinT direct API (6s timeout with multi-failure circuit breaker)
  if (now > wmcloudDownUntil) {
    try {
      const response = await axios.post('https://translate.wmcloud.org/api/translate', {
        content: text,
        source_language: fromLang,
        target_language: toLang,
        format: 'text',
      }, {
        timeout: 6000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SourceTranslationTool/2.0 (https://meta.wikimedia.org/wiki/User:Jnanaranjan_sahu)',
        },
      });

      if (response.data && response.data.translation) {
        wmcloudFailures = 0; // Reset on success
        return response.data.translation;
      }
    } catch (err) {
      lastWmcloudFailure = Date.now();
      wmcloudFailures++;
      if (wmcloudFailures >= 3) {
        wmcloudDownUntil = Date.now() + 15000; // 15s cooldown only after 3 consecutive failures
        console.warn(`[MinT] 3 consecutive failures. Circuit breaker tripped for 15s.`);
      }
    }
  }

  // 2. Fallback 1: Fast Google Free GTX translation (sub-second response time)
  try {
    const response = await axios.post(
      'https://translate.googleapis.com/translate_a/single',
      new URLSearchParams({
        client: 'gtx',
        sl: fromLang,
        tl: toLang,
        dt: 't',
        q: text,
      }).toString(),
      {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      }
    );

    if (response.data && Array.isArray(response.data[0])) {
      const translated = response.data[0]
        .map(segment => segment[0])
        .filter(Boolean)
        .join('');
      if (translated && translated.trim()) {
        return translated;
      }
    }
  } catch (errGtx) {
    // Proceed to cxserver fallback if GTX fails
  }

  // 3. Fallback 2: Wikimedia Content Translation API (cxserver)
  if (now > cxserverDownUntil) {
    try {
      const url = `https://cxserver.wikimedia.org/v2/translate/${fromLang}/${toLang}/MinT`;
      const response = await axios.post(url, text, {
        timeout: 4000,
        headers: {
          'Content-Type': 'text/plain',
          'User-Agent': 'SourceTranslationTool/2.0 (https://meta.wikimedia.org/wiki/User:Jnanaranjan_sahu)',
        },
      });

      if (response.data && typeof response.data === 'string' && response.data.trim()) {
        cxserverFailures = 0;
        return response.data;
      }
      if (response.data && response.data.contents) {
        cxserverFailures = 0;
        return response.data.contents;
      }
    } catch (err2) {
      lastCxserverFailure = Date.now();
      cxserverFailures++;
      if (cxserverFailures >= 3) {
        cxserverDownUntil = Date.now() + 15000;
      }
    }
  }



  // 4. Fallback: Apertium via cxserver
  try {
    const url = `https://cxserver.wikimedia.org/v2/translate/${fromLang}/${toLang}/Apertium`;
    const response = await axios.post(url, text, {
      timeout: 4000,
      headers: {
        'Content-Type': 'text/plain',
        'User-Agent': 'SourceTranslationTool/2.0 (https://meta.wikimedia.org/wiki/User:Jnanaranjan_sahu)',
      },
    });

    if (response.data && typeof response.data === 'string' && response.data.trim()) {
      return response.data;
    }
    if (response.data && response.data.contents) {
      return response.data.contents;
    }
  } catch (err4) {
    // silently fail
  }

  // If all MT engines fail, return the original text safely instead of crashing
  console.warn(`All MT engines exhausted for ${fromLang}→${toLang}. Returning original text safely.`);
  return text;
}

/**
 * Google Cloud Translation API (v2 REST API).
 * Uses server GOOGLE_TRANSLATE_API_KEY if available, or user-provided key.
 */
async function googleTranslate(text, fromLang, toLang, options) {
  const apiKey = options.apiKey || process.env.GOOGLE_TRANSLATE_API_KEY || '';
  if (!apiKey) throw new Error('Google Cloud API key is required. Set GOOGLE_TRANSLATE_API_KEY in your environment or enter your API key.');

  try {
    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
    const response = await axios.post(url, {
      q: text,
      source: fromLang,
      target: toLang,
      format: 'text'
    }, {
      timeout: REQUEST_TIMEOUT,
    });
    
    const translated = response.data?.data?.translations?.[0]?.translatedText;
    if (!translated) throw new Error('Empty response from Google Translate');
    return translated;
  } catch (err) {
    const apiError = err.response?.data?.error?.message;
    console.error(`Google Translate error: ${apiError || err.message}`);
    throw new Error(`Google Translate failed: ${apiError || err.message}`);
  }
}

/**
 * Microsoft Azure AI Translator API (v3.0 REST API).
 * Requires a valid Azure Translator API key.
 */
async function microsoftTranslate(text, fromLang, toLang, options) {
  const apiKey = options.apiKey;
  if (!apiKey) throw new Error('Microsoft Azure API key is required');

  // Azure requires a region header. If user puts key in format "region:key", split it.
  // Otherwise default to empty region (which works for global resources) or common regions.
  let key = apiKey;
  let region = '';
  if (apiKey.includes(':')) {
    [region, key] = apiKey.split(':');
  }

  try {
    const url = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=${fromLang}&to=${toLang}`;
    const headers = {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/json'
    };
    if (region) headers['Ocp-Apim-Subscription-Region'] = region;

    const response = await axios.post(url, [{ text }], {
      headers,
      timeout: REQUEST_TIMEOUT,
    });
    
    const translated = response.data?.[0]?.translations?.[0]?.text;
    if (!translated) throw new Error('Empty response from Microsoft Translate');
    return translated;
  } catch (err) {
    const apiError = err.response?.data?.error?.message;
    console.error(`Microsoft Translate error: ${apiError || err.message}`);
    throw new Error(`Microsoft Translate failed: ${apiError || err.message}`);
  }
}

/**
 * OpenAI GPT translation with wiki-aware system prompt.
 */
async function openaiTranslate(text, fromLang, toLang, options) {
  const apiKey = options.apiKey;
  if (!apiKey) throw new Error('OpenAI API key is required');

  const model = options.model || 'gpt-4o-mini';
  const endpoint = options.apiEndpoint || 'https://api.openai.com/v1/chat/completions';

  const langNames = {
    en: 'English', hi: 'Hindi', bn: 'Bengali', ta: 'Tamil', te: 'Telugu',
    mr: 'Marathi', gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi',
    or: 'Odia', as: 'Assamese', ur: 'Urdu', ne: 'Nepali', sa: 'Sanskrit',
    si: 'Sinhala', ar: 'Arabic', de: 'German', es: 'Spanish', fr: 'French',
    ja: 'Japanese', pt: 'Portuguese', ru: 'Russian', zh: 'Chinese',
    bho: 'Bhojpuri', doi: 'Dogri', gom: 'Goan Konkani', ks: 'Kashmiri',
    mai: 'Maithili', mni: 'Meitei', sd: 'Sindhi', sat: 'Santali', new: 'Newari',
  };

  const fromName = langNames[fromLang] || fromLang;
  const toName = langNames[toLang] || toLang;

  const response = await axios.post(endpoint, {
    model,
    messages: [
      {
        role: 'system',
        content: `You are a professional translator specializing in Wikipedia content. Translate the following text from ${fromName} to ${toName}. IMPORTANT RULES:
- Preserve ALL wiki markup syntax exactly (headings ==, bold ''', italic '', lists *, #, etc.)
- Do NOT translate or modify any placeholder tokens (like \\x00TEMPLATE_0\\x00 or \\x00LINK_0\\x00)
- Maintain paragraph structure and formatting
- Translate naturally and accurately, using proper terminology
- For technical or domain-specific terms, use the most widely accepted ${toName} translation
- Return ONLY the translated text, no explanations or notes`,
      },
      { role: 'user', content: text },
    ],
    temperature: 0.3,
    max_tokens: Math.min(text.length * 4, 16384),
  }, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: REQUEST_TIMEOUT * 2,
  });

  const translated = response.data?.choices?.[0]?.message?.content;
  if (!translated) throw new Error('Empty response from OpenAI');
  return translated.trim();
}

/**
 * LibreTranslate - open-source, self-hostable translation.
 */
async function libreTranslate(text, fromLang, toLang, options) {
  const rawEndpoint = options.apiEndpoint || 'https://libretranslate.com/translate';
  const endpoint = validateSafeEndpoint(rawEndpoint);
  const apiKey = options.apiKey || '';

  const payload = {
    q: text,
    source: fromLang,
    target: toLang,
    format: 'text',
  };
  if (apiKey) payload.api_key = apiKey;

  const response = await axios.post(endpoint, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: REQUEST_TIMEOUT,
  });

  if (response.data && response.data.translatedText) {
    return response.data.translatedText;
  }
  throw new Error('LibreTranslate returned no translation');
}

// ──────────────────────────── Chunking Helper ────────────────────────────

async function translateInChunks(text, fromLang, toLang, adapter, options) {
  // Split on paragraph boundaries to maintain structure
  const paragraphs = text.split(/(\n{2,})/);
  const translated = [];

  let currentChunk = '';
  for (const para of paragraphs) {
    if ((currentChunk + para).length > CHUNK_SIZE && currentChunk.length > 0) {
      try {
        const result = await callWithRetry(adapter, currentChunk, fromLang, toLang, options);
        translated.push(result);
      } catch (err) {
        console.error(`Chunk translation failed: ${err.message}`);
        translated.push(currentChunk); // fallback to original
      }
      currentChunk = para;
    } else {
      currentChunk += para;
    }
  }

  // Translate remaining chunk
  if (currentChunk) {
    try {
      const result = await callWithRetry(adapter, currentChunk, fromLang, toLang, options);
      translated.push(result);
    } catch (err) {
      console.error(`Final chunk translation failed: ${err.message}`);
      translated.push(currentChunk);
    }
  }

  return translated.join('');
}

/**
 * DeepL Translator - Free and Pro API.
 */
async function deeplTranslate(text, fromLang, toLang, options) {
  if (!options.apiKey) throw new Error('DeepL requires an API key');

  const isFreeKey = options.apiKey.endsWith(':fx');
  const endpoint = isFreeKey
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';

  // DeepL target language mapping (e.g. en -> EN-US or EN, pt -> PT-PT or PT-BR)
  let targetLang = toLang.toUpperCase();
  if (targetLang === 'EN') targetLang = 'EN-US';
  if (targetLang === 'PT') targetLang = 'PT-PT';

  const response = await axios.post(
    endpoint,
    {
      text: [text],
      source_lang: fromLang.toUpperCase(),
      target_lang: targetLang,
    },
    {
      headers: {
        Authorization: `DeepL-Auth-Key ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: REQUEST_TIMEOUT,
    }
  );

  const translations = response.data?.translations;
  if (translations && translations.length > 0 && translations[0].text) {
    return translations[0].text;
  }
  throw new Error('DeepL returned no translation');
}

/**
 * Universal OpenAI-Compatible LLM Adapter.
 * Works with Groq, DeepSeek, Ollama, LM Studio, vLLM, OpenRouter, Mistral, etc.
 */
async function customOpenaiTranslate(text, fromLang, toLang, options) {
  const rawEndpoint = options.apiEndpoint || 'https://api.openai.com/v1/chat/completions';
  const endpoint = validateSafeEndpoint(rawEndpoint);
  const model = options.model || 'gpt-4o-mini';
  const apiKey = options.apiKey || '';

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const systemPrompt = `You are an expert Wikipedia translator. Translate the provided text from ${fromLang} to ${toLang}.
Preserve any wiki formatting, numbers, markup, or special symbols.
Return ONLY the translated text without explanations, greetings, quotes, or markdown backticks.`;

  const payload = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ],
    temperature: 0.2,
  };

  const response = await axios.post(endpoint, payload, {
    headers,
    timeout: REQUEST_TIMEOUT * 2,
  });

  const translated = response.data?.choices?.[0]?.message?.content;
  if (!translated) throw new Error('Empty response from custom AI provider');
  return translated.trim();
}

/**
 * Universal Custom REST MT Endpoint Adapter.
 */
async function customRestTranslate(text, fromLang, toLang, options) {
  if (!options.apiEndpoint) {
    throw new Error('Custom REST MT requires an endpoint URL');
  }

  const endpoint = validateSafeEndpoint(options.apiEndpoint);

  const payload = {
    q: text,
    text,
    source: fromLang,
    target: toLang,
    from: fromLang,
    to: toLang,
  };

  const headers = { 'Content-Type': 'application/json' };
  if (options.apiKey) headers.Authorization = `Bearer ${options.apiKey}`;

  const response = await axios.post(endpoint, payload, {
    headers,
    timeout: REQUEST_TIMEOUT,
  });

  const data = response.data;
  const translated = data?.translation || data?.translatedText || data?.result || data?.text;
  if (translated) return String(translated).trim();

  throw new Error('Custom REST endpoint did not return a valid translation field');
}

/**
 * Groq Cloud AI Translation.
 * Fast, free open-source LLM inference.
 * Uses server GROQ_API_KEY if available, or user-provided key.
 */
async function groqTranslate(text, fromLang, toLang, options) {
  const apiKey = options.apiKey || process.env.GROQ_API_KEY || '';
  if (!apiKey) throw new Error('Groq API key is required. Set GROQ_API_KEY in your environment or enter your key from console.groq.com.');

  const candidateModels = [
    options.model,
    process.env.GROQ_MODEL,
    'qwen/qwen3.8-27b',
    'qwen/qwen3.6-27b',
    'openai/gpt-oss-120b',
    'llama-3.3-70b-versatile',
  ].filter(Boolean);

  const systemPrompt = `You are an expert Wikipedia translator. Translate the provided text from ${fromLang} to ${toLang}.
Preserve all wiki formatting, [[wikilinks]], {{templates}}, numbers, and special symbols intact.
Return ONLY the translated text without explanations, greetings, quotes, or markdown code fences.`;

  let lastError = null;
  for (const model of candidateModels) {
    try {
      const payload = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.2,
      };

      const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        timeout: REQUEST_TIMEOUT * 2,
      });

      const translated = response.data?.choices?.[0]?.message?.content;
      if (translated) return translated.trim();
    } catch (err) {
      lastError = err;
      if (err.response?.status === 404 || err.response?.data?.error?.code === 'model_not_found') {
        continue; // Try next candidate model
      }
      throw err;
    }
  }

  throw lastError || new Error('Empty response from Groq AI provider');
}

/**
 * Google Gemini AI Translation.
 * Supports Gemini Flash models via Google AI Studio / Generative Language API.
 */
async function geminiTranslate(text, fromLang, toLang, options) {
  const apiKey = options.apiKey || process.env.GEMINI_API_KEY || '';
  if (!apiKey) throw new Error('Google Gemini API key is required. Set GEMINI_API_KEY in your environment or enter your key from aistudio.google.com.');

  const candidateModels = [
    options.model,
    process.env.GEMINI_MODEL,
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.6-flash',
  ].filter(Boolean);

  const systemInstruction = `You are an expert Wikipedia translator. Translate the provided text from ${fromLang} to ${toLang}.
Preserve all wiki formatting, [[wikilinks]], {{templates}}, <ref> footnotes, markup, numbers, and special symbols intact.
Return ONLY the translated text without explanations, greetings, quotes, or markdown code fences.`;

  let lastError = null;
  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: `${systemInstruction}\n\nText to translate:\n${text}` }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
        }
      };

      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: REQUEST_TIMEOUT * 2,
      });

      const translated = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (translated) return translated.trim();
    } catch (err) {
      lastError = err;
      if (err.response?.status === 404) {
        continue; // Model deprecated/not found, try next candidate
      }
      throw err;
    }
  }

  throw lastError || new Error('Empty response from Google Gemini AI');
}

/**
 * Google Gemini AI Batch Translation.
 * Translates an array of short strings in a single prompt using structured JSON response.
 * Minimizes API calls to prevent 429 rate limit errors on the free tier.
 */
async function geminiBatchTranslate(texts, fromLang, toLang, options) {
  if (!texts.length) return {};
  const apiKey = options.apiKey || process.env.GEMINI_API_KEY || '';
  if (!apiKey) throw new Error('Google Gemini API key is required.');

  const candidateModels = [
    options.model,
    process.env.GEMINI_MODEL,
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.6-flash',
  ].filter(Boolean);

  const systemInstruction = `You are an expert Wikipedia translator. Translate each of the following text strings from ${fromLang} to ${toLang}.
Preserve all wiki formatting, [[wikilinks]], {{templates}}, <ref> footnotes, markup, numbers, and special symbols intact.
Return ONLY a valid JSON array of strings containing the translations in the exact same order as the input array.`;

  const prompt = `${systemInstruction}\n\nInput JSON:\n${JSON.stringify(texts)}`;

  let lastError = null;
  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      };

      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: REQUEST_TIMEOUT * 2,
      });

      const raw = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === texts.length) {
          const map = {};
          texts.forEach((orig, idx) => {
            map[orig] = typeof parsed[idx] === 'string' ? parsed[idx].trim() : orig;
          });
          return map;
        }
      }
    } catch (err) {
      lastError = err;
      if (err.response?.status === 404) continue;
      throw err;
    }
  }

  throw lastError || new Error('Empty response from Google Gemini AI batch translate');
}

// Batch adapter registry for providers supporting native array translation
const BATCH_ADAPTERS = {
  gemini: geminiBatchTranslate,
};

// Adapter registry
const ADAPTERS = {
  mint: mintTranslate,
  gemini: geminiTranslate,
  groq: groqTranslate,
  deepl: deeplTranslate,
  google: googleTranslate,
  microsoft: microsoftTranslate,
  openai: openaiTranslate,
  custom_openai: customOpenaiTranslate,
  libretranslate: libreTranslate,
  custom_rest: customRestTranslate,
};
