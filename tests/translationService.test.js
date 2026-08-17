import { describe, it, expect, vi } from 'vitest';
import axios from 'axios';
import {
  translateText,
  translateTexts,
  getAvailableServices,
} from '../server/services/translationService.js';

vi.mock('axios');

describe('translationService', () => {
  it('lists all available translation services including DeepL and Universal AI', () => {
    const services = getAvailableServices();
    const serviceIds = services.map(s => s.id);
    expect(serviceIds).toContain('mint');
    expect(serviceIds).toContain('deepl');
    expect(serviceIds).toContain('google');
    expect(serviceIds).toContain('microsoft');
    expect(serviceIds).toContain('openai');
    expect(serviceIds).toContain('custom_openai');
    expect(serviceIds).toContain('libretranslate');
    expect(serviceIds).toContain('custom_rest');
  });

  it('returns original text when fromLang equals toLang or text is empty', async () => {
    const res1 = await translateText('Hello', 'en', 'en', 'mint');
    expect(res1).toBe('Hello');

    const res2 = await translateText('', 'en', 'es', 'mint');
    expect(res2).toBe('');
  });

  it('translates via Wikimedia MinT backend adapter', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        translation: 'Bonjour le monde',
      },
    });

    const result = await translateText('Hello world', 'en', 'fr', 'mint');
    expect(result).toBe('Bonjour le monde');
  });

  it('translates via DeepL adapter with Free API key (:fx)', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        translations: [{ text: 'Hallo Welt' }],
      },
    });

    const result = await translateText('Hello world', 'en', 'de', 'deepl', { apiKey: 'test-key:fx' });
    expect(result).toBe('Hallo Welt');
    expect(axios.post).toHaveBeenCalledWith(
      'https://api-free.deepl.com/v2/translate',
      expect.objectContaining({ text: ['Hello world'], source_lang: 'EN', target_lang: 'DE' }),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'DeepL-Auth-Key test-key:fx' }) })
    );
  });

  it('translates via Universal OpenAI-Compatible LLM adapter (Groq/Ollama/DeepSeek)', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        choices: [
          { message: { content: 'Hola mundo' } },
        ],
      },
    });

    const result = await translateText('Hello world', 'en', 'es', 'custom_openai', {
      apiEndpoint: 'https://api.groq.com/openai/v1/chat/completions',
      model: 'llama-3.3-70b-versatile',
      apiKey: 'gsk_123',
    });
    expect(result).toBe('Hola mundo');
  });

  it('translates via Custom REST MT endpoint adapter', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        translatedText: 'Ciao mondo',
      },
    });

    const result = await translateText('Hello world', 'en', 'it', 'custom_rest', {
      apiEndpoint: 'https://my-custom-mt.internal/translate',
    });
    expect(result).toBe('Ciao mondo');
  });

  it('translates batch texts with deduplication', async () => {
    axios.post.mockResolvedValue({
      data: {
        translation: 'Translated',
      },
    });

    const texts = ['Hello', 'World', 'Hello'];
    const result = await translateTexts(texts, 'en', 'fr', 'mint');
    expect(result).toHaveProperty('Hello');
    expect(result).toHaveProperty('World');
  });
});
