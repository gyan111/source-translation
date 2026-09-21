import { describe, it, expect, vi, beforeEach } from 'vitest';
import publishRouter from '../server/routes/publish.js';
import * as oauthService from '../server/services/oauthService.js';

// Mock global fetch for Wikipedia APIs
const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock('../server/services/oauthService.js', () => ({
  validateOrRefreshToken: vi.fn(),
  refreshWikimediaToken: vi.fn(),
}));

function createMockReqRes({ session, body }) {
  const req = {
    method: 'POST',
    url: '/',
    session: session || null,
    body: body || {},
  };
  const res = {
    statusCode: 200,
    status: vi.fn(function (code) {
      this.statusCode = code;
      return this;
    }),
    json: vi.fn(function (data) {
      this.data = data;
      return this;
    }),
  };
  return { req, res };
}

function invokeRouter(req, res) {
  return new Promise((resolve) => {
    const originalJson = res.json;
    res.json = vi.fn(function (data) {
      originalJson.call(this, data);
      resolve();
      return this;
    });
    publishRouter.handle(req, res, (err) => {
      resolve();
    });
  });
}

describe('Publish Route (/publish)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when user is not logged in or session is expired', async () => {
    vi.mocked(oauthService.validateOrRefreshToken).mockResolvedValueOnce(null);

    const { req, res } = createMockReqRes({
      session: {},
      body: { text: 'Hello', language: 'en', title: 'Test' },
    });

    await invokeRouter(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ sessionExpired: true }));
  });

  it('handles anonymous CSRF token (+\\) by returning 401 sessionExpired and clearing session', async () => {
    vi.mocked(oauthService.validateOrRefreshToken).mockResolvedValueOnce('valid-token-at-start');
    vi.mocked(oauthService.refreshWikimediaToken).mockResolvedValueOnce(null);

    const mockSession = {
      user: {
        username: 'TestUser',
        accessToken: 'valid-token-at-start',
        refreshToken: 'invalid-refresh',
      },
      save: vi.fn((cb) => cb && cb()),
    };

    const { req, res } = createMockReqRes({
      session: mockSession,
      body: { text: 'Hello', language: 'en', title: 'Draft:Test' },
    });

    // Mock CSRF query returning anonymous token "+\\"
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        query: {
          tokens: {
            csrftoken: '+\\',
          },
        },
      }),
    });

    await invokeRouter(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ sessionExpired: true }));
    expect(mockSession.user).toBeUndefined();
  });

  it('successfully publishes article when CSRF token is valid', async () => {
    vi.mocked(oauthService.validateOrRefreshToken).mockResolvedValueOnce('valid-token');

    const mockSession = {
      user: {
        username: 'TestUser',
        accessToken: 'valid-token',
        expiresAt: Date.now() + 3600 * 1000,
      },
      save: vi.fn((cb) => cb && cb()),
    };

    const { req, res } = createMockReqRes({
      session: mockSession,
      body: {
        text: 'Article text',
        language: 'en',
        title: 'Draft:Test',
      },
    });

    // 1. Mock CSRF token response
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        query: {
          tokens: {
            csrftoken: 'valid-csrf-token123+\\',
          },
        },
      }),
    });

    // 2. Mock Edit response
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        edit: {
          result: 'Success',
          pageid: 12345,
          title: 'Draft:Test',
          newrevid: 99999,
        },
      }),
    });

    await invokeRouter(req, res);

    expect(res.status).not.toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('attempts token refresh when CSRF token is +\\ and succeeds on retry', async () => {
    vi.mocked(oauthService.validateOrRefreshToken).mockResolvedValueOnce('old-access-token');
    vi.mocked(oauthService.refreshWikimediaToken).mockResolvedValueOnce('new-refreshed-token');

    const mockSession = {
      user: {
        username: 'TestUser',
        accessToken: 'old-access-token',
        refreshToken: 'valid-refresh-token',
      },
      save: vi.fn((cb) => cb && cb()),
    };

    const { req, res } = createMockReqRes({
      session: mockSession,
      body: {
        text: 'Article text',
        language: 'en',
        title: 'Draft:Test',
      },
    });

    // 1. First CSRF query returns anonymous token +\\
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        query: {
          tokens: {
            csrftoken: '+\\',
          },
        },
      }),
    });

    // 2. Second CSRF query after refresh returns valid CSRF token
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        query: {
          tokens: {
            csrftoken: 'new-valid-csrf-token+\\',
          },
        },
      }),
    });

    // 3. Edit response
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        edit: {
          result: 'Success',
          pageid: 12345,
          title: 'Draft:Test',
        },
      }),
    });

    await invokeRouter(req, res);

    expect(oauthService.refreshWikimediaToken).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('passes section and sectiontitle parameters to MediaWiki edit API when publishing a section', async () => {
    vi.mocked(oauthService.validateOrRefreshToken).mockResolvedValueOnce('valid-token');

    const mockSession = {
      user: {
        username: 'TestUser',
        accessToken: 'valid-token',
        expiresAt: Date.now() + 3600 * 1000,
      },
      save: vi.fn((cb) => cb && cb()),
    };

    const { req, res } = createMockReqRes({
      session: mockSession,
      body: {
        text: 'Section text content',
        language: 'hi',
        title: 'Draft:Albert_Einstein',
        sourceTitle: 'Albert Einstein',
        sourceLanguage: 'en',
        section: 'new',
        sectiontitle: 'प्रारंभिक जीवन',
      },
    });

    // 1. Mock CSRF token response
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        query: {
          tokens: {
            csrftoken: 'valid-csrf-token+\\',
          },
        },
      }),
    });

    // 2. Mock Edit response
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        edit: {
          result: 'Success',
          pageid: 12345,
          title: 'Draft:Albert_Einstein',
          newrevid: 100001,
        },
      }),
    });

    await invokeRouter(req, res);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    // Inspect the POST parameters sent to MediaWiki edit endpoint
    const editCall = mockFetch.mock.calls[1];
    const bodyParams = editCall[1].body;
    expect(bodyParams.get('section')).toBe('new');
    expect(bodyParams.get('sectiontitle')).toBe('प्रारंभिक जीवन');
    expect(bodyParams.get('summary')).toContain('/* प्रारंभिक जीवन */');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('handles insert_after placement by fetching anchor section wikitext and splicing', async () => {
    vi.mocked(oauthService.validateOrRefreshToken).mockResolvedValueOnce('valid-token');

    const mockSession = {
      user: {
        username: 'TestUser',
        accessToken: 'valid-token',
        expiresAt: Date.now() + 3600 * 1000,
      },
      save: vi.fn((cb) => cb && cb()),
    };

    const { req, res } = createMockReqRes({
      session: mockSession,
      body: {
        text: 'This is the new section body.',
        language: 'en',
        title: 'Draft:Physics',
        publishMode: 'section',
        placementMode: 'insert_after',
        targetSectionIndex: '1',
        targetSectionTitle: 'Early History',
        sectiontitle: 'Modern Discoveries',
        sourceTitle: 'Physik',
        sourceLanguage: 'de',
      },
    });

    // 1. Mock CSRF token response
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        query: {
          tokens: {
            csrftoken: 'valid-csrf-token+\\',
          },
        },
      }),
    });

    // 2. Mock parse response for anchor section 1
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        parse: {
          title: 'Draft:Physics',
          pageid: 12345,
          wikitext: {
            '*': '== Early History ==\nAncient roots of physics.',
          },
        },
      }),
    });

    // 3. Mock Edit response
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        edit: {
          result: 'Success',
          pageid: 12345,
          title: 'Draft:Physics',
          newrevid: 100002,
        },
      }),
    });

    await invokeRouter(req, res);

    expect(mockFetch).toHaveBeenCalledTimes(3);

    // Verify parse call fetched section 1
    const parseCall = mockFetch.mock.calls[1];
    expect(parseCall[0]).toContain('action=parse');
    expect(parseCall[0]).toContain('section=1');

    // Verify edit call spliced the new section after section 1
    const editCall = mockFetch.mock.calls[2];
    const bodyParams = editCall[1].body;
    expect(bodyParams.get('section')).toBe('1');
    expect(bodyParams.get('text')).toBe('== Early History ==\nAncient roots of physics.\n\n== Modern Discoveries ==\nThis is the new section body.');
    expect(bodyParams.get('summary')).toContain('Inserted section after "Early History"');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('handles insert_before placement by mapping to anchor section K-1', async () => {
    vi.mocked(oauthService.validateOrRefreshToken).mockResolvedValueOnce('valid-token');

    const mockSession = {
      user: {
        username: 'TestUser',
        accessToken: 'valid-token',
        expiresAt: Date.now() + 3600 * 1000,
      },
      save: vi.fn((cb) => cb && cb()),
    };

    const { req, res } = createMockReqRes({
      session: mockSession,
      body: {
        text: '== Early Life ==\nBorn in Ulm.',
        language: 'en',
        title: 'Draft:Einstein',
        publishMode: 'section',
        placementMode: 'insert_before',
        targetSectionIndex: '2',
        targetSectionTitle: 'Career',
        sectiontitle: 'Early Life',
      },
    });

    // 1. CSRF token
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        query: { tokens: { csrftoken: 'valid-csrf-token+\\' } },
      }),
    });

    // 2. Mock parse response for anchor section 1 (since target is 2, anchor is 2 - 1 = 1)
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        parse: {
          title: 'Draft:Einstein',
          pageid: 12345,
          wikitext: {
            '*': '== Introduction ==\nLead intro text.',
          },
        },
      }),
    });

    // 3. Mock Edit response
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        edit: { result: 'Success', pageid: 12345, title: 'Draft:Einstein', newrevid: 100003 },
      }),
    });

    await invokeRouter(req, res);

    expect(mockFetch).toHaveBeenCalledTimes(3);
    const parseCall = mockFetch.mock.calls[1];
    expect(parseCall[0]).toContain('section=1');

    const editCall = mockFetch.mock.calls[2];
    const bodyParams = editCall[1].body;
    expect(bodyParams.get('section')).toBe('1');
    expect(bodyParams.get('text')).toBe('== Introduction ==\nLead intro text.\n\n== Early Life ==\nBorn in Ulm.');
    expect(bodyParams.get('summary')).toContain('Inserted section before "Career"');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('handles replace placement by overwriting target section directly', async () => {
    vi.mocked(oauthService.validateOrRefreshToken).mockResolvedValueOnce('valid-token');

    const mockSession = {
      user: {
        username: 'TestUser',
        accessToken: 'valid-token',
        expiresAt: Date.now() + 3600 * 1000,
      },
      save: vi.fn((cb) => cb && cb()),
    };

    const { req, res } = createMockReqRes({
      session: mockSession,
      body: {
        text: 'Completely revised legacy content.',
        language: 'en',
        title: 'Draft:Einstein',
        publishMode: 'section',
        placementMode: 'replace',
        targetSectionIndex: '3',
        targetSectionTitle: 'Legacy',
        sectiontitle: 'Legacy',
      },
    });

    // 1. CSRF token
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        query: { tokens: { csrftoken: 'valid-csrf-token+\\' } },
      }),
    });

    // 2. Edit response
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        edit: { result: 'Success', pageid: 12345, title: 'Draft:Einstein', newrevid: 100004 },
      }),
    });

    await invokeRouter(req, res);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const editCall = mockFetch.mock.calls[1];
    const bodyParams = editCall[1].body;
    expect(bodyParams.get('section')).toBe('3');
    expect(bodyParams.get('text')).toBe('== Legacy ==\nCompletely revised legacy content.');
    expect(bodyParams.get('summary')).toContain('Replaced section "Legacy"');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('handles append_bottom placement by stripping redundant heading from text', async () => {
    vi.mocked(oauthService.validateOrRefreshToken).mockResolvedValueOnce('valid-token');

    const mockSession = {
      user: {
        username: 'TestUser',
        accessToken: 'valid-token',
        expiresAt: Date.now() + 3600 * 1000,
      },
      save: vi.fn((cb) => cb && cb()),
    };

    const { req, res } = createMockReqRes({
      session: mockSession,
      body: {
        text: '== Publications ==\nList of publications.',
        language: 'en',
        title: 'Draft:Einstein',
        publishMode: 'section',
        placementMode: 'append_bottom',
        sectiontitle: 'Publications',
      },
    });

    // 1. CSRF token
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        query: { tokens: { csrftoken: 'valid-csrf-token+\\' } },
      }),
    });

    // 2. Edit response
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        edit: { result: 'Success', pageid: 12345, title: 'Draft:Einstein', newrevid: 100005 },
      }),
    });

    await invokeRouter(req, res);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const editCall = mockFetch.mock.calls[1];
    const bodyParams = editCall[1].body;
    expect(bodyParams.get('section')).toBe('new');
    expect(bodyParams.get('sectiontitle')).toBe('Publications');
    expect(bodyParams.get('text')).toBe('List of publications.');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('allows unverified users to publish sections directly to existing Mainspace articles when review is confirmed', async () => {
    vi.mocked(oauthService.validateOrRefreshToken).mockResolvedValueOnce('valid-token');

    const mockSession = {
      user: {
        username: 'UnverifiedUser123',
        accessToken: 'valid-token',
        expiresAt: Date.now() + 3600 * 1000,
      },
      save: vi.fn((cb) => cb && cb()),
    };

    const { req, res } = createMockReqRes({
      session: mockSession,
      body: {
        text: 'New section content',
        language: 'en',
        title: 'Physics',
        publishMode: 'section',
        placementMode: 'append_bottom',
        sectiontitle: 'Discoveries',
        userAcknowledgedReview: true,
      },
    });

    // 1. Mock page existence check returning page exists
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        query: {
          pages: {
            '100': { pageid: 100, title: 'Physics' },
          },
        },
      }),
    });

    // 2. Mock CSRF token
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        query: { tokens: { csrftoken: 'valid-csrf-token+\\' } },
      }),
    });

    // 3. Mock Edit response
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        edit: { result: 'Success', pageid: 100, title: 'Physics', newrevid: 100006 },
      }),
    });

    await invokeRouter(req, res);

    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('rejects unverified users trying to publish sections to Mainspace without userAcknowledgedReview', async () => {
    vi.mocked(oauthService.validateOrRefreshToken).mockResolvedValueOnce('valid-token');

    const mockSession = {
      user: {
        username: 'UnverifiedUser123',
        accessToken: 'valid-token',
        expiresAt: Date.now() + 3600 * 1000,
      },
      save: vi.fn((cb) => cb && cb()),
    };

    const { req, res } = createMockReqRes({
      session: mockSession,
      body: {
        text: 'New section content',
        language: 'en',
        title: 'Physics',
        publishMode: 'section',
        placementMode: 'append_bottom',
        sectiontitle: 'Discoveries',
        userAcknowledgedReview: false,
      },
    });

    await invokeRouter(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Review Confirmation Required' }));
  });

  it('rejects unverified users trying to publish sections to non-existent Mainspace articles', async () => {
    vi.mocked(oauthService.validateOrRefreshToken).mockResolvedValueOnce('valid-token');

    const mockSession = {
      user: {
        username: 'UnverifiedUser123',
        accessToken: 'valid-token',
        expiresAt: Date.now() + 3600 * 1000,
      },
      save: vi.fn((cb) => cb && cb()),
    };

    const { req, res } = createMockReqRes({
      session: mockSession,
      body: {
        text: 'New section content',
        language: 'en',
        title: 'Brand_New_Article_12345',
        publishMode: 'section',
        placementMode: 'append_bottom',
        sectiontitle: 'Intro',
        userAcknowledgedReview: true,
      },
    });

    // Mock page check returning missing page
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        query: {
          pages: {
            '-1': { missing: '' },
          },
        },
      }),
    });

    await invokeRouter(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Mainspace Creation Restricted' }));
  });
});
