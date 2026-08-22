/**
 * WikitextParser - Parses wikitext into typed segments and reassembles after translation.
 * 
 * Uses a stack-based parser for templates and wikilinks to handle arbitrary nesting depth.
 * 
 * Segment types:
 *   - text: Plain translatable text
 *   - template: {{TemplateName|param1|param2}}
 *   - link: [[Target|Display text]]
 *   - category: [[Category:...]]
 *   - file: [[File:...]]
 *   - markup: Wiki markup preserved as-is (refs, tags, comments, etc.)
 */

// Matches <ref>...</ref> and self-closing <ref ... />
const REF_RE = /<ref[^>]*(?:\/>|>[\s\S]*?<\/ref>)/gi;
// Matches HTML-like tags (gallery, nowiki, math, syntaxhighlight, etc.)
const PROTECTED_TAG_RE = /<(nowiki|math|syntaxhighlight|source|code|pre|gallery|score|chem|ce|categorytree|timeline|imagemap|mapframe|maplink|graph|templatedata|includeonly|noinclude|onlyinclude)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi;
// Matches external links [http://...]
const EXTLINK_RE = /\[[a-z]+:\/\/[^\]]+\]/gi;
// Matches HTML comments
const COMMENT_RE = /<!--[\s\S]*?-->/g;
// Matches magic words / behavior switches
const MAGIC_RE = /__[A-Z]+__/g;

// Category namespace names across languages
const CATEGORY_PREFIXES = [
  'Category', 'Kategorie', 'Catégorie', 'Categoría', 'Categoria',
  'श्रेणी', 'বিষয়শ্রেণী', 'ವರ್ಗ', 'വർഗ്ഗം', 'பகுப்பு', 'వర్గం',
  'Категория', 'カテゴリ', 'فئة', 'زمرہ',
];

// File/Image namespace names across languages
const FILE_PREFIXES = [
  'File', 'Image', 'चित्र', 'ফাইল', 'ಚಿತ್ರ', 'പ്രമാണം', 'படிமம்', 'దస్త్రం',
  'Datei', 'Archivo', 'Fichier', 'Файл', 'ファイル', 'ملف', 'فائل',
];

/**
 * Stack-based parser for extracting templates and wikilinks with arbitrary nesting.
 * Returns array of { start, end, type, content } for templates and wikilinks found in text.
 */
function extractNestedElements(text) {
  const elements = [];
  const stack = [];
  let i = 0;

  while (i < text.length) {
    // Check for {{ (template start)
    if (text[i] === '{' && i + 1 < text.length && text[i + 1] === '{') {
      stack.push({ type: 'template', start: i });
      i += 2;
      continue;
    }

    // Check for }} (template end)
    if (text[i] === '}' && i + 1 < text.length && text[i + 1] === '}') {
      // Find the most recent template opening on the stack
      for (let j = stack.length - 1; j >= 0; j--) {
        if (stack[j].type === 'template') {
          const opening = stack.splice(j, 1)[0];
          const end = i + 2;
          const content = text.slice(opening.start, end);
          // Only record top-level elements (not nested inside another template/link)
          const isNested = stack.some(s => s.type === 'template');
          if (!isNested) {
            elements.push({ start: opening.start, end, type: 'template', content });
          }
          break;
        }
      }
      i += 2;
      continue;
    }

    // Check for [[ (wikilink start)
    if (text[i] === '[' && i + 1 < text.length && text[i + 1] === '[') {
      stack.push({ type: 'link', start: i });
      i += 2;
      continue;
    }

    // Check for ]] (wikilink end)
    if (text[i] === ']' && i + 1 < text.length && text[i + 1] === ']') {
      // Find the most recent link opening on the stack
      for (let j = stack.length - 1; j >= 0; j--) {
        if (stack[j].type === 'link') {
          const opening = stack.splice(j, 1)[0];
          const end = i + 2;
          const content = text.slice(opening.start, end);
          // Only record if not nested inside another link (can be inside a template though)
          const isNestedInLink = stack.some(s => s.type === 'link');
          if (!isNestedInLink) {
            elements.push({ start: opening.start, end, type: 'link', content });
          }
          break;
        }
      }
      i += 2;
      continue;
    }

    i++;
  }

  // Sort by start position
  elements.sort((a, b) => a.start - b.start);

  // Remove overlapping elements (inner ones already handled by stack logic)
  const filtered = [];
  let lastEnd = 0;
  for (const el of elements) {
    if (el.start >= lastEnd) {
      filtered.push(el);
      lastEnd = el.end;
    }
  }

  return filtered;
}

/**
 * Classify a wikilink as category, file, or regular link.
 */
function classifyLink(content) {
  // Remove [[ and ]]
  const inner = content.slice(2, -2);
  const target = inner.split('|')[0].trim();

  for (const prefix of CATEGORY_PREFIXES) {
    if (target.toLowerCase().startsWith(prefix.toLowerCase() + ':')) {
      return 'category';
    }
  }
  for (const prefix of FILE_PREFIXES) {
    if (target.toLowerCase().startsWith(prefix.toLowerCase() + ':')) {
      return 'file';
    }
  }
  return 'link';
}

