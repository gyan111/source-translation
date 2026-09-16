import express from 'express';
import { analyticsService } from '../services/analyticsService.js';
import { isAdminUser } from '../config/adminUsers.js';

const router = express.Router();

// Public endpoint to record user activities (translate, copy, export, start)
router.post('/event', async (req, res) => {
  try {
    const {
      eventType,
      sourceLang,
      targetLang,
      sourceTitle,
      targetTitle,
      wordCount,
      charCount,
      sectionCount,
      mtEngine,
      sessionId,
      metadata,
    } = req.body;

    if (!eventType || !sourceLang || !targetLang || !sourceTitle) {
      return res.status(400).json({ error: 'Missing required event fields' });
    }

    const wikiUser = req.session?.user?.username || 'anonymous';

    const recorded = await analyticsService.logEvent({
      sessionId,
      wikiUser,
      eventType,
      sourceLang,
      targetLang,
      sourceTitle,
      targetTitle,
      wordCount,
      charCount,
      sectionCount,
      mtEngine,
      metadata,
    });

    res.json({ success: true, event: recorded });
  } catch (error) {
    console.error('Analytics event error:', error);
    res.status(500).json({ error: 'Failed to record event' });
  }
});

// Admin-only endpoint to fetch statistics and recent activity
router.get('/admin/stats', async (req, res) => {
  const username = req.session?.user?.username;
  
  if (!username || !isAdminUser(username)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access restricted to tool administrators.',
    });
  }

  try {
    const {
      page = 1,
      limit = 25,
      user,
      eventType,
      targetLang,
      engine,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const userFilter = user ? user.trim() : null;
    const [summary, recentEvents] = await Promise.all([
      analyticsService.getStatsSummary(),
      analyticsService.getRecentEvents({
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 25,
        userFilter,
        eventType: eventType ? eventType.trim() : null,
        targetLang: targetLang ? targetLang.trim() : null,
        mtEngine: engine ? engine.trim() : null,
        search: search ? search.trim() : null,
        sortBy: sortBy ? sortBy.trim() : 'createdAt',
        sortOrder: sortOrder ? sortOrder.trim() : 'desc',
      }),
    ]);

    res.json({
      success: true,
      summary,
      recentEvents,
      pagination: {
        total: recentEvents.total ?? recentEvents.length,
        page: recentEvents.page ?? 1,
        limit: recentEvents.limit ?? 25,
        totalPages: recentEvents.totalPages ?? 1,
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to retrieve stats' });
  }
});

// Admin-only endpoint to fetch detailed analytics for a specific contributor
router.get('/admin/user/:username', async (req, res) => {
  const adminName = req.session?.user?.username;

  if (!adminName || !isAdminUser(adminName)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access restricted to tool administrators.',
    });
  }

  try {
    const { username } = req.params;
    const userDetails = await analyticsService.getUserDetails(username);

    if (!userDetails) {
      return res.status(404).json({ error: 'User not found or no records available.' });
    }

    res.json({
      success: true,
      userDetails,
    });
  } catch (error) {
    console.error('Admin user details error:', error);
    res.status(500).json({ error: 'Failed to retrieve user details' });
  }
});

export default router;
