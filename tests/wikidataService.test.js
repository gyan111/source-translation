import { describe, it, expect, vi } from 'vitest';
import axios from 'axios';
import {
  translateTitlesViaWikidata,
  translateTemplateNames,
  translateCategories,
} from '../server/services/wikidataService.js';

vi.mock('axios');

describe('wikidataService', () => {
  it('returns identity map when fromLang equals toLang', async () => {
    const titles = ['Earth', 'Moon', 'Sun'];
    const result = await translateTitlesViaWikidata(titles, 'en', 'en');
    expect(result).toEqual({ Earth: 'Earth', Moon: 'Moon', Sun: 'Sun' });
  });

  it('fetches sitelinks from Wikidata API and maps titles', async () => {
    const titles = ['Earth', 'Sun'];
    const mockResponse = {
      data: {
        entities: {
          Q2: {
            sitelinks: {
              enwiki: { title: 'Earth' },
              frwiki: { title: 'Terre' },
            },
          },
          Q525: {
            sitelinks: {
              enwiki: { title: 'Sun' },
              frwiki: { title: 'Soleil' },
            },
          },
        },
      },
    };

    axios.get.mockResolvedValueOnce(mockResponse);

    const result = await translateTitlesViaWikidata(titles, 'en', 'fr');
    expect(result).toEqual({ Earth: 'Terre', Sun: 'Soleil' });
  });

  it('handles templates and strips Template: namespace prefix', async () => {
    const templates = ['Infobox person'];
    const mockResponse = {
      data: {
        entities: {
          Q123: {
            sitelinks: {
              enwiki: { title: 'Template:Infobox person' },
              frwiki: { title: 'Modèle:Infobox Biographie' },
            },
          },
        },
      },
    };

    axios.get.mockResolvedValueOnce(mockResponse);

    const result = await translateTemplateNames(templates, 'en', 'fr');
    expect(result['Infobox person']).toBe('Infobox Biographie');
  });

  it('handles category title translation', async () => {
    const categories = ['Category:Physics'];
    const mockResponse = {
      data: {
        entities: {
          Q413: {
            sitelinks: {
              enwiki: { title: 'Category:Physics' },
              frwiki: { title: 'Catégorie:Physique' },
            },
          },
        },
      },
    };

    axios.get.mockResolvedValueOnce(mockResponse);

    const result = await translateCategories(categories, 'en', 'fr');
    expect(result['Category:Physics']).toBe('Catégorie:Physique');
  });
});
