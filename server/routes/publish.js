import express from 'express';
import { isVerifiedUser } from '../config/verifiedUsers.js';
import { analyticsService } from '../services/analyticsService.js';

const router = express.Router();

router.post('/', async (req, res) => {
  if (!req.session || !req.session.user || !req.session.user.accessToken) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'You must be logged in to publish articles.',
    });
  }

  const { text, language, title, sourceLanguage, sourceTitle, mtEngine, sessionId } = req.body;

  if (!text || !language || !title) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'text, language, and title are required.',
    });
  }

  // Phase 1 Guard: Check if publishing to Mainspace and verify user
  const isMainspace = !title.startsWith('User:') && !title.startsWith('Draft:');
  const username = req.session.user.username;
  if (isMainspace && !isVerifiedUser(username)) {
    return res.status(403).json({
      error: 'Mainspace Restricted',
      message: 'Direct Mainspace publishing is currently restricted to verified users during Phase 1 beta. Please publish to your User Sandbox (Draft) or Draft namespace.',
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

    // 2. Format edit summary with source attribution (CC BY-SA compliance)
    let editSummary = 'Created via Source Translation Tool (https://meta.wikimedia.org/wiki/User:Jnanaranjan_sahu)';
    if (sourceTitle && sourceLanguage) {
      editSummary = `Translated from [[:${sourceLanguage}:${sourceTitle}]] via Source Translation Tool (https://meta.wikimedia.org/wiki/User:Jnanaranjan_sahu)`;
    }

    // 3. Publish Edit with OAuth Bearer Token & User-Agent
    const editUrl = `https://${language}.wikipedia.org/w/api.php`;
    const editParams = new URLSearchParams({
      action: 'edit',
      title: title,
      text: text,
      summary: editSummary,
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

    // 4. Log publish analytics event
    try {
      const targetNamespace = title.startsWith('User:') ? 'sandbox' : (title.startsWith('Draft:') ? 'draft' : 'mainspace');
      const wordCount = (text || '').trim().split(/\s+/).filter(Boolean).length;
      const charCount = (text || '').length;

      await analyticsService.logEvent({
        sessionId,
        wikiUser: username,
        eventType: 'publish',
        sourceLang: sourceLanguage || 'en',
        targetLang: language,
        sourceTitle: sourceTitle || title,
        targetTitle: title,
        wordCount,
        charCount,
        mtEngine: mtEngine || 'google',
        targetNamespace,
        revisionId: editData.edit?.newrevid || null,
        metadata: {
          result: editData.edit?.result,
          pageId: editData.edit?.pageid,
        },
      });
    } catch (analyticsErr) {
      console.warn('[Analytics] Failed to record publish event:', analyticsErr.message);
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