/**
 * Parse wikitext into an array of typed segments.
 * Protected segments (templates, links, refs, tags) are extracted.
 * The remaining text segments are what need translation.
 */
export function parseWikitext(wikitext) {
  const segments = [];
  let placeholderIndex = 0;
  let working = wikitext;

  // Phase 1: Protect non-parseable elements with simple regex (order matters)
  const protectedItems = [];

  const protect = (regex, type) => {
    working = working.replace(regex, (match) => {
      const placeholder = `\x00${type}_${placeholderIndex}\x00`;
      protectedItems.push({ placeholder, type, original: match, index: placeholderIndex });
      placeholderIndex++;
      return placeholder;
    });
  };

  // Protect: comments, protected tags, refs, ext links, magic words
  protect(COMMENT_RE, 'COMMENT');
  protect(PROTECTED_TAG_RE, 'TAG');
  protect(REF_RE, 'REF');
  protect(EXTLINK_RE, 'EXTLINK');
  protect(MAGIC_RE, 'MAGIC');

  // Phase 2: Stack-based extraction of templates and wikilinks
  const nestedElements = extractNestedElements(working);

  // Replace from end to start to preserve positions
  for (let i = nestedElements.length - 1; i >= 0; i--) {
    const el = nestedElements[i];
    const placeholder = `\x00${el.type.toUpperCase()}_${placeholderIndex}\x00`;

    if (el.type === 'template') {
      protectedItems.push({
        placeholder, type: 'TEMPLATE', original: el.content, index: placeholderIndex,
      });
    } else if (el.type === 'link') {
      const linkType = classifyLink(el.content);
      const inner = el.content.slice(2, -2);
      const pipeIdx = inner.indexOf('|');
      const target = pipeIdx !== -1 ? inner.slice(0, pipeIdx).trim() : inner.trim();
      const display = pipeIdx !== -1 ? (inner.slice(pipeIdx + 1).trim() || null) : null;

      if (linkType === 'category') {
        protectedItems.push({
          placeholder, type: 'CATEGORY', original: el.content, index: placeholderIndex,
          target, display,
        });
      } else if (linkType === 'file') {
        protectedItems.push({
          placeholder, type: 'FILE', original: el.content, index: placeholderIndex,
        });
      } else {
        protectedItems.push({
          placeholder, type: 'LINK', original: el.content, index: placeholderIndex,
          target, display,
        });
      }
    }

    working = working.slice(0, el.start) + placeholder + working.slice(el.end);
    placeholderIndex++;
  }

  // Phase 3: Split remaining text by placeholders and extract headings
  const parts = working.split(/(\x00[A-Z]+_\d+\x00)/);

  // Helper to recursively restore any protected items that were captured inside another item (e.g. comment inside template)
  const restoreProtected = (str) => {
    if (!str || typeof str !== 'string') return str;
    let result = str;
    for (const p of protectedItems) {
      if (result.includes(p.placeholder)) {
        result = result.split(p.placeholder).join(p.original);
      }
    }
    return result;
  };

  for (const part of parts) {
    if (!part) continue;

    const placeholderMatch = part.match(/^\x00([A-Z]+)_(\d+)\x00$/);
    if (placeholderMatch) {
      const item = protectedItems.find(p => p.placeholder === part);
      if (item) {
        // Restore any inner protected items that were nested inside this item
        const restoredContent = restoreProtected(item.original);
        segments.push({
          type: item.type.toLowerCase(),
          content: restoredContent,
          placeholder: item.placeholder,
          ...(item.target !== undefined ? { target: restoreProtected(item.target) } : {}),
          ...(item.display !== undefined ? { display: restoreProtected(item.display) } : {}),
        });
      }
    } else {
      // Split text part by heading lines so headings are translated as pure text without '=' marks
      const lines = part.split('\n');
      let currentProse = [];

      for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];
        const headingMatch = line.match(/^([ \t]*)(={2,})\s*([^=\n]+?)\s*(={2,})([ \t]*)$/);

        if (headingMatch) {
          if (currentProse.length > 0) {
            segments.push({ type: 'text', content: currentProse.join('\n') });
            currentProse = [];
          }
          const leftEquals = headingMatch[2].length;
          const rightEquals = headingMatch[4].length;
          const level = Math.min(Math.min(leftEquals, rightEquals), 6);
          const headingText = headingMatch[3].trim();
          segments.push({
            type: 'heading',
            level,
            text: headingText,
            content: line,
          });
        } else {
          currentProse.push(line);
        }
      }

      if (currentProse.length > 0) {
        segments.push({ type: 'text', content: currentProse.join('\n') });
      }
    }
  }

  return segments;
}

