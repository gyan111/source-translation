import express from 'express';

const router = express.Router();

router.post('/', async (req, res) => {
  if (!req.session || !req.session.user || !req.session.user.accessToken) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'You must be logged in to publish articles.',
    });
  }

  const { text, language, title } = req.body;

  if (!text || !language || !title) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'text, language, and title are required.',
    });
  }

  try {
    const accessToken = req.session.user.accessToken;

    // 1. Fetch CSRF Token
    const tokenUrl = `https://${language}.wikipedia.org/w/api.php?action=query&meta=tokens&type=csrf&format=json`;
    const tokenResponse = await fetch(tokenUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    const tokenData = await tokenResponse.json();
    const csrfToken = tokenData?.query?.tokens?.csrftoken;

    if (!csrfToken || csrfToken === '+\\') {
      throw new Error('Failed to obtain a valid CSRF token. Ensure you have the right permissions.');
    }

    // 2. Publish Edit
    const editUrl = `https://${language}.wikipedia.org/w/api.php`;
    const editParams = new URLSearchParams({
      action: 'edit',
      title: title,
      text: text,
      summary: 'Created via Source Translation Tool',
      format: 'json',
      token: csrfToken,
    });

    const editResponse = await fetch(editUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: editParams,
    });

    const editData = await editResponse.json();

    if (editData.error) {
      throw new Error(editData.error.info || 'Unknown error occurred during publish');
    }

    res.json({ success: true, data: editData.edit });

  } catch (error) {
    console.error('Publish error:', error);
    res.status(500).json({
      error: 'Publish failed',
      message: error.message || 'An error occurred while publishing the article.',
    });
  }
});

export default router;
