import { describe, it, expect } from 'vitest';
import {
  splitWikitextIntoParagraphs,
  splitWikitextWithSections,
  extractSectionsFromWikitext,
  resolveOrphanReferences,
} from '../src/utils/wikitextSplitter.js';

describe('wikitextSplitter', () => {
  it('does not split Infobox with nested sub-templates like Plainlist', () => {
    const wikitext = `{{Use mdy dates|date=February 2026}}
{{Infobox film
| name           = A Single Shot
| image          = ASingleShotPoster.png
| director       = [[David M. Rosenthal]]
| producer       = {{Plainlist|
*[[Aaron L. Gilbert]]
*Chris Coen
}}
| screenplay     = [[Matthew F. Jones]]
| starring       = {{Plainlist|
*[[Sam Rockwell]]
*[[Jeffrey Wright]]
}}
| music          = [[Atli Örvarsson]]
}}
'''''A Single Shot''''' is a 2013 American film.`;

    const sections = splitWikitextIntoParagraphs(wikitext);
    expect(sections.length).toBe(2);

    // Section 0 should be the entire Infobox including all subtemplates
    expect(sections[0]).toContain('{{Infobox film');
    expect(sections[0]).toContain('| screenplay     = [[Matthew F. Jones]]');
    expect(sections[0]).toContain('| music          = [[Atli Örvarsson]]');
    expect(sections[0]).toContain('*[[Aaron L. Gilbert]]');
    expect(sections[0]).toContain('*[[Sam Rockwell]]');
    expect(sections[0].endsWith('}}')).toBe(true);

    // Section 1 should be the lead prose paragraph
    expect(sections[1]).toBe("'''''A Single Shot''''' is a 2013 American film.");
  });

  it('separates headings and prose cleanly', () => {
    const wikitext = `First paragraph of the article.

== Plot ==
The plot begins here.

Another paragraph of plot.

== Cast ==
* Actor 1 as Character 1`;

    const sections = splitWikitextIntoParagraphs(wikitext);
    expect(sections.length).toBe(6);
    expect(sections[0]).toBe('First paragraph of the article.');
    expect(sections[1]).toBe('== Plot ==');
    expect(sections[2]).toBe('The plot begins here.');
    expect(sections[3]).toBe('Another paragraph of plot.');
    expect(sections[4]).toBe('== Cast ==');
    expect(sections[5]).toBe('* Actor 1 as Character 1');
  });

  it('ignores template braces inside HTML comments and nowiki tags', () => {
    const wikitext = `{{Infobox person
| name = Example
<!-- {{Commented template | foo = bar}} -->
| note = <nowiki>{{literal braces}}</nowiki>
}}
Lead sentence following infobox.`;

    const sections = splitWikitextIntoParagraphs(wikitext);
    expect(sections.length).toBe(2);
    expect(sections[0]).toContain('<!-- {{Commented template | foo = bar}} -->');
    expect(sections[0]).toContain('<nowiki>{{literal braces}}</nowiki>');
    expect(sections[1]).toBe('Lead sentence following infobox.');
  });

  it('handles empty or non-string input safely', () => {
    expect(splitWikitextIntoParagraphs('')).toEqual([]);
    expect(splitWikitextIntoParagraphs(null)).toEqual([]);
    expect(splitWikitextIntoParagraphs(undefined)).toEqual([]);
  });

  it('correctly attributes section indices and titles with splitWikitextWithSections', () => {
    const wikitext = `Lead paragraph text.

== Early Life ==
Born in Germany.

Attended school in Munich.

=== University ===
Studied physics in Zurich.

== Career ==
Worked at patent office.`;

    const paras = splitWikitextWithSections(wikitext);
    expect(paras.length).toBe(8);

    // Lead paragraph
    expect(paras[0].sectionIndex).toBe(0);
    expect(paras[0].sectionTitle).toBe('Lead Section');
    expect(paras[0].isHeading).toBe(false);

    // Early Life heading
    expect(paras[1].sectionIndex).toBe(1);
    expect(paras[1].sectionTitle).toBe('Early Life');
    expect(paras[1].sectionLevel).toBe(2);
    expect(paras[1].isHeading).toBe(true);

    // Early Life paragraphs
    expect(paras[2].sectionIndex).toBe(1);
    expect(paras[2].sectionTitle).toBe('Early Life');
    expect(paras[2].source).toBe('Born in Germany.');
    expect(paras[3].sectionIndex).toBe(1);

    // University subheading
    expect(paras[4].sectionIndex).toBe(2);
    expect(paras[4].sectionTitle).toBe('University');
    expect(paras[4].sectionLevel).toBe(3);
    expect(paras[4].isHeading).toBe(true);

    // University paragraph
    expect(paras[5].sectionIndex).toBe(2);
    expect(paras[5].sectionTitle).toBe('University');

    // Career heading
    expect(paras[6].sectionIndex).toBe(3);
    expect(paras[6].sectionTitle).toBe('Career');
    expect(paras[6].isHeading).toBe(true);

    // Career paragraph
    expect(paras[7].sectionIndex).toBe(3);
    expect(paras[7].sectionTitle).toBe('Career');
  });

  it('extracts unique section summaries with extractSectionsFromWikitext', () => {
    const wikitext = `Lead text.

== Early Life ==
Born in Germany.

== Career ==
Patent clerk.

Nobel prize.`;

    const sections = extractSectionsFromWikitext(wikitext);
    expect(sections).toHaveLength(3);

    expect(sections[0].index).toBe(0);
    expect(sections[0].title).toBe('Lead Section');
    expect(sections[0].isLead).toBe(true);
    expect(sections[0].paragraphCount).toBe(1);

    expect(sections[1].index).toBe(1);
    expect(sections[1].title).toBe('Early Life');
    expect(sections[1].isLead).toBe(false);
    expect(sections[1].paragraphCount).toBe(2); // Heading + 1 prose

    expect(sections[2].index).toBe(2);
    expect(sections[2].title).toBe('Career');
    expect(sections[2].paragraphCount).toBe(3); // Heading + 2 prose
  });

  it('inlines orphan references defined elsewhere in the full article wikitext', () => {
    const fullArticle = `== Early Life ==
Albert was born in Ulm.<ref name="einstein_bio">Smith, John. The Life of Einstein, 1990.</ref>

== Career ==
He developed relativity.<ref name="einstein_bio"/>
He won the Nobel Prize.<ref name="einstein_bio"/>`;

    const sectionWikitext = `== Career ==
He developed relativity.<ref name="einstein_bio"/>
He won the Nobel Prize.<ref name="einstein_bio"/>`;

    const resolved = resolveOrphanReferences(sectionWikitext, fullArticle);

    // The first orphan occurrence should now contain the full definition
    expect(resolved).toContain('<ref name="einstein_bio">Smith, John. The Life of Einstein, 1990.</ref>');
    // The second occurrence should remain self-closing
    expect(resolved).toMatch(/Nobel Prize\.<ref name="einstein_bio"\s*\/>/);
  });
});
