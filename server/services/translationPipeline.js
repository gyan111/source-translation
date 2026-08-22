/**
 * TranslationPipeline - Orchestrates the full wikitext translation process.
 *
 * Pipeline steps:
 *   1. Parse wikitext into typed segments (stack-based parser)
 *   2. Translate wikilink targets via Wikidata
 *   3. Translate template names via Wikidata
 *   4. Translate plain text segments via configured translation service
 *   5. Translate display texts of wikilinks
 *   6. Translate text-heavy template parameters
 *   7. Reassemble wikitext with all translations
 */

import {
  parseWikitext,
  extractLinkTargets,
  extractCategoryTargets,
  extractTemplateNames,
  extractTemplateParamTexts,
  reassembleWikitext,
  parseTemplate,
  reassembleTemplate,
  isTranslatableParamValue,
} from './wikitextParser.js';
import {
  translateTitlesViaWikidata,
  translateTemplateNames,
  translateCategories,
} from './wikidataService.js';
import { translateText, translateTexts } from './translationService.js';

/**
 * Translate a wikitext string end-to-end.
 *
 * @param {string} wikitext - Source wikitext
 * @param {string} fromLang - Source language code
 * @param {string} toLang - Target language code
 * @param {string} service - Translation service id
 * @param {Object} options - { apiKey, apiEndpoint, model }
 * @param {Function} onProgress - Optional progress callback (stage, percent)
 * @returns {Object} { translatedText, stats }
 */
