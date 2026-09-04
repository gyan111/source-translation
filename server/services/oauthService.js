import axios from 'axios';

export const getOAuthConfig = () => ({
  clientId: process.env.WIKI_CLIENT_ID || process.env.OAUTH_CONSUMER_KEY || '',
  clientSecret: process.env.WIKI_CLIENT_SECRET || process.env.OAUTH_CONSUMER_SECRET || '',
  authorizationUrl: 'https://meta.wikimedia.org/w/rest.php/oauth2/authorize',
  tokenUrl: 'https://meta.wikimedia.org/w/rest.php/oauth2/access_token',
  profileUrl: 'https://meta.wikimedia.org/w/rest.php/oauth2/resource/profile',
  callbackUrl: process.env.WIKI_CALLBACK_URL || process.env.OAUTH_CALLBACK_URL || 'http://localhost:8000/callback',
});

/**
 * Attempts to refresh an expired access token using the stored refresh_token.
 * @param {Object} sessionUser - req.session.user object
 * @returns {Promise<string|null>} New access token or null if refresh failed
 */
export async function refreshWikimediaToken(sessionUser) {
  if (!sessionUser || !sessionUser.refreshToken) {
    return null;
  }

  const config = getOAuthConfig();
  if (!config.clientId || !config.clientSecret) {
    console.warn('[OAuth] Cannot refresh token: client credentials missing.');
    return null;
  }

  const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

  try {
    const response = await axios.post(
      config.tokenUrl,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: sessionUser.refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${basicAuth}`,
          'User-Agent': 'SourceTranslationTool/2.0 (https://meta.wikimedia.org/wiki/User:Jnanaranjan_sahu)',
        },
        timeout: 10000,
      }
    );

    const tokenData = response.data;
    if (tokenData && tokenData.access_token) {
      sessionUser.accessToken = tokenData.access_token;
      if (tokenData.refresh_token) {
        sessionUser.refreshToken = tokenData.refresh_token;
      }
      sessionUser.expiresAt = tokenData.expires_in
        ? Date.now() + tokenData.expires_in * 1000
        : Date.now() + 3600 * 1000;

      return sessionUser.accessToken;
    }
  } catch (err) {
    console.warn('[OAuth] Token refresh failed:', err.response?.data || err.message);
  }

  return null;
}

/**
 * Validates the current session user's token.
 * If expired and a refresh token is present, automatically refreshes it.
 * If invalid or expired and cannot be refreshed, destroys the user session and returns null.
 * @param {Object} req - Express request object
 * @returns {Promise<string|null>} Valid access token or null if session is invalid
 */
export async function validateOrRefreshToken(req) {
  if (!req.session || !req.session.user || !req.session.user.accessToken) {
    return null;
  }

  const user = req.session.user;
  const now = Date.now();

  // If token is expiring within 5 minutes or already expired
  const isExpiringSoon = user.expiresAt && now > user.expiresAt - 5 * 60 * 1000;

  if (isExpiringSoon) {
    if (user.refreshToken) {
      const newToken = await refreshWikimediaToken(user);
      if (newToken) {
        await new Promise((resolve) => req.session.save(resolve));
        return newToken;
      }
    }
    // Token is expired and cannot be refreshed
    delete req.session.user;
    await new Promise((resolve) => req.session.save(resolve));
    return null;
  }

  // If session lacks an expiresAt timestamp (e.g. legacy session or restart)
  if (!user.expiresAt) {
    try {
      const config = getOAuthConfig();
      await axios.get(config.profileUrl, {
        headers: {
          'Authorization': `Bearer ${user.accessToken}`,
          'User-Agent': 'SourceTranslationTool/2.0 (https://meta.wikimedia.org/wiki/User:Jnanaranjan_sahu)',
        },
        timeout: 5000,
      });

      // Valid token: assign an assumed 1 hour expiry to avoid hammering the profile endpoint
      user.expiresAt = now + 3600 * 1000;
      await new Promise((resolve) => req.session.save(resolve));
      return user.accessToken;
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        if (user.refreshToken) {
          const newToken = await refreshWikimediaToken(user);
          if (newToken) {
            await new Promise((resolve) => req.session.save(resolve));
            return newToken;
          }
        }
        // Token rejected by Wikimedia and cannot be refreshed
        delete req.session.user;
        await new Promise((resolve) => req.session.save(resolve));
        return null;
      }
    }
  }

  return user.accessToken;
}
