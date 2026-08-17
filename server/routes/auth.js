import express from 'express';

const router = express.Router();

const getOAuthConfig = () => ({
  clientId: process.env.OAUTH_CONSUMER_KEY || '',
  clientSecret: process.env.OAUTH_CONSUMER_SECRET || '',
  authorizationUrl: 'https://meta.wikimedia.org/w/rest.php/oauth2/authorize',
  tokenUrl: 'https://meta.wikimedia.org/w/rest.php/oauth2/access_token',
  profileUrl: 'https://meta.wikimedia.org/w/rest.php/oauth2/resource/profile',
  callbackUrl: process.env.OAUTH_CALLBACK_URL || 'http://localhost:8000/callback',
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

  try {
    // Exchange code for access token
    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.callbackUrl,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      throw new Error('No access token received: ' + JSON.stringify(tokenData));
    }

    // Fetch user profile
    const profileResponse = await fetch(config.profileUrl, {
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
