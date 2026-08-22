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

  it('translates complex infobox settlement template via translateTemplate', async () => {
    // Mock Wikidata link titles
    axios.get.mockResolvedValueOnce({
      data: {
        entities: {
          Q1: { sitelinks: { orwiki: { title: 'ଓଡ଼ିଶା' }, enwiki: { title: 'Odisha' } } },
        },
      },
    });

    // Mock Wikidata template names
    axios.get.mockResolvedValueOnce({
      data: {
        entities: {
          Q2: { sitelinks: { orwiki: { title: 'Template:Infobox settlement' }, enwiki: { title: 'Template:Infobox settlement' } } },
        },
      },
    });

    // Mock text translation service
    axios.post.mockResolvedValue({
      data: {
        translation: 'Kendrapara',
      },
    });

    const template = `{{Infobox settlement
| name = କେନ୍ଦ୍ରାପଡ଼ା
| native_name_lang = or
| settlement_type = ସହର
| latd = 20.50
| latNS = N
| subdivision_name1 = [[ଓଡ଼ିଶା]]
| established_title = <!-- Established -->
| established_date = ୧୦ ମାର୍ଚ୍ଚ ୧୮୬୯
| elevation_m = ୧୩
| population_as_of = ୨୦୦୧
| utc_offset1 = +୫:୩୦
| area_code = ୯୧-୬୭୨୭
}}`;

    const { translatedTemplate, stats } = await translateTemplate(template, 'or', 'en', 'mint');

    expect(translatedTemplate).toBeDefined();
    expect(translatedTemplate).toContain('{{Infobox settlement');
    expect(translatedTemplate).toContain('| native_name_lang = or');
    expect(translatedTemplate).toContain('| latd = 20.50');
    expect(translatedTemplate).toContain('| latNS = N');
    expect(translatedTemplate).toContain('| subdivision_name1 = [[Odisha]]');
    expect(translatedTemplate).toContain('| established_title = <!-- Established -->');
    expect(translatedTemplate).toContain('| elevation_m = 13');
    expect(translatedTemplate).toContain('| population_as_of = 2001');
    expect(translatedTemplate).toContain('| utc_offset1 = +5:30');
    expect(translatedTemplate).toContain('| area_code = 91-6727');
    expect(stats.errors).toEqual([]);
  });
});


