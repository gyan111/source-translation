/**
 * Splits Wikipedia wikitext into translation paragraphs/sections.
 * Uses template depth tracking to prevent slicing multi-line templates with nested sub-templates
 * (such as Infoboxes with {{Plainlist}}, {{based on}}, {{Film date}}, etc.).
 *
 * @param {string} wikitext - Raw wikitext from MediaWiki API
 * @returns {string[]} Array of section/paragraph strings
 */
export function splitWikitextIntoParagraphs(wikitext) {
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
  const paragraphs = [];
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
          paragraphs.push(sectionText);
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
      paragraphs.push(sectionText);
    }
  }

  return paragraphs;
}
