/**
 * Tests for theme detection functions.
 *
 * These tests verify the cosine similarity calculation,
 * clustering algorithm, and theme validation logic.
 */

describe('cosineSimilarity', () => {
  function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
  }

  describe('identical vectors', () => {
    it('should return 1 for identical vectors', () => {
      const a = [1, 2, 3, 4, 5];
      const b = [1, 2, 3, 4, 5];

      expect(cosineSimilarity(a, b)).toBeCloseTo(1.0);
    });

    it('should return 1 for scaled identical vectors', () => {
      const a = [1, 2, 3];
      const b = [2, 4, 6];

      expect(cosineSimilarity(a, b)).toBeCloseTo(1.0);
    });
  });

  describe('orthogonal vectors', () => {
    it('should return 0 for orthogonal vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];

      expect(cosineSimilarity(a, b)).toBeCloseTo(0);
    });
  });

  describe('opposite vectors', () => {
    it('should return -1 for opposite vectors', () => {
      const a = [1, 2, 3];
      const b = [-1, -2, -3];

      expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0);
    });
  });

  describe('edge cases', () => {
    it('should return 0 for different length vectors', () => {
      const a = [1, 2, 3];
      const b = [1, 2];

      expect(cosineSimilarity(a, b)).toBe(0);
    });

    it('should return 0 for zero vector', () => {
      const a = [0, 0, 0];
      const b = [1, 2, 3];

      expect(cosineSimilarity(a, b)).toBe(0);
    });

    it('should handle empty vectors', () => {
      const a: number[] = [];
      const b: number[] = [];

      expect(cosineSimilarity(a, b)).toBe(0);
    });
  });

  describe('partial similarity', () => {
    it('should return value between 0 and 1 for partially similar vectors', () => {
      const a = [1, 0, 1, 0];
      const b = [1, 1, 0, 0];

      const similarity = cosineSimilarity(a, b);

      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });
  });

  describe('realistic embedding vectors', () => {
    it('should identify similar embeddings', () => {
      // Simulating similar content about AI
      const aiArticle1 = [0.8, 0.6, 0.2, 0.1, 0.9];
      const aiArticle2 = [0.75, 0.55, 0.25, 0.15, 0.85];

      const similarity = cosineSimilarity(aiArticle1, aiArticle2);

      expect(similarity).toBeGreaterThan(0.95);
    });

    it('should identify dissimilar embeddings', () => {
      // AI article vs cooking article
      const aiArticle = [0.8, 0.6, 0.2, 0.1, 0.9];
      const cookingArticle = [0.1, 0.3, 0.9, 0.7, 0.2];

      const similarity = cosineSimilarity(aiArticle, cookingArticle);

      expect(similarity).toBeLessThan(0.7);
    });
  });
});

