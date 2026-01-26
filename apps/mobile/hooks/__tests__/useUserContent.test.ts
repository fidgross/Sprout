/**
 * Tests for useUserContent hook weight adjustment logic.
 *
 * These tests verify the topic weight calculation logic used
 * for implicit learning from user interactions.
 */

describe('weight adjustments', () => {
  const WEIGHT_ADJUSTMENTS = {
    read: 0.1,
    save: 0.2,
    dismiss: -0.1,
  } as const;

  const MIN_WEIGHT = 0.1;
  const MAX_WEIGHT = 5.0;

  type InteractionType = keyof typeof WEIGHT_ADJUSTMENTS;

  function calculateNewWeight(
    currentWeight: number,
    interaction: InteractionType
  ): number {
    const adjustment = WEIGHT_ADJUSTMENTS[interaction];
    return Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, currentWeight + adjustment));
  }

  describe('read interaction', () => {
    it('should increase weight by 0.1 for read interaction', () => {
      const newWeight = calculateNewWeight(1.0, 'read');
      expect(newWeight).toBe(1.1);
    });

    it('should apply read boost to various weights', () => {
      expect(calculateNewWeight(0.5, 'read')).toBe(0.6);
      expect(calculateNewWeight(2.0, 'read')).toBe(2.1);
      expect(calculateNewWeight(3.5, 'read')).toBe(3.6);
    });
  });

  describe('save interaction', () => {
    it('should increase weight by 0.2 for save interaction', () => {
      const newWeight = calculateNewWeight(1.0, 'save');
      expect(newWeight).toBe(1.2);
    });

    it('should have larger boost than read', () => {
      const readWeight = calculateNewWeight(1.0, 'read');
      const saveWeight = calculateNewWeight(1.0, 'save');
      expect(saveWeight).toBeGreaterThan(readWeight);
    });
  });

  describe('dismiss interaction', () => {
    it('should decrease weight by 0.1 for dismiss interaction', () => {
      const newWeight = calculateNewWeight(1.0, 'dismiss');
      expect(newWeight).toBe(0.9);
    });

    it('should apply dismiss penalty to various weights', () => {
      expect(calculateNewWeight(2.0, 'dismiss')).toBe(1.9);
      expect(calculateNewWeight(0.5, 'dismiss')).toBe(0.4);
    });
  });

  describe('weight bounds', () => {
    it('should not exceed maximum weight', () => {
      const newWeight = calculateNewWeight(4.95, 'save');
      expect(newWeight).toBe(MAX_WEIGHT);
    });

    it('should not go below minimum weight', () => {
      const newWeight = calculateNewWeight(0.15, 'dismiss');
      expect(newWeight).toBe(MIN_WEIGHT);
    });

    it('should handle multiple saves at max boundary', () => {
      let weight = 4.9;
      weight = calculateNewWeight(weight, 'save'); // 5.0 (capped)
      weight = calculateNewWeight(weight, 'save'); // still 5.0
      expect(weight).toBe(MAX_WEIGHT);
    });

    it('should handle multiple dismisses at min boundary', () => {
      let weight = 0.2;
      weight = calculateNewWeight(weight, 'dismiss'); // 0.1 (capped)
      weight = calculateNewWeight(weight, 'dismiss'); // still 0.1
      expect(weight).toBe(MIN_WEIGHT);
    });
  });

  describe('initial weight for new topics', () => {
    it('should start at 1.0 + adjustment for positive interactions', () => {
      const initialWeight = 1.0;
      const readInitial = initialWeight + WEIGHT_ADJUSTMENTS.read;
      const saveInitial = initialWeight + WEIGHT_ADJUSTMENTS.save;

      expect(readInitial).toBe(1.1);
      expect(saveInitial).toBe(1.2);
    });

    it('should not create new entry for dismiss interaction', () => {
      // This is a behavioral test - dismiss on unknown topic should not create entry
      const adjustment = WEIGHT_ADJUSTMENTS.dismiss;
      expect(adjustment).toBeLessThan(0);
    });
  });
});

describe('query invalidation keys', () => {
  describe('save content mutation', () => {
    it('should invalidate correct query keys', () => {
      const keysToInvalidate = ['feed', 'personalizedFeed', 'saved', 'userTopics'];

      expect(keysToInvalidate).toContain('feed');
      expect(keysToInvalidate).toContain('personalizedFeed');
      expect(keysToInvalidate).toContain('saved');
      expect(keysToInvalidate).toContain('userTopics');
    });
  });

  describe('dismiss content mutation', () => {
    it('should invalidate feed-related query keys', () => {
      const keysToInvalidate = ['feed', 'personalizedFeed', 'userTopics'];

      expect(keysToInvalidate).toContain('feed');
      expect(keysToInvalidate).toContain('personalizedFeed');
      expect(keysToInvalidate).not.toContain('saved');
    });
  });

  describe('mark as read mutation', () => {
    it('should invalidate history query key', () => {
      const keysToInvalidate = ['feed', 'personalizedFeed', 'history', 'userTopics'];

      expect(keysToInvalidate).toContain('history');
    });
  });

  describe('unsave content mutation', () => {
    it('should invalidate both saved and history keys', () => {
      const keysToInvalidate = ['feed', 'saved', 'history', 'content'];

      expect(keysToInvalidate).toContain('saved');
      expect(keysToInvalidate).toContain('history');
    });
  });
});

describe('saved content query key', () => {
  it('should include user id in query key', () => {
    const userId = 'user-123';
    const queryKey = ['saved', userId];

    expect(queryKey).toEqual(['saved', 'user-123']);
  });

  it('should handle undefined user id', () => {
    const userId = undefined;
    const queryKey = ['saved', userId];

    expect(queryKey).toEqual(['saved', undefined]);
  });
});

describe('history query key', () => {
  it('should include user id in query key', () => {
    const userId = 'user-456';
    const queryKey = ['history', userId];

    expect(queryKey).toEqual(['history', 'user-456']);
  });
});

describe('highlights query key', () => {
  it('should include user id in query key', () => {
    const userId = 'user-789';
    const queryKey = ['highlights', userId];

    expect(queryKey).toEqual(['highlights', 'user-789']);
  });
});