/**
 * Extract all category targets from segments for batch Wikidata lookup.
 */
export function extractCategoryTargets(segments) {
  return segments
    .filter(s => s.type === 'category' && s.target)
    .map(s => s.target);
}

/**
 * Extract all wikilink targets from segments for batch Wikidata lookup.
 */
export function extractLinkTargets(segments) {
  const targets = [];
  for (const s of segments) {
    if (s.type === 'link' && s.target) {
      targets.push(s.target);
    } else if (s.type === 'template' && s.content) {
      const matches = s.content.matchAll(/\[\[\s*([^\]|]+?)(?:\|[^\]]+)?\s*\]\]/g);
      for (const m of matches) {
        const innerTarget = m[1].trim();
        const lower = innerTarget.toLowerCase();
        if (!lower.startsWith('category:') && !lower.startsWith('file:') && !lower.startsWith('image:') && !lower.startsWith('ଫାଇଲ:') && !lower.startsWith('चित्र:')) {
          targets.push(innerTarget);
        }
      }
    }
  }
  return [...new Set(targets)];
}

/**
 * Extract template names from segments for batch Wikidata lookup.
 * Strips any HTML comments and returns just the clean template name.
 */
export function extractTemplateNames(segments) {
  return segments
    .filter(s => s.type === 'template')
    .map(s => {
      const inner = s.content.slice(2, -2); // Remove {{ and }}
      const withoutComments = inner.replace(/<!--[\s\S]*?-->/g, '').trim();
      const name = withoutComments.split('|')[0].trim();
      return name;
    })
    .filter(name => name && !name.startsWith('#') && !name.startsWith('{'));
}

export const TECHNICAL_TEMPLATES = new Set([
  'coord', 'coord2', 'coor', 'coor dms', 'coor dm', 'coordinates',
  'convert', 'url', 'flag', 'flagicon', 'flagcountry', 'lang', 'ipa', 'nihongo',
  'reflist', 'references', 'authority control', 'autorite', 'normdaten', 'dmy', 'mdy',
  'use dmy dates', 'use mdy dates', 'use indian english', 'short description', 'redirect',
  'good article', 'featured article', 'pp-extended', 'pp-move'
]);

export const TEMPLATE_PARAM_ALIASES = {
  fr: {
    // English Infobox settlement -> French Infobox Localité / Ville
    name: 'nom',
    official_name: 'nom',
    settlement_type: 'statut',
    subdivision_name: 'pays',
    subdivision_name1: 'subdivision',
    subdivision_name2: 'subdivision2',
    population_total: 'population',
    population_as_of: 'annee_pop',
    elevation_m: 'altitude',
    area_total_km2: 'superficie',
    postal_code: 'code postal',
    image_skyline: 'image',
    image_caption: 'legende',
    // English Infobox person -> French Infobox Biographie
    birth_date: 'date de naissance',
    birth_place: 'lieu de naissance',
    death_date: 'date de décès',
    death_place: 'lieu de décès',
    nationality: 'nationalité',
    occupation: 'profession',
  },
};

const PROTECTED_PARAM_NAMES = new Set([
  'image', 'image_skyline', 'image_flag', 'image_seal', 'image_map', 'image_coat_of_arms',
  'image_blank_emblem', 'signature', 'signature_alt', 'filename', 'file', 'logo', 'map',
  'pushpin_map', 'sound', 'audio', 'video', 'recording', 'coat_of_arms', 'flag', 'seal', 'icon',
  'registration_plate', 'postal_code', 'area_code', 'utc_offset', 'utc_offset1', 'coordinates',
  'coordinates_display', 'coordinates_footnotes', 'mapframe', 'mapsize', 'imagesize', 'unit_pref',
  'elevation_m', 'elevation_ft', 'area_rank', 'population_rank', 'website', 'url', 'doi', 'isbn',
  'issn', 'pmid', 'pmc', 'arxiv',
  'latd', 'latm', 'lats', 'latns', 'longd', 'longm', 'longs', 'longew',
  'lat_d', 'lat_m', 'lat_s', 'lat_ns', 'long_d', 'long_m', 'long_s', 'long_ew',
  'lat_deg', 'lat_min', 'lat_sec', 'lat_dir', 'lon_deg', 'lon_min', 'lon_sec', 'lon_dir',
  'latitude', 'longitude', 'coor', 'coord', 'native_name_lang', 'iso_code', 'iso_3166_2', 'lang', 'language_code',
]);

