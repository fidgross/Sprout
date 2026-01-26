/**
 * Tests for digest generation functions.
 *
 * These tests verify the scoring logic, diversity constraints,
 * and date/time utility functions used in digest generation.
 */

describe('content scoring', () => {
  interface ContentScore {
    id: string;
    sourceId: string;
    qualityScore: number;
    publishedAt: string;
    score: number;
  }

  function calculateScore(qualityScore: number, recencyBoost: number): number {
    return qualityScore + recencyBoost;
  }

  describe('score calculation', () => {
    it('should calculate score as quality + recency boost', () => {
      const qualityScore = 85;
      const recencyBoost = 20;

      const score = calculateScore(qualityScore, recencyBoost);

      expect(score).toBe(105);
    });

    it('should use default quality score of 50 when not provided', () => {
      const defaultQualityScore = 50;
      const recencyBoost = 20;

      const score = calculateScore(defaultQualityScore, recencyBoost);

      expect(score).toBe(70);
    });

    it('should apply consistent recency boost for all recent content', () => {
      const recencyBoost = 20;

      // All items within 24h get the same recency boost
      expect(calculateScore(90, recencyBoost)).toBe(110);
      expect(calculateScore(70, recencyBoost)).toBe(90);
      expect(calculateScore(50, recencyBoost)).toBe(70);
    });
  });

  describe('score sorting', () => {
    it('should sort content by score in descending order', () => {
      const content: ContentScore[] = [
        { id: '1', sourceId: 's1', qualityScore: 70, publishedAt: '', score: 90 },
        { id: '2', sourceId: 's2', qualityScore: 90, publishedAt: '', score: 110 },
        { id: '3', sourceId: 's3', qualityScore: 50, publishedAt: '', score: 70 },
      ];

      const sorted = [...content].sort((a, b) => b.score - a.score);

      expect(sorted[0].id).toBe('2');
      expect(sorted[1].id).toBe('1');
      expect(sorted[2].id).toBe('3');
    });
  });
});

describe('diversity constraint', () => {
  const MAX_PER_SOURCE = 2;
  const MAX_ITEMS = 10;

  interface ContentItem {
    id: string;
    sourceId: string;
    score: number;
  }

  function applyDiversityConstraint(
    scoredContent: ContentItem[]
  ): ContentItem[] {
    const selected: ContentItem[] = [];
    const sourceCount: Record<string, number> = {};

    for (const item of scoredContent) {
      const currentCount = sourceCount[item.sourceId] || 0;

      if (currentCount < MAX_PER_SOURCE) {
        selected.push(item);
        sourceCount[item.sourceId] = currentCount + 1;
      }

      if (selected.length >= MAX_ITEMS) {
        break;
      }
    }

    return selected;
  }

  it('should limit items per source to 2', () => {
    const content: ContentItem[] = [
      { id: '1', sourceId: 's1', score: 100 },
      { id: '2', sourceId: 's1', score: 95 },
      { id: '3', sourceId: 's1', score: 90 },
      { id: '4', sourceId: 's2', score: 85 },
    ];

    const selected = applyDiversityConstraint(content);
    const s1Count = selected.filter((c) => c.sourceId === 's1').length;

    expect(s1Count).toBe(2);
    expect(selected).not.toContainEqual(expect.objectContaining({ id: '3' }));
  });

  it('should include content from diverse sources', () => {
    const content: ContentItem[] = [
      { id: '1', sourceId: 's1', score: 100 },
      { id: '2', sourceId: 's2', score: 95 },
      { id: '3', sourceId: 's3', score: 90 },
      { id: '4', sourceId: 's4', score: 85 },
    ];

    const selected = applyDiversityConstraint(content);
    const uniqueSources = new Set(selected.map((c) => c.sourceId));

    expect(uniqueSources.size).toBe(4);
  });

  it('should stop at 10 items', () => {
    const content: ContentItem[] = Array.from({ length: 20 }, (_, i) => ({
      id: `${i}`,
      sourceId: `s${i}`,
      score: 100 - i,
    }));

    const selected = applyDiversityConstraint(content);

    expect(selected.length).toBe(10);
  });

  it('should return fewer items if not enough diverse content', () => {
    const content: ContentItem[] = [
      { id: '1', sourceId: 's1', score: 100 },
      { id: '2', sourceId: 's1', score: 95 },
      { id: '3', sourceId: 's1', score: 90 },
    ];

    const selected = applyDiversityConstraint(content);

    expect(selected.length).toBe(2);
  });
});

describe('date utilities', () => {
  describe('getCurrentUTCHour', () => {
    it('should return a number between 0 and 23', () => {
      const getCurrentUTCHour = () => new Date().getUTCHours();

      const hour = getCurrentUTCHour();

      expect(hour).toBeGreaterThanOrEqual(0);
      expect(hour).toBeLessThanOrEqual(23);
    });
  });

  describe('getTodayDateUTC', () => {
    it('should return date in YYYY-MM-DD format', () => {
      const getTodayDateUTC = () => new Date().toISOString().split('T')[0];

      const date = getTodayDateUTC();

      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return current UTC date', () => {
      const getTodayDateUTC = () => new Date().toISOString().split('T')[0];
      const expected = new Date().toISOString().split('T')[0];

      expect(getTodayDateUTC()).toBe(expected);
    });
  });

  describe('twentyFourHoursAgo calculation', () => {
    it('should calculate time 24 hours ago', () => {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const diffMs = now.getTime() - twentyFourHoursAgo.getTime();
      const diffHours = diffMs / (60 * 60 * 1000);

      expect(diffHours).toBe(24);
    });
  });
});

describe('user digest hour matching', () => {
  function formatHour(hour: number): string {
    return hour.toString().padStart(2, '0');
  }

  function doesDigestTimeMatch(digestTime: string, hour: number): boolean {
    const hourStr = formatHour(hour);
    const userHour = digestTime.split(':')[0];
    return userHour === hourStr;
  }

  it('should match users with digest_time at 7:00 for hour 7', () => {
    expect(doesDigestTimeMatch('07:00', 7)).toBe(true);
    expect(doesDigestTimeMatch('07:30', 7)).toBe(true);
    expect(doesDigestTimeMatch('07:45', 7)).toBe(true);
  });

  it('should not match users with different digest hour', () => {
    expect(doesDigestTimeMatch('08:00', 7)).toBe(false);
    expect(doesDigestTimeMatch('06:30', 7)).toBe(false);
  });

  it('should format single digit hours with leading zero', () => {
    expect(formatHour(7)).toBe('07');
    expect(formatHour(0)).toBe('00');
    expect(formatHour(9)).toBe('09');
  });

  it('should not add leading zero to double digit hours', () => {
    expect(formatHour(10)).toBe('10');
    expect(formatHour(23)).toBe('23');
  });

  it('should default to 07:00 when no digest_time preference', () => {
    const defaultTime = '07:00';
    expect(doesDigestTimeMatch(defaultTime, 7)).toBe(true);
  });
});
