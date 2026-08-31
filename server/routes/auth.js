import express from 'express';
import axios from 'axios';

const router = express.Router();

const getOAuthConfig = () => ({
  clientId: process.env.WIKI_CLIENT_ID || process.env.OAUTH_CONSUMER_KEY || '',
  clientSecret: process.env.WIKI_CLIENT_SECRET || process.env.OAUTH_CONSUMER_SECRET || '',
  authorizationUrl: 'https://meta.wikimedia.org/w/rest.php/oauth2/authorize',
  tokenUrl: 'https://meta.wikimedia.org/w/rest.php/oauth2/access_token',
  profileUrl: 'https://meta.wikimedia.org/w/rest.php/oauth2/resource/profile',
  callbackUrl: process.env.WIKI_CALLBACK_URL || process.env.OAUTH_CALLBACK_URL || 'http://localhost:8000/callback',
});

// Login - redirect to Wikimedia authorization
router.get('/login', (req, res) => {
  const config = getOAuthConfig();
  if (!config.clientId) {
    return res.status(500).json({
      error: 'OAuth not configured',
      message: 'Set OAUTH_CONSUMER_KEY and OAUTH_CONSUMER_SECRET in your .env file.',
    });
  }

  // Save the originating frontend URL safely (prevent open redirects)
  if (req.session) {
    const rawReferer = req.headers.referer || '';
    let safeReturnTo = process.env.NODE_ENV === 'production' ? '/' : 'http://localhost:5173/';

    if (rawReferer) {
      try {
        const parsed = new URL(rawReferer);
        // Allow relative path return or safe local dev origins
        if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname.endsWith('toolforge.org') || parsed.hostname.endsWith('wmcloud.org')) {
          safeReturnTo = parsed.origin ? parsed.origin + (parsed.pathname || '/') : (parsed.pathname || '/');
        } else if (parsed.pathname) {
          safeReturnTo = parsed.pathname.startsWith('/') ? parsed.pathname : '/';
        }
      } catch (e) {
        safeReturnTo = '/';
      }
    }

    req.session.returnTo = safeReturnTo;
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.callbackUrl,
  });

  res.redirect(`${config.authorizationUrl}?${params.toString()}`);
});

// Callback - exchange code for token
router.get('/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Missing authorization code');
  }

  const config = getOAuthConfig();
  const safeFallback = process.env.NODE_ENV === 'production' ? '/' : 'http://localhost:5173/';
  const returnTo = req.session?.returnTo || safeFallback;

  try {
    // Exchange code for access token (supporting both HTTP Basic Auth header and body parameters)
    const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    const tokenResponse = await axios.post(
      config.tokenUrl,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.callbackUrl,
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

    const tokenData = tokenResponse.data;

    if (!tokenData || !tokenData.access_token) {
      throw new Error('No access token received: ' + JSON.stringify(tokenData));
    }

    // Fetch user profile
    const profileResponse = await axios.get(config.profileUrl, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'User-Agent': 'SourceTranslationTool/2.0 (https://meta.wikimedia.org/wiki/User:Jnanaranjan_sahu)',
      },
      timeout: 10000,
    });

    const profile = profileResponse.data;

    // Store user in session
    req.session.user = {
      username: profile.username || profile.sub,
      id: profile.sub,
      accessToken: tokenData.access_token,
    };

    if (req.session.returnTo) {
      delete req.session.returnTo;
    }

    // Explicitly persist session before sending the redirect response
    req.session.save((saveErr) => {
      if (saveErr) {
        console.error('Session save error during OAuth callback:', saveErr);
      }
      res.redirect(returnTo);
    });
  } catch (error) {
    console.error('OAuth callback error:', error.response?.data || error.message);
    const redirectUrl = returnTo.includes('?') ? `${returnTo}&auth=failed` : `${returnTo}?auth=failed`;
    res.redirect(redirectUrl);
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.warn('Error destroying session:', err);
    }
    res.clearCookie('st_session');
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

import { isVerifiedUser } from '../config/verifiedUsers.js';
import { isAdminUser } from '../config/adminUsers.js';

// Get current user
router.get('/user', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.session && req.session.user) {
    const username = req.session.user.username;
    res.json({
      username: username,
      id: req.session.user.id,
      canPublishMainspace: isVerifiedUser(username),
      isAdmin: isAdminUser(username),
    });
  } else {
    res.json(null);
  }
});

export default router;
