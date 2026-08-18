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
      const display = pipeIdx !== -1 ? inner.slice(pipeIdx + 1).trim() : null;

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

  // Phase 3: Split remaining text by placeholders to get text segments
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
      // This is a text segment that needs translation
      segments.push({ type: 'text', content: part });
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
  return segments
    .filter(s => s.type === 'link' && s.target)
    .map(s => s.target);
}

/**
 * Extract template names from segments for batch Wikidata lookup.
 * Returns just the template name (before first |).
 */
export function extractTemplateNames(segments) {
  return segments
    .filter(s => s.type === 'template')
    .map(s => {
      const inner = s.content.slice(2, -2); // Remove {{ and }}
      const name = inner.split('|')[0].trim();
      return name;
    })
    .filter(name => name && !name.startsWith('#') && !name.startsWith('{'));
}

/**
 * Extract translatable text segments from template parameters.
 * Returns an array of { templateIndex, paramIndex, text } for text-heavy params.
 */
export function extractTemplateParamTexts(segments) {
  const paramTexts = [];

  segments.forEach((seg, segIdx) => {
    if (seg.type !== 'template') return;

    const inner = seg.content.slice(2, -2);
    const pipeIdx = inner.indexOf('|');
    if (pipeIdx === -1) return;

    const paramsStr = inner.slice(pipeIdx + 1);
    const params = splitTemplateParams(paramsStr);

    params.forEach((param, paramIdx) => {
      const eqIdx = param.indexOf('=');
      if (eqIdx === -1) return;

      const value = param.slice(eqIdx + 1).trim();
      // Only translate params that look like prose text (>20 chars, has spaces)
      if (value.length > 20 && value.includes(' ') && !isNumericOrDate(value)) {
        paramTexts.push({ segmentIndex: segIdx, paramIndex: paramIdx, paramName: param.slice(0, eqIdx).trim(), text: value });
      }
    });
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
 * Check if a value looks numeric, date-like, or not prose.
 */
function isNumericOrDate(val) {
  return /^\d[\d,./ -]*$/.test(val.trim()) || /^\d{4}-\d{2}-\d{2}/.test(val.trim());
}

/**
 * Normalizes wikitext syntax after machine translation:
 *  - Fixes spaces in headings introduced by MT: "= = Heading = =" -> "== Heading =="
 *  - Ensures linebreaks before headings and list items
 *  - Trims inner wikilink spacing
 *  - Strips any remaining unexpanded null/placeholder byte tokens
 */
export function normalizeWikitextSyntax(wikitext) {
  if (!wikitext || typeof wikitext !== 'string') return wikitext;

  const lines = wikitext.split('\n');
  const normalizedLines = lines.map(line => {
    // Check if line is a heading with spaced or unspaced equal signs:
    // e.g. "= = Heading = =" or "= = = Heading = = =" or "== Heading =="
    const headingMatch = line.match(/^([ \t]*)((?:=\s*){2,})(.*?)((?:\s*=){2,})[ \t]*$/);
    if (headingMatch) {
      const leftEqualsCount = (headingMatch[2].match(/=/g) || []).length;
      const rightEqualsCount = (headingMatch[4].match(/=/g) || []).length;
      const headingText = headingMatch[3].replace(/^=+|==+$/g, '').trim();

      if (leftEqualsCount >= 2 && rightEqualsCount >= 2 && headingText) {
        const level = Math.min(Math.min(leftEqualsCount, rightEqualsCount), 6);
        const eq = '='.repeat(level);
        return `${eq} ${headingText} ${eq}`;
      }
    }

    // Fix bullet list markers without space (e.g. "*Item" -> "* Item")
    let l = line.replace(/^([ \t]*[*#]+)([^\s*#])/g, '$1 $2');
    return l;
  });

  let result = normalizedLines.join('\n');

  // Fix extra spacing inside wikilinks: [[ Foo | Bar ]] -> [[Foo|Bar]]
  result = result.replace(/\[\[\s*([^\]|]+?)\s*\|\s*([^\]]+?)\s*\]\]/g, '[[$1|$2]]');
  result = result.replace(/\[\[\s*([^\]|]+?)\s*\]\]/g, '[[$1]]');

  // Remove any stray placeholder artifacts (e.g. \x00COMMENT_0\x00 or ◆COMMENT_0◆)
  result = result.replace(/\x00[A-Z]+_\d+\x00/g, '');
  result = result.replace(/◆[A-Z]+_\d+◆/g, '');

  return result;
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
 */
export function reassembleWikitext(
  segments,
  translatedTexts,
  translatedLinks,
  translatedTemplates,
  translatedDisplayTexts,
  translatedParamTexts = {},
  translatedCategories = {}
) {
  const parts = [];

  for (const seg of segments) {
    switch (seg.type) {
      case 'text': {
        const text = translatedTexts[seg.content] ?? seg.content;
        parts.push(text);
        break;
      }

      case 'link': {
        const newTarget = translatedLinks[seg.target] ?? seg.target;
        if (seg.display) {
          const newDisplay = translatedDisplayTexts[seg.display] ?? seg.display;
          parts.push(`[[${newTarget}|${newDisplay}]]`);
        } else {
          // If link target changed, add piped link with translated display
          if (newTarget !== seg.target) {
            let display = translatedDisplayTexts[seg.target] ?? newTarget;
            const parenMatch = display.match(/^(.+?)\s*\([^)]+\)$/);
            if (parenMatch && parenMatch[1].trim()) {
              display = parenMatch[1].trim();
            }
            parts.push(`[[${newTarget}|${display}]]`);
          } else {
            // Pipe trick: auto-generate piped label for titles with disambiguation brackets
            const parenMatch = newTarget.match(/^(.+?)\s*\([^)]+\)$/);
            if (parenMatch && parenMatch[1].trim()) {
              parts.push(`[[${newTarget}|${parenMatch[1].trim()}]]`);
            } else {
              parts.push(`[[${newTarget}]]`);
            }
          }
        }
        break;
      }

      case 'template': {
        const inner = seg.content.slice(2, -2);
        const pipeIndex = inner.indexOf('|');
        if (pipeIndex === -1) {
          const name = inner.trim();
          const translatedName = translatedTemplates[name] ?? name;
          parts.push(`{{${translatedName}}}`);
        } else {
          const name = inner.slice(0, pipeIndex).trim();
          let params = inner.slice(pipeIndex); // includes leading |
          const translatedName = translatedTemplates[name] ?? name;

          // Translate text-heavy parameter values
          if (Object.keys(translatedParamTexts).length > 0) {
            for (const [original, translated] of Object.entries(translatedParamTexts)) {
              if (params.includes(original)) {
                params = params.replace(original, translated);
              }
            }
          }

          parts.push(`{{${translatedName}${params}}}`);
        }
        break;
      }

      // Category: translate target via Wikidata if resolved
      case 'category': {
        const newTarget = translatedCategories[seg.target] ?? seg.target;
        if (newTarget) {
          if (seg.display) {
            parts.push(`[[${newTarget}|${seg.display}]]`);
          } else {
            parts.push(`[[${newTarget}]]`);
          }
        } else {
          parts.push(seg.content);
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
 * Supports multi-line templates like Infoboxes with key-value parameters.
 *
 * @param {string} templateStr - E.g. "{{Infobox person | name = Albert | birth_date = 1879 }}"
 * @returns {Object} { name, params: [{ name, value, raw, isNamed, prefix, suffix }], isMultiLine }
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
    return {
      name: inner.trim(),
      params: [],
      isMultiLine,
      raw: trimmed,
    };
  }

  const name = inner.slice(0, pipeIdx).trim();
  const paramsStr = inner.slice(pipeIdx + 1);
  const rawParams = splitTemplateParams(paramsStr);

  const params = rawParams.map((rawParam, idx) => {
    const eqIdx = rawParam.indexOf('=');
    if (eqIdx !== -1) {
      const key = rawParam.slice(0, eqIdx).trim();
      const val = rawParam.slice(eqIdx + 1).trim();
      return {
        name: key,
        value: val,
        raw: rawParam,
        isNamed: true,
        index: idx,
      };
    } else {
      return {
        name: String(idx + 1),
        value: rawParam.trim(),
        raw: rawParam,
        isNamed: false,
        index: idx,
      };
    }
  });

  return {
    name,
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
  translatedParamNames = {}
) {
  const name = translatedName || parsedTemplate.name;

  if (!parsedTemplate.params || parsedTemplate.params.length === 0) {
    return `{{${name}}}`;
  }

  if (parsedTemplate.isMultiLine) {
    const lines = [`{{${name}`];
    for (const p of parsedTemplate.params) {
      const pName = translatedParamNames[p.name] || p.name;
      const pVal = translatedParamValues[p.value] ?? translatedParamValues[p.name] ?? p.value;
      if (p.isNamed) {
        lines.push(`| ${pName} = ${pVal}`);
      } else {
        lines.push(`| ${pVal}`);
      }
    }
    lines.push('}}');
    return lines.join('\n');
  } else {
    const paramParts = parsedTemplate.params.map(p => {
      const pName = translatedParamNames[p.name] || p.name;
      const pVal = translatedParamValues[p.value] ?? translatedParamValues[p.name] ?? p.value;
      return p.isNamed ? `${pName} = ${pVal}` : pVal;
    });
    return `{{${name} | ${paramParts.join(' | ')}}}`;
  }
}