export async function translateWikitext(wikitext, fromLang, toLang, service, options = {}, onProgress = null) {
  const startTime = Date.now();
  const stats = {
    totalSegments: 0,
    textSegments: 0,
    linksFound: 0,
    linksTranslated: 0,
    categoriesFound: 0,
    categoriesTranslated: 0,
    templatesFound: 0,
    templatesTranslated: 0,
    templateParamsTranslated: 0,
    errors: [],
    timingMs: {},
  };

  // Step 1: Parse wikitext
  if (onProgress) onProgress('parsing', 0);
  let stepStart = Date.now();

  const segments = parseWikitext(wikitext);
  stats.totalSegments = segments.length;
  stats.timingMs.parsing = Date.now() - stepStart;

  if (segments.length === 0) {
    // Edge case: no segments extracted (very short or empty input)
    return {
      translatedText: wikitext,
      stats: { ...stats, errors: ['No translatable segments found'] },
    };
  }

  // Step 2: Extract link targets, categories, and template names
  const linkTargets = extractLinkTargets(segments);
  const categoryTargets = extractCategoryTargets(segments);
  const templateNames = extractTemplateNames(segments);
  const templateParamTexts = extractTemplateParamTexts(segments);
  stats.linksFound = linkTargets.length;
  stats.categoriesFound = categoryTargets.length;
  stats.templatesFound = templateNames.length;

  // Step 3: Translate wikilinks via Wikidata
  if (onProgress) onProgress('wikilinks', 15);
  stepStart = Date.now();
  let translatedLinks = {};
  try {
    translatedLinks = await translateTitlesViaWikidata(linkTargets, fromLang, toLang);
    stats.linksTranslated = Object.entries(translatedLinks).filter(([k, v]) => k !== v).length;
  } catch (err) {
    stats.errors.push(`Wikilink translation error: ${err.message}`);
    for (const t of linkTargets) translatedLinks[t] = t;
  }
  stats.timingMs.wikilinks = Date.now() - stepStart;

  // Step 4: Translate categories via Wikidata
  if (onProgress) onProgress('categories', 25);
  stepStart = Date.now();
  let translatedCategories = {};
  if (categoryTargets.length > 0) {
    try {
      translatedCategories = await translateCategories(categoryTargets, fromLang, toLang);
      stats.categoriesTranslated = Object.entries(translatedCategories).filter(([k, v]) => k !== v).length;
    } catch (err) {
      stats.errors.push(`Category translation error: ${err.message}`);
      for (const c of categoryTargets) translatedCategories[c] = c;
    }
  }
  stats.timingMs.categories = Date.now() - stepStart;

  // Step 5: Translate template names via Wikidata
  if (onProgress) onProgress('templates', 35);
  stepStart = Date.now();
  let translatedTemplates = {};
  try {
    translatedTemplates = await translateTemplateNames(templateNames, fromLang, toLang);
    stats.templatesTranslated = Object.entries(translatedTemplates).filter(([k, v]) => k !== v).length;
  } catch (err) {
    stats.errors.push(`Template translation error: ${err.message}`);
    for (const t of templateNames) translatedTemplates[t] = t;
  }
  stats.timingMs.templates = Date.now() - stepStart;

  // Step 6: Translate text and heading segments via translation service
  if (onProgress) onProgress('text', 50);
  stepStart = Date.now();
  const textSegments = segments.filter(s => s.type === 'text').map(s => s.content);
  const headingTexts = segments.filter(s => s.type === 'heading').map(s => s.text);
  const allTextsToTranslate = [...new Set([...textSegments, ...headingTexts])];
  stats.textSegments = allTextsToTranslate.length;

  let translatedTextsMap = {};
  try {
    translatedTextsMap = await translateTexts(allTextsToTranslate, fromLang, toLang, service, options);
  } catch (err) {
    stats.errors.push(`Text translation error: ${err.message}`);
    for (const t of allTextsToTranslate) translatedTextsMap[t] = t;
  }
  stats.timingMs.textTranslation = Date.now() - stepStart;

  // Step 7: Translate display texts of wikilinks (prioritizing exact Wikidata resolved titles)
  if (onProgress) onProgress('display_texts', 70);
  stepStart = Date.now();
  const displayTexts = segments
    .filter(s => s.type === 'link' && s.display)
    .map(s => s.display);
  const implicitDisplays = segments
    .filter(s => s.type === 'link' && !s.display)
    .map(s => s.target);
  const allDisplayTexts = [...new Set([...displayTexts, ...implicitDisplays])];

  let translatedDisplayTexts = {};
  if (allDisplayTexts.length > 0) {
    try {
      const needsMtTranslation = [];
      for (const text of allDisplayTexts) {
        // If exact Wikidata resolved title is available, use it directly instead of letting MT guess
        if (translatedLinks[text] && translatedLinks[text] !== text) {
          translatedDisplayTexts[text] = translatedLinks[text];
        } else {
          needsMtTranslation.push(text);
        }
      }

      if (needsMtTranslation.length > 0) {
        const mtResults = await translateTexts(needsMtTranslation, fromLang, toLang, service, options);
        Object.assign(translatedDisplayTexts, mtResults);
      }
    } catch (err) {
      stats.errors.push(`Display text translation error: ${err.message}`);
      for (const t of allDisplayTexts) {
        if (!translatedDisplayTexts[t]) translatedDisplayTexts[t] = t;
      }
    }
  }
  stats.timingMs.displayTexts = Date.now() - stepStart;

  // Step 8: Translate template parameters (handling both wikilinks and plain text)
  if (onProgress) onProgress('template_params', 85);
  stepStart = Date.now();
  let translatedParamTexts = {};
  if (templateParamTexts.length > 0) {
    try {
      const plainParamTexts = templateParamTexts
        .filter(p => !p.hasWikilinks)
        .map(p => p.text);
      const uniquePlainParamTexts = [...new Set(plainParamTexts)];

      if (uniquePlainParamTexts.length > 0) {
        const plainTranslated = await translateTexts(uniquePlainParamTexts, fromLang, toLang, service, options);
        translatedParamTexts = { ...translatedParamTexts, ...plainTranslated };
      }

      // For parameter values with wikilinks: translate any text segments inside them and reassemble using batch translatedLinks
      const wikilinkParams = templateParamTexts.filter(p => p.hasWikilinks);
      if (wikilinkParams.length > 0) {
        const subTextsToTranslate = [];
        const parsedSubParams = [];

        for (const p of wikilinkParams) {
          const subSegments = parseWikitext(p.text);
          parsedSubParams.push({ param: p, subSegments });
          for (const seg of subSegments) {
            if (seg.type === 'text' && seg.content.trim()) {
              subTextsToTranslate.push(seg.content);
            }
          }
        }

        const subTranslatedTexts = subTextsToTranslate.length > 0
          ? await translateTexts([...new Set(subTextsToTranslate)], fromLang, toLang, service, options)
          : {};

        for (const { param, subSegments } of parsedSubParams) {
          translatedParamTexts[param.text] = reassembleWikitext(
            subSegments,
            subTranslatedTexts,
            translatedLinks,
            translatedTemplates,
            translatedDisplayTexts,
            {},
            {},
            { missingLinkStrategy: options.missingLinkStrategy || 'translate', fromLang, toLang }
          );
        }
      }

      stats.templateParamsTranslated = Object.entries(translatedParamTexts).filter(([k, v]) => k !== v).length;
    } catch (err) {
      stats.errors.push(`Template parameter translation error: ${err.message}`);
      for (const p of templateParamTexts) {
        if (!translatedParamTexts[p.text]) translatedParamTexts[p.text] = p.text;
      }
    }
  }
  stats.timingMs.templateParams = Date.now() - stepStart;

  // Step 8.5: Translate unresolved link targets and category names (for native red links / missing categories)
  const unresolvedLinkTargets = linkTargets.filter(t => !translatedLinks[t] || translatedLinks[t] === t);
  const cleanCategoryTargets = categoryTargets.map(c => c.replace(/^(?:Category|Catégorie|ਸ਼੍ਰେਣੀ|श्रेणी|विषयশ্রেণী|వర్గం|تصنيف|Категория):/i, '').trim());
  const unresolvedCategoryTargets = cleanCategoryTargets.filter(c => {
    const origWithPrefix = `Category:${c}`;
    const mapped = translatedCategories[origWithPrefix] || translatedCategories[c];
    return !mapped || mapped === origWithPrefix || mapped === c;
  });
  const unresolvedAll = [...new Set([...unresolvedLinkTargets, ...unresolvedCategoryTargets])];

  let unresolvedTranslatedTargets = {};
  if (unresolvedAll.length > 0) {
    try {
      unresolvedTranslatedTargets = await translateTexts(unresolvedAll, fromLang, toLang, service, options);
    } catch (err) {
      for (const u of unresolvedAll) unresolvedTranslatedTargets[u] = u;
    }
  }

  // Step 9: Reassemble
  if (onProgress) onProgress('reassemble', 95);
  const reassembleOptions = {
    missingLinkStrategy: options.missingLinkStrategy || 'translate',
    fromLang,
    toLang,
    unresolvedTranslatedTargets,
  };

  const translatedText = reassembleWikitext(
    segments,
    translatedTextsMap,
    translatedLinks,
    translatedTemplates,
    translatedDisplayTexts,
    translatedParamTexts,
    translatedCategories,
    reassembleOptions
  );

  stats.timingMs.total = Date.now() - startTime;
  if (onProgress) onProgress('done', 100);

  console.log(`[Pipeline] Completed in ${stats.timingMs.total}ms — ${stats.textSegments} text segments, ${stats.linksTranslated}/${stats.linksFound} links, ${stats.categoriesTranslated}/${stats.categoriesFound} categories, ${stats.templatesTranslated}/${stats.templatesFound} templates`);

  return { translatedText, stats };
}