export const CATEGORY_PREFIX_MAP = {
  ar: 'تصنيف', as: 'শ্ৰেণী', bn: 'বিষয়শ্রেণী', bho: 'श्रेणी', br: 'Rummad', ca: 'Categoria',
  cs: 'Kategorie', cy: 'Categori', da: 'Kategori', de: 'Kategorie', el: 'Κατηγορία', en: 'Category',
  eo: 'Kategorio', es: 'Categoría', et: 'Kategooria', eu: 'Kategoria', fa: 'رده', fi: 'Luokka',
  fr: 'Catégorie', ga: 'Catagóir', gl: 'Categoría', gu: 'શ્રેણી', he: 'קטגוריה', hi: 'श्रेणी',
  hr: 'Kategorija', hu: 'Kategória', hy: '\u053f\u0561\u057f\u0565\u0563\u0578\u0580\u056b\u0561', id: 'Kategori', is: 'Flokkur', it: 'Categoria',
  ja: 'Category', jv: 'Kategori', ka: '\u10d9\u10d0\u10e2\u10d4\u10d2\u10dd\u10e0\u10d8\u10d0', kn: 'ವರ್ಗ', ko: '분류', ku: 'Kategorî',
  la: 'Categoria', lt: 'Kategorija', lv: 'Kategorija', mai: 'श्रेणी', ml: 'വർഗ്ഗം', mn: 'Ангилаલ',
  mr: 'वर्ग', ms: 'Kategori', my: 'ကဏ္ဍ', ne: 'श्रेणी', nl: 'Categorie', nn: 'Kategori',
  no: 'Kategori', or: '\u0b36\u0b4d\u0b30\u0b47\u0b23\u0b40', pa: '\u0a38\u0a3c\u0a4d\u0a30\u0a47\u0a23\u0a40', pl: 'Kategoria', ps: 'وېشنيزه', pt: 'Categoria',
  ro: 'Categorie', ru: 'Категория', sa: 'वर्गः', sat: 'ᱛᱷᱚᱠ', sd: 'زمرو', sk: 'Kategória',
  sl: 'Kategorija', sq: 'Kategoria', sr: 'Категорија', su: 'Kategori', sv: 'Kategori', sw: 'Jamii',
  ta: 'பகுப்பு', te: 'వర్గం', th: 'หมวดหมู่', tl: 'Kategorya', tr: 'Kategori', uk: 'Категорія',
  ur: 'زمرہ', vi: 'Thể loại', yi: 'קאַטעגאָריע', zh: 'Category',
};

export const REFLIST_TEMPLATE_MAP = {
  ar: 'مراجع', bn: 'सूत्र', de: 'Einzelnachweise', en: 'Reflist', es: 'Referencias', fa: 'پانویس',
  fr: 'Références', gu: 'સંદર્ભ', he: 'הערות שוליים', hi: 'सन्दर्भ', it: 'Note', ja: 'Reflist',
  kn: 'ಉಲ್ಲೇಖಗಳು', ml: 'അവലംബം', mr: 'संदर्भ', or: 'ଆଧାର', pa: 'ਹਵਾਲੇ', pt: 'Referências',
  ru: 'Примечания', ta: 'சான்றுகள்', te: 'మూలాలు', ur: 'حوالہ جات', zh: 'Reflist',
};

import { normalizeToAsciiDigits, isPureNumericOrDateOrCode } from './numeralConverter.js';

/**
 * Determines whether a template parameter value represents translatable text.
 */
export function isTranslatableParamValue(val, paramName = '') {
  if (!val || typeof val !== 'string') return false;
  const t = val.trim();
  if (t.length === 0) return false;

  // Protect HTML comments: <!-- ... -->
  if (t.startsWith('<!--') && t.endsWith('-->')) {
    return false;
  }

  // Protect known media/file/technical parameter keys
  const normalizedKey = (paramName || '').toLowerCase().replace(/[\s_-]+/g, '_');
  if (PROTECTED_PARAM_NAMES.has(normalizedKey) || normalizedKey.startsWith('image_') || normalizedKey.endsWith('_image') || normalizedKey.endsWith('_filename') || normalizedKey.endsWith('_file')) {
    return false;
  }

  // Protect any string ending in a media file extension (including filenames with spaces, commas, dates)
  if (/\.(?:jpg|jpeg|png|svg|gif|webp|tiff|tif|pdf|ogg|oga|ogv|mp3|mp4|wav|flac|webm|avi|mov)$/i.test(t)) {
    return false;
  }

  // Universal check: numbers, coordinates, dates, units, offsets, direction letters, flags, and language codes
  if (isPureNumericOrDateOrCode(t, paramName)) {
    return false;
  }

  if (/^https?:\/\//i.test(t)) return false;
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(t)) return false;
  return true;
}

/**
 * Extract translatable text segments from template parameters.
 * Returns an array of { segmentIndex, paramIndex, paramName, text, hasWikilinks }.
 */
