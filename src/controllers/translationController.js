import axios from 'axios';
import { translateWikitext, translateTemplate as pipelineTranslateTemplate } from '../../server/services/translationPipeline.js';
import { getAvailableServices } from '../../server/services/translationService.js';

// Simple in-memory sliding window rate limiter
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100;

export const rateLimiter = (req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'anonymous';
  const now = Date.now();
  
  let entry = rateLimitMap.get(ip);
  if (!entry || now - entry.startTime > RATE_LIMIT_WINDOW_MS) {
    entry = { count: 1, startTime: now };
    rateLimitMap.set(ip, entry);
    return next();
  }

  entry.count++;
  if (entry.count > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many translation requests. Please slow down and try again in a minute.',
    });
  }

  next();
};

export const translate = async (req, res) => {
  const { text, fromLanguage, toLanguage, translationService, apiKey, apiEndpoint, model } = req.body;

  if (!text || !fromLanguage || !toLanguage) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'text, fromLanguage, and toLanguage are required',
    });
  }

  if (fromLanguage === toLanguage) {
    return res.json({ translatedText: text, stats: { note: 'Same source and target language' } });
  }

  // Validate service
  const validServices = getAvailableServices().map(s => s.id);
  const service = validServices.includes(translationService) ? translationService : 'mint';

  // Validate API key for services that require it
  const serviceConfig = getAvailableServices().find(s => s.id === service);
  if (serviceConfig?.requiresKey && (!apiKey || !apiKey.trim())) {
    return res.status(400).json({
      error: 'API key required',
      message: `${serviceConfig.name} requires an API key. Please enter your API key.`,
    });
  }

  try {
    console.log(`[Translation] ${fromLanguage} → ${toLanguage} via ${service} (${text.length} chars)`);

    const { translatedText, stats } = await translateWikitext(
      text,
      fromLanguage,
      toLanguage,
      service,
      { apiKey, apiEndpoint, model }
    );

    console.log(`[Translation] Done in ${stats.timingMs?.total || '?'}ms. Links: ${stats.linksTranslated}/${stats.linksFound}, Templates: ${stats.templatesTranslated}/${stats.templatesFound}, Params: ${stats.templateParamsTranslated || 0}, Errors: ${stats.errors.length}`);

    res.json({ translatedText, stats });
  } catch (error) {
    console.error('Error during translation process:', error);
    res.status(500).json({
      error: 'Error during translation',
      message: error.message || 'Unknown error',
      suggestion: 'Please try again later or with a different translation service',
    });
  }
};

export const translateTemplate = async (req, res) => {
  const { template, fromLanguage, toLanguage, translationService, apiKey, apiEndpoint, model } = req.body;

  if (!template || !fromLanguage || !toLanguage) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'template, fromLanguage, and toLanguage are required',
    });
  }

  const validServices = getAvailableServices().map(s => s.id);
  const service = validServices.includes(translationService) ? translationService : 'mint';

  const serviceConfig = getAvailableServices().find(s => s.id === service);
  if (serviceConfig?.requiresKey && (!apiKey || !apiKey.trim())) {
    return res.status(400).json({
      error: 'API key required',
      message: `${serviceConfig.name} requires an API key. Please enter your API key.`,
    });
  }

  try {
    const result = await pipelineTranslateTemplate(
      template,
      fromLanguage,
      toLanguage,
      service,
      { apiKey, apiEndpoint, model }
    );
    res.json(result);
  } catch (error) {
    console.error('Error during template translation:', error);
    res.status(500).json({
      error: 'Template translation error',
      message: error.message || 'Unknown error during template translation',
    });
  }
};

export const services = (req, res) => {
  res.json(getAvailableServices());
};

export const preview = async (req, res) => {
  const { text, language } = req.body;

  if (!text || !language) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'text and language are required',
    });
  }

  try {
    const params = new URLSearchParams({
      action: 'parse',
      format: 'json',
      prop: 'text',
      contentmodel: 'wikitext',
      text: text,
      uselang: language,
    });

    const response = await axios.post(
      `https://${language}.wikipedia.org/w/api.php`,
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'SourceTranslationTool/2.0 (https://meta.wikimedia.org/wiki/User:Jnanaranjan_sahu)',
        },
      }
    );

    if (response.data?.parse?.text?.['*']) {
      res.json({ html: response.data.parse.text['*'] });
    } else if (response.data?.error) {
      res.status(400).json({
        error: 'MediaWiki Parse Error',
        message: response.data.error.info || 'Unknown MediaWiki error',
      });
    } else {
      res.json({ html: '<p class="text-zinc-400 italic">No content rendered.</p>' });
    }
  } catch (error) {
    console.error('Error generating preview:', error.message);
    res.status(500).json({
      error: 'Preview generation failed',
      message: error.message || 'Could not render wikitext preview',
    });
  }
};
