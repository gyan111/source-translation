import { query, isDatabaseConnected } from '../config/database.js';

// In-memory buffer fallback if DB is temporarily unreachable
const inMemoryEvents = [];
const MAX_IN_MEMORY = 100;

export const analyticsService = {
  /**
   * Log an event into the database.
   */
  async logEvent({
    sessionId = null,
    wikiUser = 'anonymous',
    eventType,
    sourceLang,
    targetLang,
    sourceTitle,
    targetTitle = null,
    wordCount = 0,
    charCount = 0,
    sectionCount = 0,
    mtEngine = 'google',
    targetNamespace = null,
    revisionId = null,
    metadata = null,
  }) {
    if (!eventType || !sourceLang || !targetLang || !sourceTitle) {
      return null;
    }

    const eventRecord = {
      sessionId,
      wikiUser: wikiUser || 'anonymous',
      eventType,
      sourceLang,
      targetLang,
      sourceTitle,
      targetTitle: targetTitle || sourceTitle,
      wordCount: parseInt(wordCount || 0, 10),
      charCount: parseInt(charCount || 0, 10),
      sectionCount: parseInt(sectionCount || 0, 10),
      mtEngine: mtEngine || 'google',
      targetNamespace,
      revisionId: revisionId ? parseInt(revisionId, 10) : null,
      metadata: metadata ? (typeof metadata === 'object' ? JSON.stringify(metadata) : metadata) : null,
      createdAt: new Date(),
    };

    if (isDatabaseConnected()) {
      try {
        const sql = `
          INSERT INTO translation_events 
          (session_id, wiki_user, event_type, source_lang, target_lang, source_title, target_title, word_count, char_count, section_count, mt_engine, target_namespace, revision_id, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
          eventRecord.sessionId,
          eventRecord.wikiUser,
          eventRecord.eventType,
          eventRecord.sourceLang,
          eventRecord.targetLang,
          eventRecord.sourceTitle,
          eventRecord.targetTitle,
          eventRecord.wordCount,
          eventRecord.charCount,
          eventRecord.sectionCount,
          eventRecord.mtEngine,
          eventRecord.targetNamespace,
          eventRecord.revisionId,
          eventRecord.metadata,
        ];
        const res = await query(sql, params);
        return { id: res.insertId, ...eventRecord };
      } catch (err) {
        console.error('[Analytics] Failed to insert event into MySQL:', err.message);
      }
    }

    // Keep recent in-memory fallback
    inMemoryEvents.unshift({ id: inMemoryEvents.length + 1, ...eventRecord });
    if (inMemoryEvents.length > MAX_IN_MEMORY) {
      inMemoryEvents.pop();
    }
    return eventRecord;
  },

  /**
   * Retrieve aggregate statistics for admin dashboard.
   */
  async getStatsSummary() {
    if (!isDatabaseConnected()) {
      // Aggregate in-memory metrics
      const totalEvents = inMemoryEvents.length;
      const publishes = inMemoryEvents.filter(e => e.eventType === 'publish').length;
      const translates = inMemoryEvents.filter(e => e.eventType === 'translate').length;
      const exportsAndCopies = inMemoryEvents.filter(e => e.eventType === 'copy' || e.eventType === 'export').length;
      const namedUsers = inMemoryEvents.filter(e => e.wikiUser && e.wikiUser !== 'anonymous');
      const uniqueUsers = new Set(namedUsers.map(e => e.wikiUser)).size;

      // Group in-memory top contributors
      const userMap = {};
      namedUsers.forEach(e => {
        if (!userMap[e.wikiUser]) {
          userMap[e.wikiUser] = {
            wikiUser: e.wikiUser,
            publishes: 0,
            translates: 0,
            exportsAndCopies: 0,
            totalWords: 0,
            lastActive: e.createdAt,
          };
        }
        if (e.eventType === 'publish') userMap[e.wikiUser].publishes++;
        else if (e.eventType === 'translate') userMap[e.wikiUser].translates++;
        else if (e.eventType === 'copy' || e.eventType === 'export') userMap[e.wikiUser].exportsAndCopies++;
        userMap[e.wikiUser].totalWords += (e.wordCount || 0);
      });

      const topContributors = Object.values(userMap)
        .sort((a, b) => (b.publishes * 10 + b.translates) - (a.publishes * 10 + a.translates))
        .slice(0, 10);

      return {
        databaseConnected: false,
        totals: {
          totalEvents,
          publishes,
          translates,
          exportsAndCopies,
          uniqueUsers,
        },
        languageDistribution: [],
        engineDistribution: [],
        topContributors,
        dailyTrend: [],
      };
    }

    try {
      // 1. Overall counts by event type
      const countsByType = await query(`
        SELECT event_type, COUNT(*) as count 
        FROM translation_events 
        GROUP BY event_type
      `);

      const typeMap = {};
      countsByType.forEach(row => {
        typeMap[row.event_type] = Number(row.count);
      });

      // 2. Unique editors & volume
      const [distinctStats] = await query(`
        SELECT 
          COUNT(DISTINCT CASE WHEN wiki_user != 'anonymous' THEN wiki_user END) as unique_users,
          COUNT(DISTINCT source_title) as unique_articles,
          COALESCE(SUM(word_count), 0) as total_words,
          COALESCE(SUM(char_count), 0) as total_chars
        FROM translation_events
      `);

      // 3. Top Contributors Leaderboard
      const topContributorsRows = await query(`
        SELECT 
          wiki_user,
          COUNT(CASE WHEN event_type = 'publish' THEN 1 END) as publishes,
          COUNT(CASE WHEN event_type = 'translate' THEN 1 END) as translates,
          COUNT(CASE WHEN event_type IN ('copy', 'export') THEN 1 END) as exports_and_copies,
          COALESCE(SUM(word_count), 0) as total_words,
          MAX(created_at) as last_active
        FROM translation_events
        WHERE wiki_user IS NOT NULL AND wiki_user != 'anonymous' AND wiki_user != ''
        GROUP BY wiki_user
        ORDER BY publishes DESC, total_words DESC
        LIMIT 15
      `);

      const topContributors = topContributorsRows.map(r => ({
        wikiUser: r.wiki_user,
        publishes: Number(r.publishes || 0),
        translates: Number(r.translates || 0),
        exportsAndCopies: Number(r.exports_and_copies || 0),
        totalWords: Number(r.total_words || 0),
        lastActive: r.last_active,
      }));

      // 4. Target Language breakdown
      const languageDistribution = await query(`
        SELECT target_lang, COUNT(*) as count 
        FROM translation_events 
        GROUP BY target_lang 
        ORDER BY count DESC 
        LIMIT 10
      `);

      // 5. MT Engine breakdown
      const engineDistribution = await query(`
        SELECT mt_engine, COUNT(*) as count 
        FROM translation_events 
        WHERE mt_engine IS NOT NULL AND mt_engine != ''
        GROUP BY mt_engine 
        ORDER BY count DESC
      `);

      // 6. Target Namespace breakdown (for publishes)
      const namespaceDistribution = await query(`
        SELECT COALESCE(target_namespace, 'unknown') as namespace, COUNT(*) as count
        FROM translation_events
        WHERE event_type = 'publish'
        GROUP BY namespace
      `);

      // 7. 30-day Daily Activity Trend
      const dailyTrend = await query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(CASE WHEN event_type = 'translate' THEN 1 END) as translates,
          COUNT(CASE WHEN event_type = 'publish' THEN 1 END) as publishes,
          COUNT(CASE WHEN event_type IN ('copy', 'export') THEN 1 END) as exports
        FROM translation_events
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `);

      return {
        databaseConnected: true,
        totals: {
          totalEvents: Object.values(typeMap).reduce((a, b) => a + b, 0),
          publishes: typeMap['publish'] || 0,
          translates: typeMap['translate'] || 0,
          copies: typeMap['copy'] || 0,
          exports: typeMap['export'] || 0,
          exportsAndCopies: (typeMap['copy'] || 0) + (typeMap['export'] || 0),
          uniqueUsers: Number(distinctStats?.unique_users || 0),
          uniqueArticles: Number(distinctStats?.unique_articles || 0),
          totalWords: Number(distinctStats?.total_words || 0),
          totalChars: Number(distinctStats?.total_chars || 0),
        },
        topContributors,
        languageDistribution: languageDistribution.map(r => ({ language: r.target_lang, count: Number(r.count) })),
        engineDistribution: engineDistribution.map(r => ({ engine: r.mt_engine, count: Number(r.count) })),
        namespaceDistribution: namespaceDistribution.map(r => ({ namespace: r.namespace, count: Number(r.count) })),
        dailyTrend,
      };
    } catch (err) {
      console.error('[Analytics] Error computing stats summary:', err);
      return {
        databaseConnected: false,
        error: err.message,
        totals: {},
        topContributors: [],
        languageDistribution: [],
        engineDistribution: [],
        dailyTrend: [],
      };
    }
  },

  /**
   * Get recent event stream with optional user filtering.
   */
  async getRecentEvents(limit = 60, userFilter = null) {
    if (!isDatabaseConnected()) {
      let list = inMemoryEvents;
      if (userFilter) {
        list = list.filter(e => e.wikiUser && e.wikiUser.toLowerCase() === userFilter.toLowerCase());
      }
      return list.slice(0, limit);
    }

    try {
      let sql = `
        SELECT 
          id, session_id, wiki_user, event_type, 
          source_lang, target_lang, source_title, target_title, 
          word_count, char_count, section_count, mt_engine, 
          target_namespace, revision_id, metadata, created_at
        FROM translation_events 
      `;
      const params = [];

      if (userFilter) {
        sql += ` WHERE wiki_user = ? `;
        params.push(userFilter);
      }

      sql += ` ORDER BY created_at DESC LIMIT ? `;
      params.push(limit);

      const rows = await query(sql, params);

      return rows.map(r => ({
        id: r.id,
        sessionId: r.session_id,
        wikiUser: r.wiki_user,
        eventType: r.event_type,
        sourceLang: r.source_lang,
        targetLang: r.target_lang,
        sourceTitle: r.source_title,
        targetTitle: r.target_title,
        wordCount: r.word_count,
        charCount: r.char_count,
        sectionCount: r.section_count,
        mtEngine: r.mt_engine,
        targetNamespace: r.target_namespace,
        revisionId: r.revision_id,
        metadata: r.metadata,
        createdAt: r.created_at,
      }));
    } catch (err) {
      console.error('[Analytics] Error fetching recent events:', err);
      return inMemoryEvents.slice(0, limit);
    }
  },
};
