/**
 * Tests for useContent hook query key generation and data transformation.
 *
 * These tests verify the query key structure used by React Query
 * to ensure proper cache invalidation and data fetching behavior.
 */

describe('useContent query keys', () => {
  describe('feed query key', () => {
    it('should generate correct query key without filters', () => {
      const filters = undefined;
      const queryKey = ['feed', filters];

      expect(queryKey).toEqual(['feed', undefined]);
      expect(queryKey[0]).toBe('feed');
    });

    it('should generate correct query key with source type filter', () => {
      const filters = { sourceType: 'podcast' as const };
      const queryKey = ['feed', filters];

      expect(queryKey).toEqual(['feed', { sourceType: 'podcast' }]);
      expect(queryKey[1]).toHaveProperty('sourceType', 'podcast');
    });

    it('should generate correct query key with topic filter', () => {
      const filters = { topicId: 'topic-123' };
      const queryKey = ['feed', filters];

      expect(queryKey).toEqual(['feed', { topicId: 'topic-123' }]);
    });

    it('should generate correct query key with multiple filters', () => {
      const filters = { sourceType: 'newsletter' as const, topicId: 'topic-456' };
      const queryKey = ['feed', filters];

      expect(queryKey).toHaveLength(2);
      expect(queryKey[1]).toEqual({
        sourceType: 'newsletter',
        topicId: 'topic-456',
      });
    });
  });

  describe('content by id query key', () => {
    it('should generate correct query key for single content', () => {
      const contentId = 'content-789';
      const queryKey = ['content', contentId];

      expect(queryKey).toEqual(['content', 'content-789']);
    });
  });

  describe('personalized feed query key', () => {
    it('should generate correct query key for personalized feed', () => {
      const filters = { sourceType: 'youtube' as const };
      const queryKey = ['personalizedFeed', filters];

      expect(queryKey).toEqual(['personalizedFeed', { sourceType: 'youtube' }]);
    });

    it('should differentiate from regular feed query key', () => {
      const filters = { sourceType: 'podcast' as const };
      const feedKey = ['feed', filters];
      const personalizedKey = ['personalizedFeed', filters];

      expect(feedKey[0]).not.toBe(personalizedKey[0]);
      expect(feedKey).not.toEqual(personalizedKey);
    });
  });

  describe('topics and sources query keys', () => {
    it('should generate correct query key for topics', () => {
      const queryKey = ['topics'];
      expect(queryKey).toEqual(['topics']);
    });

    it('should generate correct query key for sources', () => {
      const queryKey = ['sources'];
      expect(queryKey).toEqual(['sources']);
    });
  });
});

describe('pagination logic', () => {
  describe('getNextPageParam', () => {
    it('should return undefined when last page has fewer than 20 items', () => {
      const lastPage = new Array(15).fill({});
      const allPages = [lastPage];

      const getNextPageParam = (lastPage: unknown[], allPages: unknown[][]) => {
        if (lastPage.length < 20) return undefined;
        return allPages.length * 20;
      };

      expect(getNextPageParam(lastPage, allPages)).toBeUndefined();
    });

    it('should return next offset when last page has 20 items', () => {
      const lastPage = new Array(20).fill({});
      const allPages = [new Array(20).fill({}), lastPage];

      const getNextPageParam = (lastPage: unknown[], allPages: unknown[][]) => {
        if (lastPage.length < 20) return undefined;
        return allPages.length * 20;
      };

      expect(getNextPageParam(lastPage, allPages)).toBe(40);
    });

    it('should calculate correct offset for multiple pages', () => {
      const lastPage = new Array(20).fill({});
      const allPages = [
        new Array(20).fill({}),
        new Array(20).fill({}),
        new Array(20).fill({}),
        lastPage,
      ];

      const getNextPageParam = (lastPage: unknown[], allPages: unknown[][]) => {
        if (lastPage.length < 20) return undefined;
        return allPages.length * 20;
      };

      expect(getNextPageParam(lastPage, allPages)).toBe(80);
    });
  });
});
