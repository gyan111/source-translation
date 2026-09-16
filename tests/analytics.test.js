import { describe, it, expect, beforeEach } from 'vitest';
import { isAdminUser } from '../server/config/adminUsers.js';
import { analyticsService } from '../server/services/analyticsService.js';

describe('Admin Users Configuration', () => {
  beforeEach(() => {
    process.env.ADMIN_USERS = 'Jnanaranjan_sahu,Gyana111';
  });

  it('should authorize exact username matches', () => {
    expect(isAdminUser('Jnanaranjan_sahu')).toBe(true);
    expect(isAdminUser('Gyana111')).toBe(true);
  });

  it('should authorize normalized username variations (spaces and case)', () => {
    expect(isAdminUser('jnanaranjan sahu')).toBe(true);
    expect(isAdminUser('Jnanaranjan Sahu')).toBe(true);
    expect(isAdminUser('gyana111')).toBe(true);
  });

  it('should reject unauthorized users', () => {
    expect(isAdminUser('RandomUser')).toBe(false);
    expect(isAdminUser('')).toBe(false);
    expect(isAdminUser(null)).toBe(false);
  });
});

describe('Analytics Service Telemetry', () => {
  it('should log translation events gracefully in memory fallback mode', async () => {
    const event = await analyticsService.logEvent({
      sessionId: 'test-session-123',
      wikiUser: 'TestEditor',
      eventType: 'translate',
      sourceLang: 'en',
      targetLang: 'or',
      sourceTitle: 'Marie Curie',
      targetTitle: 'ମ୍ୟାରୀ କ୍ୟୁରୀ',
      wordCount: 150,
      charCount: 950,
      sectionCount: 4,
      mtEngine: 'google',
    });

    expect(event).toBeDefined();
    expect(event.eventType).toBe('translate');
    expect(event.targetLang).toBe('or');
    expect(event.wordCount).toBe(150);
  });

  it('should record copy, export, and publish events', async () => {
    await analyticsService.logEvent({
      eventType: 'copy',
      sourceLang: 'en',
      targetLang: 'or',
      sourceTitle: 'Albert Einstein',
      wordCount: 200,
    });

    await analyticsService.logEvent({
      eventType: 'export',
      sourceLang: 'en',
      targetLang: 'bn',
      sourceTitle: 'Isaac Newton',
      wordCount: 500,
    });

    await analyticsService.logEvent({
      eventType: 'publish',
      wikiUser: 'Jnanaranjan_sahu',
      sourceLang: 'en',
      targetLang: 'or',
      sourceTitle: 'Subhas Chandra Bose',
      targetTitle: 'ସୁଭାଷ ଚନ୍ଦ୍ର ବୋଷ',
      targetNamespace: 'mainspace',
      revisionId: 987654321,
      wordCount: 1200,
      mtEngine: 'google',
    });

    const summary = await analyticsService.getStatsSummary();
    expect(summary).toBeDefined();
    expect(summary.totals).toBeDefined();
    expect(summary.topContributors).toBeDefined();
    expect(Array.isArray(summary.topContributors)).toBe(true);

    const recent = await analyticsService.getRecentEvents(10);
    expect(recent.length).toBeGreaterThanOrEqual(3);
    const publishEvent = recent.find(e => e.eventType === 'publish');
    expect(publishEvent).toBeDefined();
    expect(publishEvent.revisionId).toBe(987654321);

    // Test legacy user filter
    const userEvents = await analyticsService.getRecentEvents(10, 'Jnanaranjan_sahu');
    expect(userEvents.every(e => e.wikiUser === 'Jnanaranjan_sahu')).toBe(true);
  });

  it('should paginate and sort analytics events correctly', async () => {
    // Query with options object: page 1, limit 2
    const page1 = await analyticsService.getRecentEvents({
      page: 1,
      limit: 2,
    });

    expect(page1.length).toBeLessThanOrEqual(2);
    expect(page1.page).toBe(1);
    expect(page1.limit).toBe(2);
    expect(page1.total).toBeGreaterThanOrEqual(3);
    expect(page1.totalPages).toBeGreaterThanOrEqual(2);

    // Query page 2
    const page2 = await analyticsService.getRecentEvents({
      page: 2,
      limit: 2,
    });

    expect(page2.page).toBe(2);
    expect(page2.length).toBeGreaterThanOrEqual(1);

    // Test sorting by wordCount desc
    const sortedDesc = await analyticsService.getRecentEvents({
      sortBy: 'wordCount',
      sortOrder: 'desc',
      limit: 10,
    });
    for (let i = 0; i < sortedDesc.length - 1; i++) {
      expect(Number(sortedDesc[i].wordCount || 0)).toBeGreaterThanOrEqual(Number(sortedDesc[i + 1].wordCount || 0));
    }

    // Test sorting by wordCount asc
    const sortedAsc = await analyticsService.getRecentEvents({
      sortBy: 'wordCount',
      sortOrder: 'asc',
      limit: 10,
    });
    for (let i = 0; i < sortedAsc.length - 1; i++) {
      expect(Number(sortedAsc[i].wordCount || 0)).toBeLessThanOrEqual(Number(sortedAsc[i + 1].wordCount || 0));
    }
  });

  it('should filter events by target language and search query', async () => {
    // Filter by targetLang: 'bn'
    const bnEvents = await analyticsService.getRecentEvents({
      targetLang: 'bn',
      limit: 10,
    });
    expect(bnEvents.length).toBeGreaterThanOrEqual(1);
    expect(bnEvents.every(e => e.targetLang === 'bn')).toBe(true);

    // Search query: 'Newton'
    const searchEvents = await analyticsService.getRecentEvents({
      search: 'Newton',
      limit: 10,
    });
    expect(searchEvents.length).toBeGreaterThanOrEqual(1);
    expect(searchEvents[0].sourceTitle).toContain('Newton');
  });

  it('should provide comprehensive contributor details via getUserDetails', async () => {
    const details = await analyticsService.getUserDetails('Jnanaranjan_sahu');
    expect(details).toBeDefined();
    expect(details.username).toBe('Jnanaranjan_sahu');
    expect(details.totals).toBeDefined();
    expect(details.totals.publishes).toBeGreaterThanOrEqual(1);
    expect(details.totals.totalWords).toBeGreaterThanOrEqual(1200);

    // Language pairs
    expect(Array.isArray(details.languagePairs)).toBe(true);
    expect(details.languagePairs.length).toBeGreaterThanOrEqual(1);
    const orPair = details.languagePairs.find(p => p.targetLang === 'or');
    expect(orPair).toBeDefined();

    // MT Engines
    expect(Array.isArray(details.mtEngines)).toBe(true);

    // Recent articles
    expect(Array.isArray(details.recentArticles)).toBe(true);
    expect(details.recentArticles.length).toBeGreaterThanOrEqual(1);
    const pubArticle = details.recentArticles.find(a => a.revisionId === 987654321);
    expect(pubArticle).toBeDefined();
    expect(pubArticle.diffUrl).toContain('diff=987654321');
  });
});
