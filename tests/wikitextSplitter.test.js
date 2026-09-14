import { describe, it, expect } from 'vitest';
import { splitWikitextIntoParagraphs } from '../src/utils/wikitextSplitter.js';

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
});
