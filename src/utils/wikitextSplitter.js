/**
 * Splits Wikipedia wikitext into structured section paragraphs.
 * Tracks section headings, section titles, and template depths.
 *
 * @param {string} wikitext - Raw wikitext from MediaWiki API
 * @returns {Array<{ source: string, sectionIndex: number, sectionTitle: string, sectionLevel: number, isHeading: boolean }>}
 */
export function splitWikitextWithSections(wikitext) {
  if (!wikitext || typeof wikitext !== 'string') {
    return [];
  }

  // Phase 1: Protect HTML comments <!-- ... --> so {{ or }} inside comments don't affect depth
  const comments = [];
  const sanitized = wikitext.replace(/<!--[\s\S]*?-->/g, (m) => {
    comments.push(m);
    return `\x00COMMENT_${comments.length - 1}\x00`;
  });

  const lines = sanitized.split('\n');
  const rawParagraphs = [];
  let currentBuffer = [];
  let templateDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track template depth changes across the line (respecting <nowiki> tags)
    let inNowiki = false;
    for (let j = 0; j < line.length - 1; j++) {
      if (line.substr(j, 8).toLowerCase() === '<nowiki>') {
        inNowiki = true;
        j += 7;
        continue;
      }
      if (line.substr(j, 9).toLowerCase() === '</nowiki>') {
        inNowiki = false;
        j += 8;
        continue;
      }
      if (!inNowiki) {
        if (line[j] === '{' && line[j + 1] === '{') {
          templateDepth++;
          j++;
        } else if (line[j] === '}' && line[j + 1] === '}') {
          if (templateDepth > 0) templateDepth--;
          j++;
        }
      }
    }

    currentBuffer.push(line);

    // Can we split here?
    // We only split when templateDepth === 0 (all templates are fully closed)
    if (templateDepth === 0) {
      const nextLine = i < lines.length - 1 ? lines[i + 1] : null;
      const currentTrimmed = line.trim();
      const nextTrimmed = nextLine ? nextLine.trim() : '';

      const isHeading = /^={2,}[^=]+={2,}$/.test(currentTrimmed);
      const nextIsHeading = /^={2,}[^=]+={2,}$/.test(nextTrimmed);
      // Multi-line template closed (e.g. Infobox closing }}) followed directly by text or template
      const justClosedMultiLineTemplate = currentTrimmed.endsWith('}}') && currentBuffer.length > 3;
      const nextIsEmpty = nextTrimmed === '';

      if (i === lines.length - 1 || nextIsEmpty || isHeading || nextIsHeading || justClosedMultiLineTemplate) {
        let sectionText = currentBuffer.join('\n').trim();
        if (sectionText) {
          // Restore comments
          sectionText = sectionText.replace(/\x00COMMENT_(\d+)\x00/g, (_, idx) => comments[idx]);
          rawParagraphs.push(sectionText);
        }
        currentBuffer = [];
        // Skip subsequent blank lines
        while (i + 1 < lines.length && lines[i + 1].trim() === '') {
          i++;
        }
      }
    }
  }

  if (currentBuffer.length > 0) {
    let sectionText = currentBuffer.join('\n').trim();
    if (sectionText) {
      sectionText = sectionText.replace(/\x00COMMENT_(\d+)\x00/g, (_, idx) => comments[idx]);
      rawParagraphs.push(sectionText);
    }
  }

  // Phase 2: Assign section indices and titles based on headings
  let currentSectionIndex = 0;
  let currentSectionTitle = 'Lead Section';
  let currentSectionLevel = 2;

  const result = [];
  for (const pText of rawParagraphs) {
    const headingMatch = pText.match(/^(={2,6})\s*([^=]+?)\s*\1$/);
    if (headingMatch) {
      // If we encounter a heading and already have content, advance sectionIndex
      currentSectionIndex++;
      currentSectionLevel = headingMatch[1].length;
      currentSectionTitle = headingMatch[2].trim();
      result.push({
        source: pText,
        sectionIndex: currentSectionIndex,
        sectionTitle: currentSectionTitle,
        sectionLevel: currentSectionLevel,
        isHeading: true,
      });
    } else {
      result.push({
        source: pText,
        sectionIndex: currentSectionIndex,
        sectionTitle: currentSectionTitle,
        sectionLevel: currentSectionLevel,
        isHeading: false,
      });
    }
  }

  return result;
}

