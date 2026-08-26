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
      metadata: metadata ? JSON.stringify(metadata) : null,
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
      // Return aggregated in-memory metrics
      const totalEvents = inMemoryEvents.length;
      const publishes = inMemoryEvents.filter(e => e.eventType === 'publish').length;
      const translates = inMemoryEvents.filter(e => e.eventType === 'translate').length;
      const exportsAndCopies = inMemoryEvents.filter(e => e.eventType === 'copy' || e.eventType === 'export').length;
      const uniqueUsers = new Set(inMemoryEvents.map(e => e.wikiUser).filter(u => u !== 'anonymous')).size;

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

      // 2. Unique editors & articles
      const [distinctStats] = await query(`
        SELECT 
          COUNT(DISTINCT CASE WHEN wiki_user != 'anonymous' THEN wiki_user END) as unique_users,
          COUNT(DISTINCT source_title) as unique_articles,
          COALESCE(SUM(word_count), 0) as total_words,
          COALESCE(SUM(char_count), 0) as total_chars
        FROM translation_events
      `);

      // 3. Target Language breakdown
      const languageDistribution = await query(`
        SELECT target_lang, COUNT(*) as count 
        FROM translation_events 
        GROUP BY target_lang 
        ORDER BY count DESC 
        LIMIT 10
      `);

      // 4. MT Engine breakdown
      const engineDistribution = await query(`
        SELECT mt_engine, COUNT(*) as count 
        FROM translation_events 
        WHERE mt_engine IS NOT NULL AND mt_engine != ''
        GROUP BY mt_engine 
        ORDER BY count DESC
      `);

      // 5. Target Namespace breakdown (for publishes)
      const namespaceDistribution = await query(`
        SELECT COALESCE(target_namespace, 'unknown') as namespace, COUNT(*) as count
        FROM translation_events
        WHERE event_type = 'publish'
        GROUP BY namespace
      `);

      // 6. 30-day Daily Activity Trend
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
        languageDistribution: [],
        engineDistribution: [],
        dailyTrend: [],
      };
    }
  },

  /**
   * Get recent event stream.
   */
  async getRecentEvents(limit = 50) {
    if (!isDatabaseConnected()) {
      return inMemoryEvents.slice(0, limit);
    }

    try {
      const rows = await query(`
        SELECT 
          id, session_id, wiki_user, event_type, 
          source_lang, target_lang, source_title, target_title, 
          word_count, char_count, section_count, mt_engine, 
          target_namespace, revision_id, metadata, created_at
        FROM translation_events 
        ORDER BY created_at DESC 
        LIMIT ?
      `, [limit]);

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
