import { query, isDatabaseConnected, tryReconnect, getDatabaseError } from '../config/database.js';

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
      await tryReconnect();
    }

    if (!isDatabaseConnected()) {
      const dbError = getDatabaseError ? getDatabaseError() : null;
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
        databaseError: dbError,
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
        databaseError: err.message,
        totals: {},
        topContributors: [],
        languageDistribution: [],
        engineDistribution: [],
        dailyTrend: [],
      };
    }
  },

  /**
   * Get recent event stream with optional user filtering, pagination, sorting, and search.
   */
  async getRecentEvents(limitOrOptions = 60, legacyUserFilter = null) {
    let options = {};
    if (typeof limitOrOptions === 'object' && limitOrOptions !== null) {
      options = limitOrOptions;
    } else {
      options = {
        limit: Number(limitOrOptions) || 60,
        userFilter: legacyUserFilter,
        page: 1,
      };
    }

    const page = Math.max(1, parseInt(options.page || 1, 10));
    const limit = Math.min(100, Math.max(1, parseInt(options.limit || 25, 10)));
    const offset = (page - 1) * limit;
    const userFilter = options.userFilter || options.user || null;
    const eventType = options.eventType || null;
    const targetLang = options.targetLang || options.lang || null;
    const mtEngine = options.mtEngine || options.engine || null;
    const search = options.search ? options.search.trim().toLowerCase() : null;
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = (options.sortOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

    if (!isDatabaseConnected()) {
      let list = [...inMemoryEvents];

      if (userFilter) {
        list = list.filter(e => e.wikiUser && e.wikiUser.toLowerCase() === userFilter.toLowerCase());
      }
      if (eventType && eventType !== 'all') {
        if (eventType === 'export') {
          list = list.filter(e => e.eventType === 'copy' || e.eventType === 'export');
        } else {
          list = list.filter(e => e.eventType === eventType);
        }
      }
      if (targetLang && targetLang !== 'all') {
        list = list.filter(e => e.targetLang && e.targetLang.toLowerCase() === targetLang.toLowerCase());
      }
      if (mtEngine && mtEngine !== 'all') {
        list = list.filter(e => e.mtEngine && e.mtEngine.toLowerCase() === mtEngine.toLowerCase());
      }
      if (search) {
        list = list.filter(e => 
          (e.sourceTitle && e.sourceTitle.toLowerCase().includes(search)) ||
          (e.targetTitle && e.targetTitle.toLowerCase().includes(search)) ||
          (e.wikiUser && e.wikiUser.toLowerCase().includes(search))
        );
      }

      // In-memory sorting
      list.sort((a, b) => {
        let valA, valB;
        if (sortBy === 'wordCount') {
          valA = a.wordCount || 0;
          valB = b.wordCount || 0;
        } else if (sortBy === 'sourceTitle') {
          valA = (a.sourceTitle || '').toLowerCase();
          valB = (b.sourceTitle || '').toLowerCase();
        } else if (sortBy === 'targetTitle') {
          valA = (a.targetTitle || '').toLowerCase();
          valB = (b.targetTitle || '').toLowerCase();
        } else if (sortBy === 'wikiUser') {
          valA = (a.wikiUser || '').toLowerCase();
          valB = (b.wikiUser || '').toLowerCase();
        } else if (sortBy === 'eventType') {
          valA = (a.eventType || '').toLowerCase();
          valB = (b.eventType || '').toLowerCase();
        } else {
          // Default: createdAt
          valA = new Date(a.createdAt || 0).getTime();
          valB = new Date(b.createdAt || 0).getTime();
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });

      const total = list.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const pagedList = list.slice(offset, offset + limit);

      // Attach pagination properties for callers while keeping Array interface
      Object.assign(pagedList, {
        total,
        page,
        limit,
        totalPages,
      });

      return pagedList;
    }

    try {
      const sortColumnMap = {
        createdAt: 'created_at',
        wordCount: 'word_count',
        sourceTitle: 'source_title',
        targetTitle: 'target_title',
        wikiUser: 'wiki_user',
        eventType: 'event_type',
      };
      const sortCol = sortColumnMap[sortBy] || 'created_at';
      const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

      const whereClauses = [];
      const params = [];

      if (userFilter) {
        whereClauses.push('wiki_user = ?');
        params.push(userFilter);
      }
      if (eventType && eventType !== 'all') {
        if (eventType === 'export') {
          whereClauses.push("event_type IN ('copy', 'export')");
        } else {
          whereClauses.push('event_type = ?');
          params.push(eventType);
        }
      }
      if (targetLang && targetLang !== 'all') {
        whereClauses.push('target_lang = ?');
        params.push(targetLang);
      }
      if (mtEngine && mtEngine !== 'all') {
        whereClauses.push('mt_engine = ?');
        params.push(mtEngine);
      }
      if (search) {
        whereClauses.push('(source_title LIKE ? OR target_title LIKE ? OR wiki_user LIKE ?)');
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      const whereSql = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')} ` : '';

      // Count query
      const [countRow] = await query(`SELECT COUNT(*) as total FROM translation_events ${whereSql}`, params);
      const total = Number(countRow?.total || 0);
      const totalPages = Math.max(1, Math.ceil(total / limit));

      // Data query
      const dataSql = `
        SELECT 
          id, session_id, wiki_user, event_type, 
          source_lang, target_lang, source_title, target_title, 
          word_count, char_count, section_count, mt_engine, 
          target_namespace, revision_id, metadata, created_at
        FROM translation_events 
        ${whereSql}
        ORDER BY ${sortCol} ${orderDirection}
        LIMIT ? OFFSET ?
      `;
      const dataParams = [...params, limit, offset];
      const rows = await query(dataSql, dataParams);

      const events = rows.map(r => ({
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

      Object.assign(events, {
        total,
        page,
        limit,
        totalPages,
      });

      return events;
    } catch (err) {
      console.error('[Analytics] Error fetching recent events:', err);
      const fallback = inMemoryEvents.slice(0, limit);
      Object.assign(fallback, { total: fallback.length, page: 1, limit, totalPages: 1 });
      return fallback;
    }
  },

  /**
   * Get detailed analytics for an individual contributor.
   */
  async getUserDetails(username) {
    if (!username) return null;

    if (!isDatabaseConnected()) {
      const userEvents = inMemoryEvents.filter(
        e => e.wikiUser && e.wikiUser.toLowerCase() === username.toLowerCase()
      );

      if (!userEvents.length) {
        return {
          wikiUser: username,
          totals: {
            totalEvents: 0,
            publishes: 0,
            translates: 0,
            exportsAndCopies: 0,
            totalWords: 0,
            totalChars: 0,
            totalSections: 0,
            firstActive: null,
            lastActive: null,
          },
          languages: [],
          engines: [],
          namespaces: [],
          recentArticles: [],
        };
      }

      let publishes = 0;
      let translates = 0;
      let exportsAndCopies = 0;
      let totalWords = 0;
      let totalChars = 0;
      let totalSections = 0;
      const langMap = {};
      const engineMap = {};
      const namespaceMap = {};

      userEvents.forEach(e => {
        if (e.eventType === 'publish') publishes++;
        else if (e.eventType === 'translate') translates++;
        else if (e.eventType === 'copy' || e.eventType === 'export') exportsAndCopies++;

        totalWords += (e.wordCount || 0);
        totalChars += (e.charCount || 0);
        totalSections += (e.sectionCount || 0);

        const langPair = `${e.sourceLang || 'en'} → ${e.targetLang || 'unknown'}`;
        if (!langMap[langPair]) {
          langMap[langPair] = { pair: langPair, targetLang: e.targetLang, count: 0, words: 0 };
        }
        langMap[langPair].count++;
        langMap[langPair].words += (e.wordCount || 0);

        if (e.mtEngine) {
          engineMap[e.mtEngine] = (engineMap[e.mtEngine] || 0) + 1;
        }

        if (e.targetNamespace) {
          namespaceMap[e.targetNamespace] = (namespaceMap[e.targetNamespace] || 0) + 1;
        }
      });

      const formattedLanguages = Object.values(langMap).sort((a, b) => b.count - a.count);
      const formattedEngines = Object.entries(engineMap).map(([engine, count]) => ({ engine, count })).sort((a, b) => b.count - a.count);
      const formattedNamespaces = Object.entries(namespaceMap).map(([namespace, count]) => ({ namespace, count }));
      const formattedRecentArticles = userEvents.slice(0, 50).map(e => ({
        id: e.id,
        eventType: e.eventType,
        sourceLang: e.sourceLang,
        targetLang: e.targetLang,
        sourceTitle: e.sourceTitle,
        targetTitle: e.targetTitle,
        wordCount: e.wordCount,
        revisionId: e.revisionId,
        targetNamespace: e.targetNamespace,
        diffUrl: e.revisionId && e.targetLang ? `https://${e.targetLang}.wikipedia.org/w/index.php?diff=${e.revisionId}` : null,
        createdAt: e.createdAt,
      }));

      return {
        wikiUser: username,
        username: username,
        totals: {
          totalEvents: userEvents.length,
          publishes,
          translates,
          exportsAndCopies,
          totalWords,
          totalChars,
          totalSections,
          firstActive: userEvents[userEvents.length - 1]?.createdAt || null,
          lastActive: userEvents[0]?.createdAt || null,
        },
        languages: formattedLanguages,
        languagePairs: formattedLanguages,
        engines: formattedEngines,
        mtEngines: formattedEngines,
        namespaces: formattedNamespaces,
        recentArticles: formattedRecentArticles,
      };
    }

    try {
      // 1. User totals
      const [totalsRow] = await query(`
        SELECT 
          COUNT(*) as total_events,
          COUNT(CASE WHEN event_type = 'publish' THEN 1 END) as publishes,
          COUNT(CASE WHEN event_type = 'translate' THEN 1 END) as translates,
          COUNT(CASE WHEN event_type IN ('copy', 'export') THEN 1 END) as exports_and_copies,
          COALESCE(SUM(word_count), 0) as total_words,
          COALESCE(SUM(char_count), 0) as total_chars,
          COALESCE(SUM(section_count), 0) as total_sections,
          MIN(created_at) as first_active,
          MAX(created_at) as last_active
        FROM translation_events
        WHERE wiki_user = ?
      `, [username]);

      // 2. Language pairs breakdown
      const langRows = await query(`
        SELECT 
          CONCAT(source_lang, ' → ', target_lang) as pair,
          target_lang,
          COUNT(*) as count,
          COALESCE(SUM(word_count), 0) as words
        FROM translation_events
        WHERE wiki_user = ?
        GROUP BY source_lang, target_lang
        ORDER BY count DESC
      `, [username]);

      // 3. Engine breakdown
      const engineRows = await query(`
        SELECT mt_engine as engine, COUNT(*) as count
        FROM translation_events
        WHERE wiki_user = ? AND mt_engine IS NOT NULL AND mt_engine != ''
        GROUP BY mt_engine
        ORDER BY count DESC
      `, [username]);

      // 4. Namespace breakdown
      const namespaceRows = await query(`
        SELECT COALESCE(target_namespace, 'mainspace') as namespace, COUNT(*) as count
        FROM translation_events
        WHERE wiki_user = ? AND event_type = 'publish'
        GROUP BY target_namespace
      `, [username]);

      // 5. Recent articles
      const recentRows = await query(`
        SELECT 
          id, event_type, source_lang, target_lang, source_title, target_title,
          word_count, revision_id, target_namespace, created_at
        FROM translation_events
        WHERE wiki_user = ?
        ORDER BY created_at DESC
        LIMIT 50
      `, [username]);

      const mysqlLanguages = langRows.map(r => ({
        pair: r.pair,
        targetLang: r.target_lang,
        count: Number(r.count),
        words: Number(r.words),
      }));
      const mysqlEngines = engineRows.map(r => ({
        engine: r.engine,
        count: Number(r.count),
      }));
      const mysqlNamespaces = namespaceRows.map(r => ({
        namespace: r.namespace,
        count: Number(r.count),
      }));
      const mysqlRecentArticles = recentRows.map(r => ({
        id: r.id,
        eventType: r.event_type,
        sourceLang: r.source_lang,
        targetLang: r.target_lang,
        sourceTitle: r.source_title,
        targetTitle: r.target_title,
        wordCount: r.word_count,
        revisionId: r.revision_id,
        targetNamespace: r.target_namespace,
        diffUrl: r.revision_id && r.target_lang ? `https://${r.target_lang}.wikipedia.org/w/index.php?diff=${r.revision_id}` : null,
        createdAt: r.created_at,
      }));

      return {
        wikiUser: username,
        username: username,
        totals: {
          totalEvents: Number(totalsRow?.total_events || 0),
          publishes: Number(totalsRow?.publishes || 0),
          translates: Number(totalsRow?.translates || 0),
          exportsAndCopies: Number(totalsRow?.exports_and_copies || 0),
          totalWords: Number(totalsRow?.total_words || 0),
          totalChars: Number(totalsRow?.total_chars || 0),
          totalSections: Number(totalsRow?.total_sections || 0),
          firstActive: totalsRow?.first_active || null,
          lastActive: totalsRow?.last_active || null,
        },
        languages: mysqlLanguages,
        languagePairs: mysqlLanguages,
        engines: mysqlEngines,
        mtEngines: mysqlEngines,
        namespaces: mysqlNamespaces,
        recentArticles: mysqlRecentArticles,
      };
    } catch (err) {
      console.error(`[Analytics] Error computing details for user ${username}:`, err);
      return null;
    }
  },
};
