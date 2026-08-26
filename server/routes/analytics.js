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
    const userFilter = req.query.user ? req.query.user.trim() : null;
    const [summary, recentEvents] = await Promise.all([
      analyticsService.getStatsSummary(),
      analyticsService.getRecentEvents(100, userFilter),
    ]);

    res.json({
      success: true,
      summary,
      recentEvents,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to retrieve stats' });
  }
});

export default router;
