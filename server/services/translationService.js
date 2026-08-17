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
  const uniqueTexts = [...new Set(texts.filter(t => t && t.trim()))];
  const result = {};

  // Translate concurrently with concurrency limit
  const CONCURRENCY = 3;
  for (let i = 0; i < uniqueTexts.length; i += CONCURRENCY) {
    const batch = uniqueTexts.slice(i, i + CONCURRENCY);
    const translations = await Promise.all(
      batch.map(async (text) => {
        try {
          const translated = await translateText(text, fromLang, toLang, service, options);
          return { original: text, translated };
        } catch (err) {
          console.error(`Translation failed for chunk (${text.length} chars): ${err.message}`);
          return { original: text, translated: text };
        }
      })
    );
    for (const { original, translated } of translations) {
      result[original] = translated;
    }
  }

  return result;
}

/**
 * Get list of available translation services with metadata.
 */
export function getAvailableServices() {
  return [
    { id: 'mint', name: 'Wikimedia MinT', requiresKey: false, description: 'Free machine translation by Wikimedia. Best for Wikipedia content.' },
    { id: 'deepl', name: 'DeepL Translator', requiresKey: true, description: 'DeepL API (Free or Pro). Renowned quality for world languages.' },
    { id: 'openai', name: 'OpenAI GPT', requiresKey: true, description: 'High-quality translation using OpenAI models. Requires API key.' },
    { id: 'custom_openai', name: 'Universal AI / Custom LLM (Groq, DeepSeek, Ollama, OpenRouter)', requiresKey: false, description: 'Connect to any OpenAI-compatible AI API (Groq, DeepSeek, Ollama, LM Studio, etc.).' },
    { id: 'google', name: 'Google Cloud Translation', requiresKey: true, description: 'Official Google Cloud Translation API v2. Requires API key.' },
    { id: 'microsoft', name: 'Microsoft Azure Translator', requiresKey: true, description: 'Official Azure AI Translator API. Requires API key.' },
    { id: 'libretranslate', name: 'LibreTranslate', requiresKey: false, description: 'Open-source translation. Self-hostable or use public instance.' },
    { id: 'custom_rest', name: 'Custom REST MT Endpoint', requiresKey: false, description: 'Connect to any custom machine translation HTTP API.' },
  ];
}

// ──────────────────────────── Retry Logic ────────────────────────────

async function callWithRetry(adapter, text, fromLang, toLang, options) {
  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await adapter(text, fromLang, toLang, options);
      if (result && result.trim()) return result;
      throw new Error('Empty translation returned');
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES - 1) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
        console.warn(`Translation attempt ${attempt + 1} failed: ${err.message}. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// ──────────────────────────── Adapters ────────────────────────────

/**
 * Wikimedia MinT - free MT service designed for Wikipedia content.
 * Primary:  https://translate.wmcloud.org/api/translate
 * Fallback: Wikimedia Content Translation API v2
 */
async function mintTranslate(text, fromLang, toLang, _options) {
  // Primary: MinT direct API
  try {
    const response = await axios.post('https://translate.wmcloud.org/api/translate', {
      content: text,
      source_language: fromLang,
      target_language: toLang,
      format: 'text',
    }, {
      timeout: REQUEST_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SourceTranslationTool/2.0 (https://meta.wikimedia.org/wiki/User:Jnanaranjan_sahu)',
      },
    });

    if (response.data && response.data.translation) {
      return response.data.translation;
    }
  } catch (err) {
    console.warn(`MinT primary endpoint failed: ${err.message}`);
  }

  // Fallback: Wikimedia Content Translation API (cxserver)
  try {
    const url = `https://cxserver.wikimedia.org/v2/translate/${fromLang}/${toLang}/MinT`;
    const response = await axios.post(url, text, {
      timeout: REQUEST_TIMEOUT,
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
  } catch (err2) {
    console.warn(`MinT cxserver fallback failed: ${err2.message}`);
  }

  // Third fallback: Apertium via cxserver
  try {
    const url = `https://cxserver.wikimedia.org/v2/translate/${fromLang}/${toLang}/Apertium`;
    const response = await axios.post(url, text, {
      timeout: REQUEST_TIMEOUT,
      headers: {
        'Content-Type': 'text/plain',
        'User-Agent': 'SourceTranslationTool/2.0',
      },
    });

    if (response.data && typeof response.data === 'string' && response.data.trim()) {
      return response.data;
    }
    if (response.data && response.data.contents) {
      return response.data.contents;
    }
  } catch (err3) {
    console.warn(`Apertium fallback also failed: ${err3.message}`);
  }

  throw new Error(`MinT translation failed for ${fromLang}→${toLang}. All endpoints exhausted.`);
}

/**
 * Google Cloud Translation API (v2 REST API).
 * Requires a valid Google Cloud API key.
 */
async function googleTranslate(text, fromLang, toLang, options) {
  const apiKey = options.apiKey;
  if (!apiKey) throw new Error('Google Cloud API key is required');

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
  const endpoint = options.apiEndpoint || 'https://libretranslate.com/translate';
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
  const endpoint = options.apiEndpoint || 'https://api.openai.com/v1/chat/completions';
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

  const response = await axios.post(options.apiEndpoint, payload, {
    headers,
    timeout: REQUEST_TIMEOUT,
  });

  const data = response.data;
  const translated = data?.translation || data?.translatedText || data?.result || data?.text;
  if (translated) return String(translated).trim();

  throw new Error('Custom REST endpoint did not return a valid translation field');
}

// Adapter registry
const ADAPTERS = {
  mint: mintTranslate,
  deepl: deeplTranslate,
  google: googleTranslate,
  microsoft: microsoftTranslate,
  openai: openaiTranslate,
  custom_openai: customOpenaiTranslate,
  libretranslate: libreTranslate,
  custom_rest: customRestTranslate,
};
