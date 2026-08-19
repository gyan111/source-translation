/**
 * WikidataService - Translates wikilink targets and template names
 * via the Wikidata sitelinks API.
 *
 * Features:
 *   - Batch lookups (up to 50 titles per request)
 *   - In-memory LRU cache with TTL to avoid redundant API calls
 *   - Title normalization handling
 */

import axios from 'axios';

const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const USER_AGENT = 'SourceTranslationTool/2.0 (https://meta.wikimedia.org/wiki/User:Jnanaranjan_sahu)';
const BATCH_SIZE = 50; // Wikidata API limit per request
const REQUEST_TIMEOUT = 6000;

// ──────────────────────────── LRU Cache ────────────────────────────

const CACHE_MAX_SIZE = 500;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

class LRUCache {
  constructor(maxSize, ttlMs) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.cache = new Map();
  }

  _key(title, fromLang, toLang) {
    return `${fromLang}:${toLang}:${title}`;
  }

  get(title, fromLang, toLang) {
    const key = this._key(title, fromLang, toLang);
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(title, fromLang, toLang, value) {
    const key = this._key(title, fromLang, toLang);
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  setBatch(translations, fromLang, toLang) {
    for (const [title, translated] of Object.entries(translations)) {
      this.set(title, fromLang, toLang, translated);
    }
  }
}

const titleCache = new LRUCache(CACHE_MAX_SIZE, CACHE_TTL_MS);

// ──────────────────────────── Public API ────────────────────────────

/**
 * Translate an array of page titles from one wiki to another via Wikidata sitelinks.
 *
 * @param {string[]} titles - Page titles in the source language wiki
 * @param {string} fromLang - Source language code (e.g., 'en')
 * @param {string} toLang - Target language code (e.g., 'hi')
 * @returns {Object} Map of { originalTitle: translatedTitle }
 */
export async function translateTitlesViaWikidata(titles, fromLang, toLang) {
  if (!titles || titles.length === 0) return {};
  if (fromLang === toLang) {
    const res = {};
    for (const t of titles) res[t] = t;
    return res;
  }

  const uniqueTitles = [...new Set(titles)];
  const result = {};
  const uncachedTitles = [];

  // Check cache first
  for (const title of uniqueTitles) {
    const cached = titleCache.get(title, fromLang, toLang);
    if (cached !== undefined) {
      result[title] = cached;
    } else {
      uncachedTitles.push(title);
    }
  }

  if (uncachedTitles.length === 0) {
    console.log(`[Wikidata] All ${uniqueTitles.length} titles found in cache`);
    return result;
  }

  console.log(`[Wikidata] ${uniqueTitles.length - uncachedTitles.length} cached, ${uncachedTitles.length} to fetch`);

  // Process uncached titles in batches
  for (let i = 0; i < uncachedTitles.length; i += BATCH_SIZE) {
    const batch = uncachedTitles.slice(i, i + BATCH_SIZE);
    try {
      const translations = await fetchBatch(batch, fromLang, toLang);
      Object.assign(result, translations);
      titleCache.setBatch(translations, fromLang, toLang);
    } catch (error) {
      console.error(`Wikidata batch ${i}-${i + batch.length} failed:`, error.message);
      // Fill failed batch with originals
      for (const title of batch) {
        if (!(title in result)) {
          result[title] = title;
          titleCache.set(title, fromLang, toLang, title);
        }
      }
    }
  }

  return result;
}

/**
 * Translate template names via Wikidata.
 * Template names are looked up with "Template:" prefix in the source wiki.
 *
 * @param {string[]} templateNames - Template names without "Template:" prefix
 * @param {string} fromLang - Source language code
 * @param {string} toLang - Target language code
 * @returns {Object} Map of { originalName: translatedName }
 */
export async function translateTemplateNames(templateNames, fromLang, toLang) {
  if (!templateNames || templateNames.length === 0) return {};

  // Some templates are just the name, others have "Template:" prefix already
  const prefixedNames = templateNames.map(name => {
    if (name.toLowerCase().startsWith('template:') || name.includes(':')) {
      return name;
    }
    return `Template:${name}`;
  });

  const translations = await translateTitlesViaWikidata(prefixedNames, fromLang, toLang);

  // Map back without prefix
  const result = {};
  for (let i = 0; i < templateNames.length; i++) {
    const prefixed = prefixedNames[i];
    const translated = translations[prefixed] || prefixed;
    // Strip "Template:" prefix (in any language) from the result
    const colonIdx = translated.indexOf(':');
    result[templateNames[i]] = colonIdx !== -1 ? translated.slice(colonIdx + 1) : translated;
  }

  return result;
}

/**
 * Translate an array of category titles via Wikidata sitelinks.
 * Handles category prefixes in source and target languages.
 *
 * @param {string[]} categoryTitles - Category titles (e.g. ['Category:Physics', 'Category:1879 births'])
 * @param {string} fromLang - Source language code
 * @param {string} toLang - Target language code
 * @returns {Object} Map of { originalCategoryTitle: translatedCategoryTitle }
 */
export async function translateCategories(categoryTitles, fromLang, toLang) {
  if (!categoryTitles || categoryTitles.length === 0) return {};
  if (fromLang === toLang) {
    const res = {};
    for (const c of categoryTitles) res[c] = c;
    return res;
  }

  return translateTitlesViaWikidata(categoryTitles, fromLang, toLang);
}

// ──────────────────────────── Internal ────────────────────────────

/**
 * Fetch a single batch of title translations from Wikidata.
 * Handles title normalization from the API response.
 */
async function fetchBatch(titles, fromLang, toLang) {
  const result = {};
  const sourceSite = `${fromLang}wiki`;
  const targetSite = `${toLang}wiki`;

  const response = await axios.get(WIKIDATA_API, {
    params: {
      action: 'wbgetentities',
      sites: sourceSite,
      titles: titles.join('|'),
      props: 'sitelinks',
      format: 'json',
      origin: '*',
    },
    headers: { 'User-Agent': USER_AGENT },
    timeout: REQUEST_TIMEOUT,
  });

  const entities = response.data?.entities || {};

  // Handle normalized titles — Wikidata may normalize "india" → "India"
  const normalizedMap = {};
  if (response.data?.normalized) {
    for (const norm of response.data.normalized) {
      normalizedMap[norm.from] = norm.to;
    }
  }

  // Build a lookup: source title → entity
  const sourceToEntity = {};
  for (const [entityId, entity] of Object.entries(entities)) {
    if (entityId === '-1' || !entity.sitelinks) continue;
    const sourceSitelink = entity.sitelinks[sourceSite];
    if (sourceSitelink) {
      sourceToEntity[sourceSitelink.title] = entity;
    }
  }

  // Map each requested title to its target language equivalent
  for (const title of titles) {
    // Try the title directly, then try the normalized version
    const normalizedTitle = normalizedMap[title] || title;
    const entity = sourceToEntity[title] || sourceToEntity[normalizedTitle];

    if (entity && entity.sitelinks && entity.sitelinks[targetSite]) {
      result[title] = entity.sitelinks[targetSite].title;
    } else {
      result[title] = title; // Default fallback to original
    }
  }

  // Phase 2: Redirect Resolution for any unresolved titles
  // When a source title is a redirect (e.g. 'US' -> 'United States'), wbgetentities fails
  // We query the source Wikipedia with redirects=1 to extract the canonical Wikibase QID
  const unresolvedTitles = titles.filter(t => result[t] === t);
  if (unresolvedTitles.length > 0) {
    try {
      const wikiRes = await axios.get(`https://${fromLang}.wikipedia.org/w/api.php`, {
        params: {
          action: 'query',
          titles: unresolvedTitles.join('|'),
          redirects: '1',
          prop: 'pageprops',
          ppprop: 'wikibase_item',
          format: 'json',
          origin: '*',
        },
        headers: { 'User-Agent': USER_AGENT },
        timeout: REQUEST_TIMEOUT,
      });

      const pages = wikiRes.data?.query?.pages || {};
      const qids = [];
      const titleToQid = {};

      const redirectMap = {};
      if (wikiRes.data?.query?.redirects) {
        for (const r of wikiRes.data.query.redirects) {
          redirectMap[r.from] = r.to;
        }
      }

      for (const page of Object.values(pages)) {
        if (page.pageprops?.wikibase_item) {
          const qid = page.pageprops.wikibase_item;
          qids.push(qid);
          titleToQid[page.title] = qid;
        }
      }

      if (qids.length > 0) {
        const qidResponse = await axios.get(WIKIDATA_API, {
          params: {
            action: 'wbgetentities',
            ids: [...new Set(qids)].join('|'),
            props: 'sitelinks',
            format: 'json',
            origin: '*',
          },
          headers: { 'User-Agent': USER_AGENT },
          timeout: REQUEST_TIMEOUT,
        });

        const qidEntities = qidResponse.data?.entities || {};
        for (const title of unresolvedTitles) {
          const canonicalTitle = redirectMap[title] || title;
          const qid = titleToQid[canonicalTitle];
          if (qid && qidEntities[qid]?.sitelinks?.[targetSite]) {
            result[title] = qidEntities[qid].sitelinks[targetSite].title;
          }
        }
      }
    } catch (e) {
      console.warn('[Wikidata] Redirect resolution fallback warning:', e.message);
    }
  }

  return result;
}