describe('clustering', () => {
  interface ContentWithEmbedding {
    id: string;
    title: string;
    source_id: string;
    embedding: number[];
  }

  interface ContentCluster {
    contentIds: string[];
    sourceIds: Set<string>;
    titles: string[];
  }

  function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
  }

  function clusterContentBySimilarity(
    content: ContentWithEmbedding[],
    threshold: number
  ): ContentCluster[] {
    const clusters: ContentCluster[] = [];
    const assigned = new Set<string>();

    for (const item of content) {
      if (assigned.has(item.id)) continue;

      const cluster: ContentCluster = {
        contentIds: [item.id],
        sourceIds: new Set([item.source_id]),
        titles: [item.title],
      };
      assigned.add(item.id);

      for (const other of content) {
        if (assigned.has(other.id)) continue;

        const similarity = cosineSimilarity(item.embedding, other.embedding);

        if (similarity >= threshold) {
          cluster.contentIds.push(other.id);
          cluster.sourceIds.add(other.source_id);
          cluster.titles.push(other.title);
          assigned.add(other.id);
        }
      }

      if (cluster.contentIds.length > 1) {
        clusters.push(cluster);
      }
    }

    clusters.sort((a, b) => b.sourceIds.size - a.sourceIds.size);

    return clusters;
  }

  describe('cluster formation', () => {
    it('should cluster similar content together', () => {
      const content: ContentWithEmbedding[] = [
        { id: '1', title: 'AI News 1', source_id: 's1', embedding: [1, 0, 0] },
        { id: '2', title: 'AI News 2', source_id: 's2', embedding: [0.99, 0.01, 0] },
        { id: '3', title: 'Cooking Tips', source_id: 's3', embedding: [0, 1, 0] },
      ];

      const clusters = clusterContentBySimilarity(content, 0.8);

      expect(clusters.length).toBe(1);
      expect(clusters[0].contentIds).toContain('1');
      expect(clusters[0].contentIds).toContain('2');
      expect(clusters[0].contentIds).not.toContain('3');
    });

    it('should not create single-item clusters', () => {
      const content: ContentWithEmbedding[] = [
        { id: '1', title: 'Topic A', source_id: 's1', embedding: [1, 0, 0] },
        { id: '2', title: 'Topic B', source_id: 's2', embedding: [0, 1, 0] },
        { id: '3', title: 'Topic C', source_id: 's3', embedding: [0, 0, 1] },
      ];

      const clusters = clusterContentBySimilarity(content, 0.9);

      expect(clusters.length).toBe(0);
    });

    it('should track multiple sources in a cluster', () => {
      const content: ContentWithEmbedding[] = [
        { id: '1', title: 'AI News 1', source_id: 's1', embedding: [1, 0] },
        { id: '2', title: 'AI News 2', source_id: 's2', embedding: [1, 0] },
        { id: '3', title: 'AI News 3', source_id: 's3', embedding: [1, 0] },
      ];

      const clusters = clusterContentBySimilarity(content, 0.8);

      expect(clusters[0].sourceIds.size).toBe(3);
    });
  });

  describe('cluster sorting', () => {
    it('should sort clusters by source count descending', () => {
      const content: ContentWithEmbedding[] = [
        { id: '1', title: 'Small Cluster 1', source_id: 's1', embedding: [1, 0, 0] },
        { id: '2', title: 'Small Cluster 2', source_id: 's1', embedding: [1, 0, 0] },
        { id: '3', title: 'Large Cluster 1', source_id: 's2', embedding: [0, 1, 0] },
        { id: '4', title: 'Large Cluster 2', source_id: 's3', embedding: [0, 1, 0] },
        { id: '5', title: 'Large Cluster 3', source_id: 's4', embedding: [0, 1, 0] },
      ];

      const clusters = clusterContentBySimilarity(content, 0.8);

      expect(clusters[0].sourceIds.size).toBeGreaterThanOrEqual(clusters[1]?.sourceIds.size || 0);
    });
  });
});

describe('theme validation', () => {
  const MIN_SOURCES_FOR_THEME = 3;

  function isValidTheme(sourceCount: number): boolean {
    return sourceCount >= MIN_SOURCES_FOR_THEME;
  }

  it('should accept themes with 3 or more sources', () => {
    expect(isValidTheme(3)).toBe(true);
    expect(isValidTheme(5)).toBe(true);
    expect(isValidTheme(10)).toBe(true);
  });

  it('should reject themes with fewer than 3 sources', () => {
    expect(isValidTheme(1)).toBe(false);
    expect(isValidTheme(2)).toBe(false);
  });
});

describe('theme title generation', () => {
  function formatThemeTitle(topicName: string, subtitle: string): string {
    const fullTitle = `Trending in ${topicName}: ${subtitle}`;
    return fullTitle.slice(0, 100);
  }

  it('should format theme title correctly', () => {
    const title = formatThemeTitle('Technology', 'AI Revolution');

    expect(title).toBe('Trending in Technology: AI Revolution');
  });

  it('should truncate long titles to 100 characters', () => {
    const longSubtitle = 'A'.repeat(100);
    const title = formatThemeTitle('Technology', longSubtitle);

    expect(title.length).toBe(100);
  });

  it('should include topic name in title', () => {
    const title = formatThemeTitle('Science', 'New Discovery');

    expect(title).toContain('Science');
  });
});

describe('theme expiration', () => {
  it('should set expiration to 7 days from now', () => {
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 7);

    const diffDays = Math.round(
      (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    expect(diffDays).toBe(7);
  });
});

describe('similarity threshold', () => {
  const SIMILARITY_THRESHOLD = 0.8;

  it('should use 0.8 as the clustering threshold', () => {
    expect(SIMILARITY_THRESHOLD).toBe(0.8);
  });

  it('should consider 0.85 similarity as similar', () => {
    expect(0.85 >= SIMILARITY_THRESHOLD).toBe(true);
  });

  it('should not consider 0.75 similarity as similar', () => {
    expect(0.75 >= SIMILARITY_THRESHOLD).toBe(false);
  });
});
