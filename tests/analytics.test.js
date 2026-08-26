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
    });

    await analyticsService.logEvent({
      eventType: 'export',
      sourceLang: 'en',
      targetLang: 'bn',
      sourceTitle: 'Isaac Newton',
    });

    await analyticsService.logEvent({
      eventType: 'publish',
      wikiUser: 'Jnanaranjan_sahu',
      sourceLang: 'en',
      targetLang: 'or',
      sourceTitle: 'Subhas Chandra Bose',
      targetNamespace: 'mainspace',
      revisionId: 987654321,
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

    // Test user filter
    const userEvents = await analyticsService.getRecentEvents(10, 'Jnanaranjan_sahu');
    expect(userEvents.every(e => e.wikiUser === 'Jnanaranjan_sahu')).toBe(true);
  });
});