/**
 * Translate a single standalone template wikitext string.
 *
 * @param {string} templateWikitext - E.g. "{{Infobox person | name = Albert Einstein | birth_place = Ulm, Germany}}"
 * @param {string} fromLang - Source language code
 * @param {string} toLang - Target language code
 * @param {string} service - Translation service id
 * @param {Object} options - { apiKey, apiEndpoint, model }
 * @returns {Object} { translatedTemplate, parsed, stats }
 */
export async function translateTemplate(templateWikitext, fromLang, toLang, service, options = {}) {
  const startTime = Date.now();
  const trimmed = (templateWikitext || '').trim();

  if (fromLang === toLang || !trimmed) {
    return {
      translatedTemplate: templateWikitext,
      parsed: { name: 'template', params: [] },
      stats: { templateName: '', translatedName: '', paramsCount: 0, paramsTranslated: 0, timingMs: {}, errors: [] },
    };
  }

  // Check if multiple templates or mixed wikitext was pasted (e.g. {{Use Indian English...}} {{Infobox settlement...}})
  const segments = parseWikitext(trimmed);
  const templateSegments = segments.filter(s => s.type === 'template');

  if (templateSegments.length > 1 || segments.some(s => s.type !== 'template')) {
    // Process via full pipeline so ALL templates (Infoboxes + maintenance tags) are properly mapped and localized!
    const res = await translateWikitext(trimmed, fromLang, toLang, service, options);
    const firstTpl = templateSegments[0] ? parseTemplate(templateSegments[0].content) : { name: 'template' };
    return {
      translatedTemplate: res.translatedText,
      parsed: firstTpl,
      stats: {
        templateName: templateSegments.map(t => parseTemplate(t.content).name).join(', '),
        translatedName: 'translated',
        paramsCount: templateSegments.length,
        paramsTranslated: templateSegments.length,
        timingMs: res.stats.timingMs,
        errors: res.stats.errors,
      },
    };
  }

  const parsed = parseTemplate(trimmed);

  const stats = {
    templateName: parsed.name,
    translatedName: parsed.name,
    paramsCount: parsed.params.length,
    paramsTranslated: 0,
    timingMs: {},
    errors: [],
  };

  // 1. Identify translatable parameter values (skip media filenames, comments, numbers, dates)
  const translatableParams = [];
  for (const p of parsed.params) {
    if (p.isComment) continue;
    const val = p.value.trim();
    if (isTranslatableParamValue(val, p.name)) {
      translatableParams.push({ param: p, text: val, hasWikilinks: val.includes('[[') || val.includes('{{') });
    }
  }

  // 2. Collect all link targets, template names, and text strings to batch translate in parallel
  const linkTargets = new Set();
  const templateNames = new Set([parsed.name]);
  const textsToTranslate = new Set();
  const parsedParamMap = new Map();

  for (const item of translatableParams) {
    if (item.hasWikilinks) {
      const subSegments = parseWikitext(item.text);
      parsedParamMap.set(item.text, subSegments);
      for (const seg of subSegments) {
        if (seg.type === 'link') {
          linkTargets.add(seg.target);
          if (seg.display) textsToTranslate.add(seg.display);
        } else if (seg.type === 'template') {
          templateNames.add(seg.content.slice(2, -2).split('|')[0].trim());
        } else if (seg.type === 'text' && seg.content.trim()) {
          textsToTranslate.add(seg.content);
        }
      }
    } else {
      textsToTranslate.add(item.text);
    }
  }

  // 3. Execute batch lookups in parallel
  let translatedName = parsed.name;
  let translatedLinks = {};
  let translatedTemplates = {};
  let translatedTexts = {};

  try {
    const [linksRes, templatesRes, textsRes] = await Promise.all([
      linkTargets.size > 0 ? translateTitlesViaWikidata([...linkTargets], fromLang, toLang) : Promise.resolve({}),
      templateNames.size > 0 ? translateTemplateNames([...templateNames], fromLang, toLang) : Promise.resolve({}),
      textsToTranslate.size > 0 ? translateTexts([...textsToTranslate], fromLang, toLang, service, options) : Promise.resolve({}),
    ]);

    translatedLinks = linksRes || {};
    translatedTemplates = templatesRes || {};
    translatedTexts = textsRes || {};
    translatedName = translatedTemplates[parsed.name] || parsed.name;
    stats.translatedName = translatedName;
  } catch (err) {
    stats.errors.push(`Batch translation error: ${err.message}`);
  }

  // 3.5 Translate unresolved link targets (missing Wikidata sitelinks) via MT
  const unresolvedLinkTargets = [...linkTargets].filter(t => !translatedLinks[t] || translatedLinks[t] === t);
  let unresolvedTranslatedTargets = {};
  if (unresolvedLinkTargets.length > 0) {
    try {
      unresolvedTranslatedTargets = await translateTexts(unresolvedLinkTargets, fromLang, toLang, service, options);
    } catch {
      for (const u of unresolvedLinkTargets) unresolvedTranslatedTargets[u] = u;
    }
  }

  // 4. Reassemble parameter values
  const translatedValuesMap = {};
  for (const item of translatableParams) {
    if (item.hasWikilinks && parsedParamMap.has(item.text)) {
      const subSegments = parsedParamMap.get(item.text);
      translatedValuesMap[item.text] = reassembleWikitext(
        subSegments,
        translatedTexts,
        translatedLinks,
        translatedTemplates,
        translatedTexts,
        {},
        {},
        {
          missingLinkStrategy: options.missingLinkStrategy || 'translate',
          fromLang,
          toLang,
          unresolvedTranslatedTargets,
        }
      );
    } else {
      translatedValuesMap[item.text] = translatedTexts[item.text] || item.text;
    }
  }

  stats.paramsTranslated = Object.keys(translatedValuesMap).length;

  // 5. Reassemble template with target language parameter aliases applied
  const translatedTemplate = reassembleTemplate(parsed, translatedName, translatedValuesMap, {}, toLang);
  stats.timingMs.total = Date.now() - startTime;

  return { translatedTemplate, parsed, stats };
}
