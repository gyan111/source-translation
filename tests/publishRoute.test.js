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
});