export function extractTemplateParamTexts(segments) {
  const paramTexts = [];

  segments.forEach((seg, segIdx) => {
    if (seg.type !== 'template') return;

    try {
      const parsed = parseTemplate(seg.content);
      const lowerName = parsed.name.toLowerCase().trim();

      // Skip technical templates whose parameters should not be sent to text MT
      if (TECHNICAL_TEMPLATES.has(lowerName) || lowerName.startsWith('coord') || lowerName.startsWith('use ')) {
        return;
      }

      parsed.params.forEach((param, paramIdx) => {
        if (param.isComment) return;
        const val = param.value.trim();
        if (isTranslatableParamValue(val, param.name)) {
          paramTexts.push({
            segmentIndex: segIdx,
            paramIndex: paramIdx,
            paramName: param.name,
            text: val,
            hasWikilinks: val.includes('[[') || val.includes('{{'),
          });
        }
      });
    } catch {
      // Fallback
    }
  });

  return paramTexts;
}

/**
 * Split template params by | respecting nested {{ }} and [[ ]]
 */
function splitTemplateParams(str) {
  const params = [];
  let depth = 0;
  let current = '';

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const next = str[i + 1];

    if ((ch === '{' && next === '{') || (ch === '[' && next === '[')) {
      depth++;
      current += ch + next;
      i++;
    } else if ((ch === '}' && next === '}') || (ch === ']' && next === ']')) {
      depth--;
      current += ch + next;
      i++;
    } else if (ch === '|' && depth === 0) {
      params.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) params.push(current);
  return params;
}

/**
 * Normalizes wikitext syntax after machine translation:
 *  - Fixes spaces in headings introduced by MT: "= = Heading = =" -> "== Heading =="
 *  - Ensures headings are separated on their own clean lines
 *  - Enforces clean spacing around [[wikilinks]] in prose
 *  - Trims inner wikilink spacing
 *  - Strips any remaining unexpanded null/placeholder byte tokens
 */