/**
 * Splits Wikipedia wikitext into translation paragraphs/sections as strings (backward compatible).
 *
 * @param {string} wikitext - Raw wikitext from MediaWiki API
 * @returns {string[]} Array of section/paragraph strings
 */
export function splitWikitextIntoParagraphs(wikitext) {
  return splitWikitextWithSections(wikitext).map(p => p.source);
}

/**
 * Extracts unique sections summary from wikitext.
 *
 * @param {string} wikitext - Raw wikitext
 * @returns {Array<{ index: number, title: string, level: number, isLead: boolean, paragraphCount: number }>}
 */
export function extractSectionsFromWikitext(wikitext) {
  const parsedParagraphs = splitWikitextWithSections(wikitext);
  if (parsedParagraphs.length === 0) return [];

  const sectionsMap = new Map();
  for (const p of parsedParagraphs) {
    if (!sectionsMap.has(p.sectionIndex)) {
      sectionsMap.set(p.sectionIndex, {
        index: p.sectionIndex,
        title: p.sectionTitle,
        level: p.sectionLevel,
        isLead: p.sectionIndex === 0,
        paragraphCount: 0,
      });
    }
    sectionsMap.get(p.sectionIndex).paragraphCount++;
  }

  return Array.from(sectionsMap.values());
}

/**
 * Resolves orphan references in an isolated section wikitext.
 * If a section contains a self-closing reference <ref name="xyz" /> or <ref name="xyz"></ref>
 * whose definition <ref name="xyz">...</ref> is not inside the section,
 * but exists in fullArticleWikitext, this inlines the full definition into the first
 * occurrence within the section so MediaWiki does not throw a Cite error.
 *
 * @param {string} sectionWikitext - Wikitext of the isolated section
 * @param {string} fullArticleWikitext - Wikitext of the entire source article
 * @returns {string} Section wikitext with orphan references resolved
 */
export function resolveOrphanReferences(sectionWikitext, fullArticleWikitext) {
  if (!sectionWikitext || typeof sectionWikitext !== 'string') return sectionWikitext || '';
  if (!fullArticleWikitext || typeof fullArticleWikitext !== 'string') return sectionWikitext;

  // 1. Find all full reference definitions in fullArticleWikitext: <ref name="..." ...>content</ref>
  const fullRefRegex = /<ref(?:\s+[^>]*)?\s+name=(?:"([^"]+)"|'([^']+)'|([^\s\/>]+))([^>]*)>([\s\S]*?)<\/ref>/gi;
  const definitions = new Map();
  let match;
  while ((match = fullRefRegex.exec(fullArticleWikitext)) !== null) {
    const name = match[1] || match[2] || match[3];
    const content = match[5] || '';
    if (content.trim()) {
      definitions.set(name, {
        fullTag: match[0],
        name,
        content,
      });
    }
  }

  // 2. Find all full definitions already inside sectionWikitext so we don't duplicate
  const localDefinitions = new Set();
  const localRefRegex = /<ref(?:\s+[^>]*)?\s+name=(?:"([^"]+)"|'([^']+)'|([^\s\/>]+))([^>]*)>([\s\S]*?)<\/ref>/gi;
  while ((match = localRefRegex.exec(sectionWikitext)) !== null) {
    const name = match[1] || match[2] || match[3];
    if (match[5] && match[5].trim()) {
      localDefinitions.add(name);
    }
  }

  // 3. Find self-closing or empty refs in sectionWikitext: <ref name="..." /> or <ref name="..."></ref>
  // and replace the FIRST occurrence with the full definition if missing locally but present in definitions
  const resolvedNames = new Set();
  const orphanRefRegex = /<ref(?:\s+[^>]*)?\s+name=(?:"([^"]+)"|'([^']+)'|([^\s\/>]+))([^>]*)(?:\/>|>\s*<\/ref>)/gi;

  const resolvedWikitext = sectionWikitext.replace(orphanRefRegex, (fullMatch, n1, n2, n3) => {
    const name = n1 || n2 || n3;
    if (!localDefinitions.has(name) && !resolvedNames.has(name) && definitions.has(name)) {
      resolvedNames.add(name);
      return definitions.get(name).fullTag;
    }
    return fullMatch;
  });

  return resolvedWikitext;
}

