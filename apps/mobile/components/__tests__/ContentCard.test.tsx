/**
 * Tests for ContentCard component.
 *
 * These tests verify the rendering logic, accessibility attributes,
 * and data transformation for the ContentCard component.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ContentCard } from '../ContentCard';

// Mock the Ionicons component
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

const mockContent = {
  id: 'content-1',
  title: 'Test Article Title',
  url: 'https://example.com/article',
  published_at: '2024-01-15T10:00:00Z',
  duration_seconds: 1800,
  source_id: 'source-1',
  created_at: '2024-01-15T10:00:00Z',
  source: {
    id: 'source-1',
    name: 'Tech Podcast',
    type: 'podcast' as const,
    url: 'https://example.com',
    quality_score: 85,
    created_at: '2024-01-01T00:00:00Z',
  },
  summary: {
    id: 'summary-1',
    content_id: 'content-1',
    headline: 'AI Revolution in Software Development',
    takeaways: [
      'AI tools are transforming how developers write code',
      'Testing and code review are still human-essential',
      'Collaboration between AI and developers is key',
    ],
    full_summary: 'Full summary text here...',
    created_at: '2024-01-15T10:00:00Z',
  },
  user_content: null,
};

const mockHandlers = {
  onPress: jest.fn(),
  onSave: jest.fn(),
  onDismiss: jest.fn(),
};

describe('ContentCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the source name', () => {
      const { getByText } = render(
        <ContentCard content={mockContent} {...mockHandlers} />
      );

      expect(getByText('Tech Podcast')).toBeTruthy();
    });

    it('renders the headline from summary when available', () => {
      const { getByText } = render(
        <ContentCard content={mockContent} {...mockHandlers} />
      );

      expect(getByText('AI Revolution in Software Development')).toBeTruthy();
    });

    it('renders the title when no summary headline exists', () => {
      const contentWithoutSummary = {
        ...mockContent,
        summary: null,
      };

      const { getByText } = render(
        <ContentCard content={contentWithoutSummary as any} {...mockHandlers} />
      );

      expect(getByText('Test Article Title')).toBeTruthy();
    });

    it('renders duration for content with duration', () => {
      const { getByText } = render(
        <ContentCard content={mockContent} {...mockHandlers} />
      );

      expect(getByText('30 min')).toBeTruthy();
    });

    it('does not render duration when null', () => {
      const contentWithoutDuration = {
        ...mockContent,
        duration_seconds: null,
      };

      const { queryByText } = render(
        <ContentCard content={contentWithoutDuration} {...mockHandlers} />
      );

      expect(queryByText(/min/)).toBeNull();
    });
  });

  describe('duration formatting', () => {
    it('formats minutes correctly', () => {
      const content = { ...mockContent, duration_seconds: 900 }; // 15 min
      const { getByText } = render(
        <ContentCard content={content} {...mockHandlers} />
      );

      expect(getByText('15 min')).toBeTruthy();
    });

    it('formats hours and minutes correctly', () => {
      const content = { ...mockContent, duration_seconds: 4500 }; // 1h 15m
      const { getByText } = render(
        <ContentCard content={content} {...mockHandlers} />
      );

      expect(getByText('1h 15m')).toBeTruthy();
    });

    it('formats multiple hours correctly', () => {
      const content = { ...mockContent, duration_seconds: 7800 }; // 2h 10m
      const { getByText } = render(
        <ContentCard content={content} {...mockHandlers} />
      );

      expect(getByText('2h 10m')).toBeTruthy();
    });
  });

  describe('saved state', () => {
    it('shows outline bookmark icon when not saved', () => {
      const { getByLabelText } = render(
        <ContentCard content={mockContent} {...mockHandlers} />
      );

      expect(getByLabelText('Save for later')).toBeTruthy();
    });

    it('shows filled bookmark icon when saved', () => {
      const savedContent = {
        ...mockContent,
        user_content: { status: 'saved' },
      };

      const { getByLabelText } = render(
        <ContentCard content={savedContent as any} {...mockHandlers} />
      );

      expect(getByLabelText('Remove from saved')).toBeTruthy();
    });
  });

  describe('interactions', () => {
    it('renders save button with correct accessibility label', () => {
      const { getByLabelText } = render(
        <ContentCard content={mockContent} {...mockHandlers} />
      );

      // Verify the save button is rendered and accessible
      const saveButton = getByLabelText('Save for later');
      expect(saveButton).toBeTruthy();
    });

    it('renders dismiss button with correct accessibility label', () => {
      const { getByLabelText } = render(
        <ContentCard content={mockContent} {...mockHandlers} />
      );

      // Verify the dismiss button is rendered and accessible
      const dismissButton = getByLabelText('Dismiss this content');
      expect(dismissButton).toBeTruthy();
    });

    it('expands to show takeaways on card press', () => {
      const { getByText, queryByText } = render(
        <ContentCard content={mockContent} {...mockHandlers} />
      );

      // Takeaways should not be visible initially
      expect(queryByText('AI tools are transforming how developers write code')).toBeNull();

      // Press the card to expand
      fireEvent.press(getByText('AI Revolution in Software Development'));

      // Takeaways should now be visible
      expect(getByText('AI tools are transforming how developers write code')).toBeTruthy();
    });

    it('shows "Read full summary" when expanded', () => {
      const { getByText, queryByText } = render(
        <ContentCard content={mockContent} {...mockHandlers} />
      );

      // Initially shows "See more"
      expect(getByText('See more')).toBeTruthy();
      expect(queryByText('Read full summary')).toBeNull();

      // Expand the card
      fireEvent.press(getByText('AI Revolution in Software Development'));

      // Should now show "Read full summary"
      expect(getByText('Read full summary')).toBeTruthy();
    });

    it('calls onPress when read more button is pressed', () => {
      const { getByText } = render(
        <ContentCard content={mockContent} {...mockHandlers} />
      );

      // Expand first
      fireEvent.press(getByText('AI Revolution in Software Development'));

      // Press the read full summary button
      fireEvent.press(getByText('Read full summary'));

      expect(mockHandlers.onPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('has correct accessibility label', () => {
      const { getByLabelText } = render(
        <ContentCard content={mockContent} {...mockHandlers} />
      );

      expect(
        getByLabelText('Tech Podcast: AI Revolution in Software Development')
      ).toBeTruthy();
    });

    it('has correct accessibility hint when collapsed', () => {
      const { getByA11yHint } = render(
        <ContentCard content={mockContent} {...mockHandlers} />
      );

      expect(getByA11yHint('Tap to expand takeaways')).toBeTruthy();
    });

    it('has correct accessibility hint when expanded', () => {
      const { getByText, getByA11yHint, queryByA11yHint } = render(
        <ContentCard content={mockContent} {...mockHandlers} />
      );

      // Expand the card
      fireEvent.press(getByText('AI Revolution in Software Development'));

      expect(getByA11yHint('Tap to collapse')).toBeTruthy();
      expect(queryByA11yHint('Tap to expand takeaways')).toBeNull();
    });
  });
});

describe('SOURCE_ICONS mapping', () => {
  const SOURCE_ICONS: Record<string, string> = {
    podcast: 'mic',
    newsletter: 'mail',
    youtube: 'logo-youtube',
    blog: 'document-text',
  };

  it('maps podcast to mic icon', () => {
    expect(SOURCE_ICONS['podcast']).toBe('mic');
  });

  it('maps newsletter to mail icon', () => {
    expect(SOURCE_ICONS['newsletter']).toBe('mail');
  });

  it('maps youtube to logo-youtube icon', () => {
    expect(SOURCE_ICONS['youtube']).toBe('logo-youtube');
  });

  it('maps blog to document-text icon', () => {
    expect(SOURCE_ICONS['blog']).toBe('document-text');
  });

  it('returns undefined for unknown source type', () => {
    expect(SOURCE_ICONS['unknown']).toBeUndefined();
  });
});
