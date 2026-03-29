import express from 'express';

const router = express.Router();

// Wikimedia OAuth 2.0 configuration
const OAUTH_CONFIG = {
  clientId: process.env.OAUTH_CONSUMER_KEY || '',
  clientSecret: process.env.OAUTH_CONSUMER_SECRET || '',
  authorizationUrl: 'https://meta.wikimedia.org/w/rest.php/oauth2/authorize',
  tokenUrl: 'https://meta.wikimedia.org/w/rest.php/oauth2/access_token',
  profileUrl: 'https://meta.wikimedia.org/w/rest.php/oauth2/resource/profile',
  callbackUrl: process.env.OAUTH_CALLBACK_URL || 'http://localhost:3000/auth/callback',
};

// Login - redirect to Wikimedia authorization
router.get('/login', (req, res) => {
  if (!OAUTH_CONFIG.clientId) {
    return res.status(500).json({
      error: 'OAuth not configured',
      message: 'Set OAUTH_CONSUMER_KEY and OAUTH_CONSUMER_SECRET environment variables.',
    });
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: OAUTH_CONFIG.clientId,
    redirect_uri: OAUTH_CONFIG.callbackUrl,
  });

  res.redirect(`${OAUTH_CONFIG.authorizationUrl}?${params.toString()}`);
});

// Callback - exchange code for token
router.get('/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Missing authorization code');
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch(OAUTH_CONFIG.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: OAUTH_CONFIG.clientId,
        client_secret: OAUTH_CONFIG.clientSecret,
        redirect_uri: OAUTH_CONFIG.callbackUrl,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      throw new Error('No access token received');
    }

    // Fetch user profile
    const profileResponse = await fetch(OAUTH_CONFIG.profileUrl, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const profile = await profileResponse.json();

    // Store user in session
    req.session.user = {
      username: profile.username || profile.sub,
      id: profile.sub,
      accessToken: tokenData.access_token,
    };

    // Redirect to frontend
    res.redirect('/');
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('Authentication failed. Please try again.');
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// Get current user
router.get('/user', (req, res) => {
  if (req.session && req.session.user) {
    res.json({
      username: req.session.user.username,
      id: req.session.user.id,
    });
  } else {
    res.json(null);
  }
});

export default router;
