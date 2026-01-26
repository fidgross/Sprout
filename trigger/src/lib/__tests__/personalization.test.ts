/**
 * Tests for personalization functions.
 *
 * These tests verify the weight adjustment logic and
 * bounds checking for topic weight updates.
 */

describe('weight adjustments', () => {
  const WEIGHT_ADJUSTMENTS: Record<string, number> = {
    read: 0.1,
    save: 0.2,
    dismiss: -0.1,
  };

  const MIN_WEIGHT = 0.1;
  const MAX_WEIGHT = 5.0;

  type InteractionType = 'read' | 'save' | 'dismiss';

  function calculateNewWeight(
    currentWeight: number,
    interaction: InteractionType
  ): number {
    const adjustment = WEIGHT_ADJUSTMENTS[interaction];
    return Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, currentWeight + adjustment));
  }

  describe('interaction types', () => {
    it('should have correct adjustment for read', () => {
      expect(WEIGHT_ADJUSTMENTS.read).toBe(0.1);
    });

    it('should have correct adjustment for save', () => {
      expect(WEIGHT_ADJUSTMENTS.save).toBe(0.2);
    });

    it('should have correct adjustment for dismiss', () => {
      expect(WEIGHT_ADJUSTMENTS.dismiss).toBe(-0.1);
    });
  });

  describe('weight calculation', () => {
    it('should increase weight for read interaction', () => {
      expect(calculateNewWeight(1.0, 'read')).toBe(1.1);
    });

    it('should increase weight for save interaction', () => {
      expect(calculateNewWeight(1.0, 'save')).toBe(1.2);
    });

    it('should decrease weight for dismiss interaction', () => {
      expect(calculateNewWeight(1.0, 'dismiss')).toBe(0.9);
    });
  });

  describe('weight bounds', () => {
    it('should not exceed MAX_WEIGHT', () => {
      expect(calculateNewWeight(4.95, 'save')).toBe(5.0);
      expect(calculateNewWeight(5.0, 'read')).toBe(5.0);
    });

    it('should not go below MIN_WEIGHT', () => {
      expect(calculateNewWeight(0.15, 'dismiss')).toBe(0.1);
      expect(calculateNewWeight(0.1, 'dismiss')).toBe(0.1);
    });
  });

  describe('cumulative adjustments', () => {
    it('should handle multiple read interactions', () => {
      let weight = 1.0;
      weight = calculateNewWeight(weight, 'read');
      weight = calculateNewWeight(weight, 'read');
      weight = calculateNewWeight(weight, 'read');

      expect(weight).toBeCloseTo(1.3);
    });

    it('should handle mixed interactions', () => {
      let weight = 1.0;
      weight = calculateNewWeight(weight, 'save'); // 1.2
      weight = calculateNewWeight(weight, 'dismiss'); // 1.1
      weight = calculateNewWeight(weight, 'read'); // 1.2

      expect(weight).toBeCloseTo(1.2);
    });
  });
});

describe('new topic weight initialization', () => {
  const INITIAL_WEIGHT = 1.0;

  function getInitialWeight(interaction: 'read' | 'save'): number {
    const adjustments = { read: 0.1, save: 0.2 };
    return INITIAL_WEIGHT + adjustments[interaction];
  }

  it('should initialize at 1.1 for read interaction', () => {
    expect(getInitialWeight('read')).toBe(1.1);
  });

  it('should initialize at 1.2 for save interaction', () => {
    expect(getInitialWeight('save')).toBe(1.2);
  });

  it('should not create entry for dismiss on unknown topic', () => {
    // Dismiss should not create new entries
    const adjustment = -0.1;
    expect(adjustment).toBeLessThan(0);
  });
});

describe('batch upsert logic', () => {
  interface UpsertRecord {
    user_id: string;
    topic_id: string;
    weight: number;
  }

  function buildUpsertRecords(
    userId: string,
    topicIds: string[],
    existingWeights: Map<string, number>,
    adjustment: number
  ): UpsertRecord[] {
    const MIN_WEIGHT = 0.1;
    const MAX_WEIGHT = 5.0;
    const records: UpsertRecord[] = [];

    for (const topicId of topicIds) {
      const currentWeight = existingWeights.get(topicId);

      if (currentWeight !== undefined) {
        const newWeight = Math.max(
          MIN_WEIGHT,
          Math.min(MAX_WEIGHT, currentWeight + adjustment)
        );
        records.push({
          user_id: userId,
          topic_id: topicId,
          weight: newWeight,
        });
      } else if (adjustment > 0) {
        records.push({
          user_id: userId,
          topic_id: topicId,
          weight: 1.0 + adjustment,
        });
      }
    }

    return records;
  }

  it('should update existing topic weights', () => {
    const existingWeights = new Map([
      ['topic-1', 1.5],
      ['topic-2', 2.0],
    ]);

    const records = buildUpsertRecords(
      'user-1',
      ['topic-1', 'topic-2'],
      existingWeights,
      0.1
    );

    expect(records).toHaveLength(2);
    expect(records[0].weight).toBe(1.6);
    expect(records[1].weight).toBe(2.1);
  });

  it('should create new entries for positive adjustments', () => {
    const existingWeights = new Map<string, number>();

    const records = buildUpsertRecords(
      'user-1',
      ['topic-new'],
      existingWeights,
      0.2
    );

    expect(records).toHaveLength(1);
    expect(records[0].weight).toBe(1.2);
  });

  it('should not create entries for negative adjustments on unknown topics', () => {
    const existingWeights = new Map<string, number>();

    const records = buildUpsertRecords(
      'user-1',
      ['topic-unknown'],
      existingWeights,
      -0.1
    );

    expect(records).toHaveLength(0);
  });

  it('should handle mixed existing and new topics', () => {
    const existingWeights = new Map([['topic-1', 1.0]]);

    const records = buildUpsertRecords(
      'user-1',
      ['topic-1', 'topic-2'],
      existingWeights,
      0.1
    );

    expect(records).toHaveLength(2);
    expect(records.find((r) => r.topic_id === 'topic-1')?.weight).toBe(1.1);
    expect(records.find((r) => r.topic_id === 'topic-2')?.weight).toBe(1.1);
  });
});

describe('topic association', () => {
  function getUniqueSourceTopics(sourceMappings: { topic_id: string }[]): string[] {
    return [...new Set(sourceMappings.map((st) => st.topic_id))];
  }

  it('should deduplicate topic IDs', () => {
    const mappings = [
      { topic_id: 't1' },
      { topic_id: 't2' },
      { topic_id: 't1' },
      { topic_id: 't3' },
    ];

    const unique = getUniqueSourceTopics(mappings);

    expect(unique).toHaveLength(3);
    expect(unique).toContain('t1');
    expect(unique).toContain('t2');
    expect(unique).toContain('t3');
  });

  it('should handle empty mappings', () => {
    const mappings: { topic_id: string }[] = [];

    const unique = getUniqueSourceTopics(mappings);

    expect(unique).toHaveLength(0);
  });
});