export function normalizeWikitextSyntax(wikitext) {
  if (!wikitext || typeof wikitext !== 'string') return wikitext;

  const lines = wikitext.split('\n');
  const normalizedLines = lines.map(line => {
    // Check if line contains a heading (e.g. "= = Heading = =" or "= = = = Sub = = = =" or "= = Heading = = Some text")
    const headingMatch = line.match(/^([ \t]*)((?:=\s*){2,})(.*?)((?:\s*=){2,})([ \t]*(.*))$/);
    if (headingMatch) {
      const leftEqualsCount = (headingMatch[2].match(/=/g) || []).length;
      const rightEqualsCount = (headingMatch[4].match(/=/g) || []).length;
      const headingText = headingMatch[3].replace(/^=+|==+$/g, '').trim();
      const trailing = headingMatch[6] ? headingMatch[6].trim() : '';

      if (leftEqualsCount >= 2 && rightEqualsCount >= 2 && headingText) {
        const level = Math.min(Math.min(leftEqualsCount, rightEqualsCount), 6);
        const eq = '='.repeat(level);
        if (trailing) {
          return `${eq} ${headingText} ${eq}\n\n${trailing}`;
        }
        return `${eq} ${headingText} ${eq}`;
      }
    }

    // Fix bullet list markers without space (e.g. "*Item" -> "* Item")
    let l = line.replace(/^([ \t]*[*#]+)([^\s*#])/g, '$1 $2');
    return l;
  });

  let result = normalizedLines.join('\n');

  // Fix extra spacing inside wikilinks and normalize [[ Foo | Foo ]] -> [[Foo]]
  result = result.replace(/\[\[\s*([^\]|]+?)\s*\|\s*([^\]]+?)\s*\]\]/g, (match, target, display) => {
    const t = target.trim();
    const d = display.trim();
    return t === d ? `[[${t}]]` : `[[${t}|${d}]]`;
  });
  result = result.replace(/\[\[\s*([^\]|]+?)\s*\]\]/g, '[[$1]]');

  // Fix missing space between prose words and opening wikilinks: e.g. "ਪਿੰਡ[[ਕਟକ]]" or "le[[Père" -> "ਪਿੰਡ [[ਕਟକ]]", "le [[Père"
  result = result.replace(/([^\s\[{=(|:;«"'/\p{P}])(\[\[)/gu, '$1 $2');

  // Fix missing space between closing wikilinks and following prose words: e.g. "[[ਕਟକ]]ਸ਼ਹਿਰ" -> "[[ਕਟକ]] ਸ਼ਹਿਰ"
  result = result.replace(/(\]\])([^\s\],.:;?!)}'»"/\p{P}])/gu, '$1 $2');

  // Fix coordinate format converted to time by MT (e.g. 20h50 -> 20.50 inside Coord templates)
  result = result.replace(/(\{\{[Cc]oord[^}]*?)(\d+)h(\d+)/g, '$1$2.$3');

  // Fix interwiki prefix translated to French word "ou"
  result = result.replace(/\[\[:ou:/g, '[[:or:');

  // Fix political party translated to "Fête" in French
  result = result.replace(/\bFête\s+([A-ZÀ-Ý][a-zà-ÿ]+(?:\s+[A-ZÀ-Ý][a-zà-ÿ]+)*)/g, (match, p1) => {
    if (['Janata', 'Bharatiya', 'Congress', 'Travailliste', 'Socialiste', 'Démocrate', 'Républicain'].includes(p1.split(' ')[0])) {
      return `Parti ${p1}`;
    }
    return match;
  });

  // Remove any stray placeholder artifacts (e.g. \x00COMMENT_0\x00 or ◆COMMENT_0◆)
  result = result.replace(/\x00[A-Z]+_\d+\x00/g, '');
  result = result.replace(/◆[A-Z]+_\d+◆/g, '');

  // Normalize excessive consecutive blank lines (max 2)
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}

/**
 * Reassemble wikitext from translated segments.
 * 
 * @param {Array} segments - The parsed segments
 * @param {Object} translatedTexts - Map of original text → translated text
 * @param {Object} translatedLinks - Map of link target → translated target
 * @param {Object} translatedTemplates - Map of template name → translated name
 * @param {Object} translatedDisplayTexts - Map of display text → translated display text
 * @param {Object} translatedParamTexts - Map of param text → translated param text (optional)
 * @param {Object} translatedCategories - Map of category target → translated category target
 * @param {Object} options - { missingLinkStrategy: 'translate'|'ill'|'plain'|'keep_source', fromLang, toLang, unresolvedTranslatedTargets }
 */
export function reassembleWikitext(
  segments,
  translatedTexts,
  translatedLinks,
  translatedTemplates,
  translatedDisplayTexts,
  translatedParamTexts = {},
  translatedCategories = {},
  options = {}
) {
  const parts = [];
  const missingLinkStrategy = options.missingLinkStrategy || 'translate';
  const fromLang = options.fromLang || 'en';
  const toLang = options.toLang || '';
  const unresolvedTranslatedTargets = options.unresolvedTranslatedTargets || {};

  for (const seg of segments) {
    switch (seg.type) {
      case 'text': {
        const text = translatedTexts[seg.content] ?? seg.content;
        parts.push(text);
        break;
      }

      case 'heading': {
        const level = seg.level || 2;
        const eq = '='.repeat(level);
        const translatedHeading = translatedTexts[seg.text] ?? seg.text;
        parts.push(`\n\n${eq} ${translatedHeading.trim()} ${eq}\n\n`);
        break;
      }

      case 'link': {
        const resolvedTarget = translatedLinks[seg.target];
        const isWikidataResolved = resolvedTarget && resolvedTarget !== seg.target;

        if (isWikidataResolved) {
          // Article exists on target wiki (Wikidata resolved)
          const newTarget = resolvedTarget;
          if (seg.display) {
            const newDisplay = translatedDisplayTexts[seg.display] ?? seg.display;
            if (newDisplay === newTarget) {
              parts.push(`[[${newTarget}]]`);
            } else {
              parts.push(`[[${newTarget}|${newDisplay}]]`);
            }
          } else {
            let display = translatedDisplayTexts[seg.target] ?? newTarget;
            const parenMatch = display.match(/^(.+?)\s*\([^)]+\)$/);
            if (parenMatch && parenMatch[1].trim()) {
              display = parenMatch[1].trim();
            }
            if (display === newTarget) {
              parts.push(`[[${newTarget}]]`);
            } else {
              parts.push(`[[${newTarget}|${display}]]`);
            }
          }
        } else {
          // Article does NOT exist on target wiki (missing Wikidata sitelink)
          const hasUnresolvedTranslation = unresolvedTranslatedTargets && unresolvedTranslatedTargets[seg.target];
          const translatedTarget = hasUnresolvedTranslation ? unresolvedTranslatedTargets[seg.target] : seg.target;
          const displaySource = seg.display || seg.target;
          const translatedDisplay = translatedDisplayTexts[displaySource] ?? translatedTarget;

          if (missingLinkStrategy === 'plain' && hasUnresolvedTranslation) {
            // Strip link brackets, keep plain translated text
            parts.push(translatedDisplay);
          } else if (missingLinkStrategy === 'ill' && hasUnresolvedTranslation) {
            // Interlanguage template
            if (toLang === 'fr') {
              parts.push(`{{Lien|trad=${seg.target}|titre=${translatedTarget}|lang=${fromLang}}}`);
            } else {
              parts.push(`{{ill|${translatedTarget}|${fromLang}|${seg.target}}}`);
            }
          } else if (missingLinkStrategy === 'keep_source') {
            if (seg.display || translatedDisplay !== seg.target) {
              parts.push(`[[${seg.target}|${translatedDisplay}]]`);
            } else {
              const parenMatch = seg.target.match(/^(.+?)\s*\([^)]+\)$/);
              if (parenMatch && parenMatch[1].trim()) {
                parts.push(`[[${seg.target}|${parenMatch[1].trim()}]]`);
              } else {
                parts.push(`[[${seg.target}]]`);
              }
            }
          } else {
            // Default: 'translate' (Native Red Link) or unmodified original if no translation provided
            if (seg.display) {
              parts.push(`[[${translatedTarget}|${translatedDisplay}]]`);
            } else if (hasUnresolvedTranslation && translatedTarget !== translatedDisplay) {
              parts.push(`[[${translatedTarget}|${translatedDisplay}]]`);
            } else {
              const parenMatch = translatedTarget.match(/^(.+?)\s*\([^)]+\)$/);
              if (parenMatch && parenMatch[1].trim()) {
                parts.push(`[[${translatedTarget}|${parenMatch[1].trim()}]]`);
              } else {
                parts.push(`[[${translatedTarget}]]`);
              }
            }
          }
        }
        break;
      }

      case 'template': {
        try {
          const parsed = parseTemplate(seg.content);
          let translatedName = translatedTemplates[parsed.name] || parsed.name;
          if (translatedName === parsed.name && toLang) {
            const lower = parsed.name.toLowerCase();
            if (['reflist', 'references', 'reference', 'ref', 'notes', 'refliste', 'ଆଧାର', 'ਹਵਾਲੇ', 'सन्दर्भ'].includes(lower)) {
              translatedName = REFLIST_TEMPLATE_MAP[toLang] || translatedName;
            }
          }
          const reassembled = reassembleTemplate(
            parsed,
            translatedName,
            translatedParamTexts,
            {},
            toLang
          );
          parts.push(reassembled);
        } catch {
          const inner = seg.content.slice(2, -2);
          const pipeIndex = inner.indexOf('|');
          if (pipeIndex === -1) {
            const cleanName = inner.replace(/<!--[\s\S]*?-->/g, '').trim();
            const translatedName = translatedTemplates[cleanName] ?? cleanName;
            parts.push(`{{${translatedName}}}`);
          } else {
            const rawName = inner.slice(0, pipeIndex);
            const cleanName = rawName.replace(/<!--[\s\S]*?-->/g, '').trim();
            let params = inner.slice(pipeIndex);
            const translatedName = translatedTemplates[cleanName] ?? cleanName;

            if (Object.keys(translatedParamTexts).length > 0) {
              for (const [original, translated] of Object.entries(translatedParamTexts)) {
                if (params.includes(original)) {
                  params = params.split(original).join(translated);
                }
              }
            }

            parts.push(`{{${translatedName}${params}}}`);
          }
        }
        break;
      }

      // Category: translate target via Wikidata if resolved, localize namespace prefix
      case 'category': {
        const targetPrefix = (toLang && CATEGORY_PREFIX_MAP[toLang]) || 'Category';
        const colonIdx = seg.target.indexOf(':');
        const cleanTarget = colonIdx !== -1 ? seg.target.slice(colonIdx + 1).trim() : seg.target.trim();

        const translatedCat = translatedCategories[seg.target] || translatedCategories[`Category:${cleanTarget}`] || translatedCategories[cleanTarget];
        const isWikidataResolved = translatedCat && translatedCat !== seg.target && translatedCat !== `Category:${cleanTarget}`;

        if (isWikidataResolved) {
          const catColonIdx = translatedCat.indexOf(':');
          const resolvedClean = catColonIdx !== -1 ? translatedCat.slice(catColonIdx + 1).trim() : translatedCat.trim();
          const prefix = (toLang && CATEGORY_PREFIX_MAP[toLang]) || (catColonIdx !== -1 ? translatedCat.slice(0, catColonIdx) : 'Category');
          if (seg.display && seg.display.trim()) {
            parts.push(`[[${prefix}:${resolvedClean}|${seg.display.trim()}]]`);
          } else {
            parts.push(`[[${prefix}:${resolvedClean}]]`);
          }
        } else {
          // Translate category name text after colon via MT
          const translatedTargetName = (unresolvedTranslatedTargets && unresolvedTranslatedTargets[cleanTarget]) || cleanTarget;
          if (seg.display && seg.display.trim()) {
            parts.push(`[[${targetPrefix}:${translatedTargetName.trim()}|${seg.display.trim()}]]`);
          } else {
            parts.push(`[[${targetPrefix}:${translatedTargetName.trim()}]]`);
          }
        }
        break;
      }

      // All other types (file, comment, tag, ref, extlink, magic) are preserved as-is
      default:
        parts.push(seg.content);
        break;
    }
  }

  const rawReassembled = parts.join('');
  return normalizeWikitextSyntax(rawReassembled);
}

/**
 * Parse a standalone template wikitext string.
 * Supports multi-line templates like Infoboxes with key-value parameters and comments.
 *
 * @param {string} templateStr - E.g. "{{Infobox person | name = Albert | birth_date = 1879 }}"
 * @returns {Object} { name, headerComments, params: [{ name, value, raw, isNamed, isComment, index }], isMultiLine }
 */
export function parseTemplate(templateStr) {
  const trimmed = templateStr.trim();
  if (!trimmed.startsWith('{{') || !trimmed.endsWith('}}')) {
    throw new Error('Invalid template format. Must start with {{ and end with }}');
  }

  const isMultiLine = trimmed.includes('\n');
  const inner = trimmed.slice(2, -2);
  const pipeIdx = inner.indexOf('|');

  if (pipeIdx === -1) {
    const rawName = inner.trim();
    const cleanName = rawName.replace(/<!--[\s\S]*?-->/g, '').trim();
    const headerComments = (rawName.match(/<!--[\s\S]*?-->/g) || []).join('\n');
    return {
      name: cleanName,
      headerComments,
      params: [],
      isMultiLine,
      raw: trimmed,
    };
  }

  const rawNameWithComments = inner.slice(0, pipeIdx).trim();
  const name = rawNameWithComments.replace(/<!--[\s\S]*?-->/g, '').trim();
  const headerComments = (rawNameWithComments.match(/<!--[\s\S]*?-->/g) || []).join('\n');

  const paramsStr = inner.slice(pipeIdx + 1);
  const rawParams = splitTemplateParams(paramsStr);

  const params = rawParams.map((rawParam, idx) => {
    const trimmedP = rawParam.trim();
    if (trimmedP.startsWith('<!--') && trimmedP.endsWith('-->')) {
      return {
        name: `_comment_${idx}`,
        value: trimmedP,
        raw: rawParam,
        isNamed: false,
        isComment: true,
        index: idx,
      };
    }

    const eqIdx = rawParam.indexOf('=');
    if (eqIdx !== -1) {
      const key = rawParam.slice(0, eqIdx).trim();
      const val = rawParam.slice(eqIdx + 1).trim();
      return {
        name: key,
        value: val,
        raw: rawParam,
        isNamed: true,
        isComment: false,
        index: idx,
      };
    } else {
      return {
        name: String(idx + 1),
        value: trimmedP,
        raw: rawParam,
        isNamed: false,
        isComment: false,
        index: idx,
      };
    }
  });

  return {
    name,
    headerComments,
    params,
    isMultiLine,
    raw: trimmed,
  };
}

/**
 * Reassemble a parsed template with translated name and translated parameters.
 *
 * @param {Object} parsedTemplate - Object from parseTemplate
 * @param {string} translatedName - Translated template name
 * @param {Object} translatedParamValues - Map of original value -> translated value (or paramName -> translated value)
 * @param {Object} translatedParamNames - Optional map of original key name -> translated key name
 * @returns {string} Reassembled template wikitext
 */
export function reassembleTemplate(
  parsedTemplate,
  translatedName,
  translatedParamValues = {},
  translatedParamNames = {},
  toLang = ''
) {
  const name = translatedName || parsedTemplate.name;
  const langAliases = (toLang && TEMPLATE_PARAM_ALIASES[toLang]) || {};

  if (!parsedTemplate.params || parsedTemplate.params.length === 0) {
    if (parsedTemplate.headerComments) {
      return `{{${name}\n${parsedTemplate.headerComments}\n}}`;
    }
    return `{{${name}}}`;
  }

  if (parsedTemplate.isMultiLine) {
    const lines = [`{{${name}`];
    if (parsedTemplate.headerComments) {
      lines.push(parsedTemplate.headerComments);
    }
    for (const p of parsedTemplate.params) {
      if (p.isComment) {
        lines.push(p.value);
        continue;
      }
      const rawKey = p.name ? p.name.trim().toLowerCase() : '';
      const pName = translatedParamNames[p.name] || langAliases[rawKey] || p.name;
      let pVal = translatedParamValues[p.value] ?? translatedParamValues[p.name] ?? p.value;
      if (pVal && typeof pVal === 'string' && !pVal.startsWith('<!--')) {
        pVal = normalizeToAsciiDigits(pVal);
      }
      if (p.isNamed) {
        lines.push(`| ${pName} = ${pVal}`);
      } else {
        lines.push(`| ${pVal}`);
      }
    }
    lines.push('}}');
    return lines.join('\n');
  } else {
    const headerPrefix = parsedTemplate.headerComments ? ` ${parsedTemplate.headerComments}` : '';
    const paramParts = parsedTemplate.params.map(p => {
      if (p.isComment) return p.value;
      const rawKey = p.name ? p.name.trim().toLowerCase() : '';
      const pName = translatedParamNames[p.name] || langAliases[rawKey] || p.name;
      let pVal = translatedParamValues[p.value] ?? translatedParamValues[p.name] ?? p.value;
      if (pVal && typeof pVal === 'string' && !pVal.startsWith('<!--')) {
        pVal = normalizeToAsciiDigits(pVal);
      }
      return p.isNamed ? `${pName} = ${pVal}` : pVal;
    });
    const hasSpaceBeforeFirstPipe = parsedTemplate.raw && parsedTemplate.raw.startsWith(`{{${parsedTemplate.name} `);
    const sep = hasSpaceBeforeFirstPipe ? ' | ' : '| ';
    return `{{${name}${headerPrefix}${sep}${paramParts.join(' | ')}}}`;
  }
}
