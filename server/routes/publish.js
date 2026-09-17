import express from 'express';
import { isVerifiedUser } from '../config/verifiedUsers.js';
import { analyticsService } from '../services/analyticsService.js';
import { validateOrRefreshToken, refreshWikimediaToken } from '../services/oauthService.js';

const router = express.Router();

router.post('/', async (req, res) => {
  let accessToken = await validateOrRefreshToken(req);
  if (!accessToken || !req.session || !req.session.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Your Wikimedia session has expired. Please log in again.',
      sessionExpired: true,
    });
  }

  const {
    text,
    language,
    title,
    sourceLanguage,
    sourceTitle,
    mtEngine,
    sessionId,
    section,
    sectiontitle,
    publishMode,
    placementMode,
    targetSectionIndex,
    targetSectionTitle,
  } = req.body;

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
    // 1. Fetch CSRF Token
    const userAgent = 'SourceTranslationTool/2.0 (https://meta.wikimedia.org/wiki/User:Jnanaranjan_sahu; source-translation-app)';
    const tokenUrl = `https://${language}.wikipedia.org/w/api.php?action=query&meta=tokens&type=csrf&format=json`;
    let tokenResponse = await fetch(tokenUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': userAgent,
      },
    });
    
    let tokenData = await tokenResponse.json();
    let csrfToken = tokenData?.query?.tokens?.csrftoken;

    // If CSRF token is missing or anonymous dummy token (+\), attempt token refresh and retry
    if (!csrfToken || csrfToken === '+\\') {
      if (req.session.user.refreshToken) {
        const refreshedToken = await refreshWikimediaToken(req.session.user);
        if (refreshedToken) {
          accessToken = refreshedToken;
          await new Promise((resolve) => req.session.save(resolve));

          tokenResponse = await fetch(tokenUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'User-Agent': userAgent,
            },
          });
          tokenData = await tokenResponse.json();
          csrfToken = tokenData?.query?.tokens?.csrftoken;
        }
      }
    }

    if (!csrfToken || csrfToken === '+\\') {
      delete req.session.user;
      await new Promise((resolve) => req.session.save(resolve));
      return res.status(401).json({
        error: 'Session Expired',
        message: 'Your Wikimedia session has expired. Please log in again.',
        sessionExpired: true,
      });
    }

    // 2. Format edit summary with source attribution (CC BY-SA compliance)
    let editSummary = 'Created via Source Translation Tool (https://source-translation.toolforge.org)';
    const attribution = (sourceTitle && sourceLanguage)
      ? `Translated from [[:${sourceLanguage}:${sourceTitle}]] via Source Translation Tool (https://source-translation.toolforge.org)`
      : 'Created via Source Translation Tool (https://source-translation.toolforge.org)';

    const isSectionPublish = publishMode === 'section' || (section !== undefined && section !== null && section !== '') || Boolean(sectiontitle);
    if (isSectionPublish) {
      const displaySecTitle = sectiontitle || targetSectionTitle || '';
      if (placementMode === 'insert_after') {
        const anchorName = targetSectionTitle || (targetSectionIndex === '0' ? 'Lead section' : `§${targetSectionIndex}`);
        editSummary = displaySecTitle
          ? `/* ${displaySecTitle} */ Inserted section after "${anchorName}" from [[:${sourceLanguage}:${sourceTitle}]] via Source Translation Tool (https://source-translation.toolforge.org)`
          : `Inserted section after "${anchorName}" via Source Translation Tool (https://source-translation.toolforge.org)`;
      } else if (placementMode === 'insert_before') {
        const anchorName = targetSectionTitle || `§${targetSectionIndex}`;
        editSummary = displaySecTitle
          ? `/* ${displaySecTitle} */ Inserted section before "${anchorName}" from [[:${sourceLanguage}:${sourceTitle}]] via Source Translation Tool (https://source-translation.toolforge.org)`
          : `Inserted section before "${anchorName}" via Source Translation Tool (https://source-translation.toolforge.org)`;
      } else if (placementMode === 'replace') {
        const anchorName = targetSectionTitle || `§${targetSectionIndex}`;
        editSummary = displaySecTitle
          ? `/* ${displaySecTitle} */ Replaced section "${anchorName}" from [[:${sourceLanguage}:${sourceTitle}]] via Source Translation Tool (https://source-translation.toolforge.org)`
          : `Replaced section "${anchorName}" via Source Translation Tool (https://source-translation.toolforge.org)`;
      } else {
        // append_bottom or default section
        editSummary = displaySecTitle
          ? `/* ${displaySecTitle} */ Translated section from [[:${sourceLanguage}:${sourceTitle}]] via Source Translation Tool (https://source-translation.toolforge.org)`
          : attribution;
      }
    } else if (sourceTitle && sourceLanguage) {
      editSummary = attribution;
    }

    // 3. Publish Edit with OAuth Bearer Token & User-Agent
    const editUrl = `https://${language}.wikipedia.org/w/api.php`;
    const editPayload = {
      action: 'edit',
      title: title,
      summary: editSummary,
      format: 'json',
      token: csrfToken,
      assert: 'user',
    };

    if (publishMode === 'section') {
      if (placementMode === 'insert_after' || placementMode === 'insert_before') {
        let anchorIndex = '0';
        if (placementMode === 'insert_after') {
          anchorIndex = targetSectionIndex !== undefined && targetSectionIndex !== null ? String(targetSectionIndex) : '0';
        } else {
          const k = parseInt(targetSectionIndex, 10);
          anchorIndex = String(isNaN(k) || k <= 1 ? 0 : k - 1);
        }

        // Fetch anchor section wikitext
        const parseUrl = `https://${language}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&section=${anchorIndex}&format=json`;
        const parseResponse = await fetch(parseUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'User-Agent': userAgent,
          },
        });
        const parseData = await parseResponse.json();
        if (parseData.error) {
          throw new Error(`Failed to locate target section on "${title}": ${parseData.error.info || 'Section not found'}`);
        }
        const existingAnchorText = parseData.parse?.wikitext?.['*'] ?? '';

        let sectionWikitext = text.trim();
        if (sectiontitle && !sectionWikitext.startsWith('=')) {
          sectionWikitext = `== ${sectiontitle} ==\n` + sectionWikitext;
        }

        const combinedText = existingAnchorText
          ? existingAnchorText.trimEnd() + '\n\n' + sectionWikitext
          : sectionWikitext;

        editPayload.section = anchorIndex;
        editPayload.text = combinedText;
      } else if (placementMode === 'replace') {
        const replaceIndex = targetSectionIndex !== undefined && targetSectionIndex !== null ? String(targetSectionIndex) : String(section || '0');
        let sectionWikitext = text.trim();
        if (sectiontitle && !sectionWikitext.startsWith('=')) {
          sectionWikitext = `== ${sectiontitle} ==\n` + sectionWikitext;
        }
        editPayload.section = replaceIndex;
        editPayload.text = sectionWikitext;
      } else {
        // append_bottom
        let cleanText = text;
        let sTitle = sectiontitle || '';

        const headerMatch = text.match(/^\s*={1,6}\s*(.*?)\s*={1,6}\s*(?:\r?\n|$)/);
        if (headerMatch) {
          if (!sTitle) {
            sTitle = headerMatch[1].trim();
          }
          cleanText = text.slice(headerMatch[0].length).trim();
        }

        editPayload.section = 'new';
        if (sTitle) {
          editPayload.sectiontitle = sTitle;
        }
        editPayload.text = cleanText;
      }
    } else {
      // Full article publishing
      editPayload.text = text;
      if (section !== undefined && section !== null && section !== '') {
        editPayload.section = String(section);
        if (sectiontitle && String(section) === 'new') {
          editPayload.sectiontitle = sectiontitle;
        }
      }
    }

    const editParams = new URLSearchParams(editPayload);

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
      if (errCode === 'assertuserfailed' || errCode === 'badtoken') {
        delete req.session.user;
        await new Promise((resolve) => req.session.save(resolve));
        return res.status(401).json({
          error: 'Session Expired',
          message: 'Your Wikimedia session has expired. Please log in again.',
          sessionExpired: true,
        });
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
