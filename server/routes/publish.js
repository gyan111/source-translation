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
    const userAgent = 'SourceTranslationTool/2.0 (https://meta.wikimedia.org/wiki/User:Jnanaranjan_sahu; source-translation-app)';
    const tokenUrl = `https://${language}.wikipedia.org/w/api.php?action=query&meta=tokens&type=csrf&format=json`;
    const tokenResponse = await fetch(tokenUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': userAgent,
      },
    });
    
    const tokenData = await tokenResponse.json();
    const csrfToken = tokenData?.query?.tokens?.csrftoken;

    if (!csrfToken || csrfToken === '+\\') {
      throw new Error('Failed to obtain a valid CSRF token. Please log in again.');
    }

    // 2. Publish Edit with OAuth Bearer Token & User-Agent
    const editUrl = `https://${language}.wikipedia.org/w/api.php`;
    const editParams = new URLSearchParams({
      action: 'edit',
      title: title,
      text: text,
      summary: 'Created via Source Translation Tool (https://meta.wikimedia.org/wiki/User:Jnanaranjan_sahu)',
      format: 'json',
      token: csrfToken,
      assert: 'user',
    });

    const editResponse = await fetch(editUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': userAgent,
      },
      body: editParams,
    });

    const editData = await editResponse.json();

    if (editData.error) {
      const errInfo = editData.error.info || 'Unknown error occurred during publish';
      const errCode = editData.error.code || '';
      
      if (errCode === 'cantcreate' || errInfo.toLowerCase().includes('permission to create')) {
        throw new Error(
          'MediaWiki Permission Error: Your OAuth Application on Meta-Wiki requires the "Create, edit, and move pages" grant. ' +
          'Please verify your OAuth consumer grants on Meta-Wiki, or publish to your User Sandbox (Draft) first.'
        );
      }
      if (errCode === 'assertuserfailed') {
        throw new Error('OAuth session expired. Please log out and log in again.');
      }
      throw new Error(errInfo);
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
