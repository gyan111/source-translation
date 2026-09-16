import { describe, it, expect, vi } from 'vitest';
import axios from 'axios';
import { preview, services } from '../server/controllers/translationController.js';

vi.mock('axios');

describe('translationController', () => {
  describe('preview', () => {
    it('returns 400 when text or language is missing', async () => {
      const req = { body: { text: '' } };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await preview(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Missing required fields' }));
    });

    it('successfully calls MediaWiki API via POST and returns rendered html', async () => {
      const mockHtml = '<p>Rendered article HTML content</p>';
      axios.post.mockResolvedValueOnce({
        data: {
          parse: {
            text: {
              '*': mockHtml,
            },
          },
        },
      });

      const req = {
        body: {
          text: '== Heading ==\nThis is a long test article content for preview.',
          language: 'hi',
        },
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await preview(req, res);

      expect(axios.post).toHaveBeenCalledWith(
        'https://hi.wikipedia.org/w/api.php',
        expect.stringContaining('action=parse'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );
      expect(res.json).toHaveBeenCalledWith({ html: mockHtml });
    });

    it('successfully renders standalone template wikitext via MediaWiki API', async () => {
      const mockInfoboxHtml = '<table class="infobox"><tr><th>Albert Einstein</th></tr></table>';
      axios.post.mockResolvedValueOnce({
        data: {
          parse: {
            text: {
              '*': mockInfoboxHtml,
            },
          },
        },
      });

      const req = {
        body: {
          text: '{{Infobox person | name = Albert Einstein }}',
          language: 'en',
        },
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await preview(req, res);

      expect(axios.post).toHaveBeenCalledWith(
        'https://en.wikipedia.org/w/api.php',
        expect.stringContaining('contentmodel=wikitext'),
        expect.any(Object)
      );
      expect(res.json).toHaveBeenCalledWith({ html: mockInfoboxHtml });
    });

    it('returns default placeholder html when MediaWiki returns empty text', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          parse: {},
        },
      });

      const req = {
        body: {
          text: ' ',
          language: 'sat',
        },
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await preview(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        html: expect.stringContaining('No content rendered'),
      }));
    });

    it('handles MediaWiki API errors gracefully', async () => {
      axios.post.mockRejectedValueOnce(new Error('Network Error'));

      const req = {
        body: {
          text: 'Sample text',
          language: 'en',
        },
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await preview(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Preview generation failed' }));
    });
  });

  describe('services', () => {
    it('returns list of available translation services', () => {
      const req = {};
      const res = {
        json: vi.fn(),
      };

      services(req, res);
      expect(res.json).toHaveBeenCalled();
      const returnedServices = res.json.mock.calls[0][0];
      expect(Array.isArray(returnedServices)).toBe(true);
      expect(returnedServices.some(s => s.id === 'mint')).toBe(true);
      expect(returnedServices.some(s => s.id === 'deepl')).toBe(true);
      expect(returnedServices.some(s => s.id === 'openai')).toBe(true);
    });
  });
});
