import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { refreshWikimediaToken, validateOrRefreshToken, getOAuthConfig } from '../server/services/oauthService.js';

vi.mock('axios');

describe('oauthService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      WIKI_CLIENT_ID: 'test-client-id',
      WIKI_CLIENT_SECRET: 'test-client-secret',
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('refreshWikimediaToken', () => {
    it('returns null if sessionUser is missing or has no refreshToken', async () => {
      expect(await refreshWikimediaToken(null)).toBeNull();
      expect(await refreshWikimediaToken({})).toBeNull();
      expect(await refreshWikimediaToken({ accessToken: 'xyz' })).toBeNull();
    });

    it('refreshes token successfully and updates sessionUser', async () => {
      const sessionUser = {
        username: 'TestUser',
        accessToken: 'old-access-token',
        refreshToken: 'valid-refresh-token',
      };

      axios.post.mockResolvedValueOnce({
        data: {
          access_token: 'new-access-token',
          refresh_token: 'rotated-refresh-token',
          expires_in: 7200,
        },
      });

      const result = await refreshWikimediaToken(sessionUser);

      expect(result).toBe('new-access-token');
      expect(sessionUser.accessToken).toBe('new-access-token');
      expect(sessionUser.refreshToken).toBe('rotated-refresh-token');
      expect(sessionUser.expiresAt).toBeGreaterThan(Date.now());
      expect(axios.post).toHaveBeenCalledTimes(1);
    });

    it('handles refresh failure gracefully', async () => {
      const sessionUser = {
        accessToken: 'old-access-token',
        refreshToken: 'invalid-refresh-token',
      };

      axios.post.mockRejectedValueOnce(new Error('Invalid grant'));

      const result = await refreshWikimediaToken(sessionUser);
      expect(result).toBeNull();
    });
  });

  describe('validateOrRefreshToken', () => {
    it('returns null if no active session or user exists', async () => {
      expect(await validateOrRefreshToken({})).toBeNull();
      expect(await validateOrRefreshToken({ session: {} })).toBeNull();
      expect(await validateOrRefreshToken({ session: { user: {} } })).toBeNull();
    });

    it('returns current token if it is unexpired', async () => {
      const req = {
        session: {
          user: {
            accessToken: 'valid-token',
            expiresAt: Date.now() + 3600 * 1000,
          },
          save: vi.fn((cb) => cb && cb()),
        },
      };

      const result = await validateOrRefreshToken(req);
      expect(result).toBe('valid-token');
      expect(axios.get).not.toHaveBeenCalled();
      expect(axios.post).not.toHaveBeenCalled();
    });

    it('refreshes token if it is expired and refresh token is available', async () => {
      const req = {
        session: {
          user: {
            accessToken: 'expired-token',
            refreshToken: 'my-refresh-token',
            expiresAt: Date.now() - 1000, // expired in the past
          },
          save: vi.fn((cb) => cb && cb()),
        },
      };

      axios.post.mockResolvedValueOnce({
        data: {
          access_token: 'fresh-token',
          expires_in: 3600,
        },
      });

      const result = await validateOrRefreshToken(req);
      expect(result).toBe('fresh-token');
      expect(req.session.user.accessToken).toBe('fresh-token');
      expect(req.session.save).toHaveBeenCalled();
    });

    it('clears session and returns null if token is expired and no refresh token exists', async () => {
      const req = {
        session: {
          user: {
            accessToken: 'expired-token',
            expiresAt: Date.now() - 5000,
          },
          save: vi.fn((cb) => cb && cb()),
        },
      };

      const result = await validateOrRefreshToken(req);
      expect(result).toBeNull();
      expect(req.session.user).toBeUndefined();
      expect(req.session.save).toHaveBeenCalled();
    });

    it('validates legacy session without expiresAt and assigns expiry if profile succeeds', async () => {
      const req = {
        session: {
          user: {
            accessToken: 'legacy-token',
          },
          save: vi.fn((cb) => cb && cb()),
        },
      };

      axios.get.mockResolvedValueOnce({ data: { sub: '123', username: 'Test' } });

      const result = await validateOrRefreshToken(req);
      expect(result).toBe('legacy-token');
      expect(req.session.user.expiresAt).toBeGreaterThan(Date.now());
      expect(req.session.save).toHaveBeenCalled();
    });

    it('clears legacy session if profile returns 401 Unauthorized', async () => {
      const req = {
        session: {
          user: {
            accessToken: 'dead-token',
          },
          save: vi.fn((cb) => cb && cb()),
        },
      };

      axios.get.mockRejectedValueOnce({
        response: { status: 401 },
      });

      const result = await validateOrRefreshToken(req);
      expect(result).toBeNull();
      expect(req.session.user).toBeUndefined();
      expect(req.session.save).toHaveBeenCalled();
    });
  });
});
