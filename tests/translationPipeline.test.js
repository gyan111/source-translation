import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { translateWikitext, translateTemplate } from '../server/services/translationPipeline.js';

vi.mock('axios');

describe('translationPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('translates full wikitext article preserving wikilinks and templates', async () => {
    // Mock Wikidata batch lookup
    axios.get.mockResolvedValueOnce({
      data: {
        entities: {
          Q2: { sitelinks: { enwiki: { title: 'Earth' }, frwiki: { title: 'Terre' } } },
        },
      },
    });

    // Mock Template Wikidata lookup
    axios.get.mockResolvedValueOnce({
      data: {
        entities: {
          Q100: { sitelinks: { enwiki: { title: 'Template:Note' }, frwiki: { title: 'Modèle:Remarque' } } },
        },
      },
    });

    // Mock translation service for text
    axios.post.mockResolvedValue({
      data: {
        translation: 'Le soleil brille sur la ',
      },
    });

    const wikitext = 'The sun shines on [[Earth]]. {{Note | text = Important message}}';
    const { translatedText, stats } = await translateWikitext(wikitext, 'en', 'fr', 'mint');

    expect(translatedText).toBeDefined();
    expect(stats.totalSegments).toBeGreaterThan(0);
    expect(stats.linksFound).toBe(1);
  });

  it('translates a standalone template with translateTemplate', async () => {
    // Mock Wikidata template name lookup
    axios.get.mockResolvedValueOnce({
      data: {
        entities: {
          Q1: { sitelinks: { enwiki: { title: 'Template:Infobox' }, frwiki: { title: 'Modèle:Infobox' } } },
        },
      },
    });

    // Mock translation service
    axios.post.mockResolvedValue({
      data: {
        translation: 'Physique',
      },
    });

    const template = '{{Infobox | field = Physics}}';
    const { translatedTemplate, stats } = await translateTemplate(template, 'en', 'fr', 'mint');

    expect(translatedTemplate).toContain('{{Infobox');
    expect(stats.paramsCount).toBe(1);
  });

  it('translates complex infobox with comments and headings without mangling', async () => {
    // Mock Wikidata template name lookup
    axios.get.mockResolvedValueOnce({
      data: {
        entities: {
          Q1: { sitelinks: { orwiki: { title: 'Template:Infobox settlement' }, pawiki: { title: 'Template:Infobox settlement' } } },
        },
      },
    });

    // Mock translation service
    axios.post.mockResolvedValue({
      data: {
        translation: 'ਕਾਲਾਬੁਦਾ',
      },
    });

    const wikitext = `{{Infobox settlement
<!-- See Template:Infobox settlement for additional fields and descriptions -->
|official_name = କଳାବୁଦା
|settlement_type = ଗ୍ରାମ
}}

== ଭୂଗୋଳ ==
ଏହି ଗ୍ରାମଟି ଏକ ସୁନ୍ଦର ଗ୍ରାମ।`;

    const { translatedText } = await translateWikitext(wikitext, 'or', 'pa', 'mint');

    expect(translatedText).toContain('{{Infobox settlement');
    expect(translatedText).toContain('<!-- See Template:Infobox settlement for additional fields and descriptions -->');
    expect(translatedText).toContain('==');
    expect(translatedText).not.toContain('= =');
  });
});
