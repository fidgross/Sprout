/**
 * Tests for TopicPicker component.
 *
 * These tests verify the rendering logic, selection state,
 * and accessibility attributes for the TopicPicker component.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TopicPicker } from '../TopicPicker';

// Mock the useTopics hook
jest.mock('../../hooks/useContent', () => ({
  useTopics: jest.fn(),
}));

// Mock the Ionicons component
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

import { useTopics } from '../../hooks/useContent';

const mockTopics = [
  { id: 'topic-1', name: 'Technology', icon: '💻', is_system: true, created_at: '2024-01-01' },
  { id: 'topic-2', name: 'Business', icon: '💼', is_system: true, created_at: '2024-01-01' },
  { id: 'topic-3', name: 'Science', icon: '🔬', is_system: true, created_at: '2024-01-01' },
  { id: 'topic-4', name: 'Health', icon: '🏥', is_system: true, created_at: '2024-01-01' },
];

describe('TopicPicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading message when data is loading', () => {
      (useTopics as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: true,
      });

      const { getByText } = render(
        <TopicPicker selectedTopicIds={[]} onToggle={jest.fn()} />
      );

      expect(getByText('Loading topics...')).toBeTruthy();
    });
  });

  describe('rendering topics', () => {
    beforeEach(() => {
      (useTopics as jest.Mock).mockReturnValue({
        data: mockTopics,
        isLoading: false,
      });
    });

    it('renders all topics', () => {
      const { getByText } = render(
        <TopicPicker selectedTopicIds={[]} onToggle={jest.fn()} />
      );

      expect(getByText('Technology')).toBeTruthy();
      expect(getByText('Business')).toBeTruthy();
      expect(getByText('Science')).toBeTruthy();
      expect(getByText('Health')).toBeTruthy();
    });

    it('renders topic icons', () => {
      const { getByText } = render(
        <TopicPicker selectedTopicIds={[]} onToggle={jest.fn()} />
      );

      expect(getByText('💻')).toBeTruthy();
      expect(getByText('💼')).toBeTruthy();
      expect(getByText('🔬')).toBeTruthy();
      expect(getByText('🏥')).toBeTruthy();
    });

    it('uses default icon when topic has no icon', () => {
      const topicsWithoutIcon = [
        { id: 'topic-1', name: 'No Icon Topic', icon: null, is_system: true, created_at: '2024-01-01' },
      ];

      (useTopics as jest.Mock).mockReturnValue({
        data: topicsWithoutIcon,
        isLoading: false,
      });

      const { getByText } = render(
        <TopicPicker selectedTopicIds={[]} onToggle={jest.fn()} />
      );

      expect(getByText('📌')).toBeTruthy();
    });
  });

  describe('selection state', () => {
    beforeEach(() => {
      (useTopics as jest.Mock).mockReturnValue({
        data: mockTopics,
        isLoading: false,
      });
    });

    it('shows unselected state for topics not in selectedTopicIds', () => {
      const { getByLabelText } = render(
        <TopicPicker selectedTopicIds={[]} onToggle={jest.fn()} />
      );

      // Topic should not have "selected" in accessibility label
      expect(getByLabelText('Technology')).toBeTruthy();
    });

    it('shows selected state for topics in selectedTopicIds', () => {
      const { getByLabelText } = render(
        <TopicPicker selectedTopicIds={['topic-1']} onToggle={jest.fn()} />
      );

      expect(getByLabelText('Technology, selected')).toBeTruthy();
    });

    it('shows multiple selected topics', () => {
      const { getByLabelText } = render(
        <TopicPicker
          selectedTopicIds={['topic-1', 'topic-3']}
          onToggle={jest.fn()}
        />
      );

      expect(getByLabelText('Technology, selected')).toBeTruthy();
      expect(getByLabelText('Business')).toBeTruthy();
      expect(getByLabelText('Science, selected')).toBeTruthy();
      expect(getByLabelText('Health')).toBeTruthy();
    });
  });

  describe('interactions', () => {
    beforeEach(() => {
      (useTopics as jest.Mock).mockReturnValue({
        data: mockTopics,
        isLoading: false,
      });
    });

    it('calls onToggle with topic id when topic is pressed', () => {
      const onToggle = jest.fn();

      const { getByText } = render(
        <TopicPicker selectedTopicIds={[]} onToggle={onToggle} />
      );

      fireEvent.press(getByText('Technology'));

      expect(onToggle).toHaveBeenCalledWith('topic-1');
    });

    it('calls onToggle to deselect when selected topic is pressed', () => {
      const onToggle = jest.fn();

      const { getByLabelText } = render(
        <TopicPicker selectedTopicIds={['topic-2']} onToggle={onToggle} />
      );

      fireEvent.press(getByLabelText('Business, selected'));

      expect(onToggle).toHaveBeenCalledWith('topic-2');
    });

    it('allows selecting multiple topics in multi-select mode', () => {
      const onToggle = jest.fn();

      const { getByText } = render(
        <TopicPicker
          selectedTopicIds={['topic-1']}
          onToggle={onToggle}
          multiSelect={true}
        />
      );

      fireEvent.press(getByText('Science'));

      expect(onToggle).toHaveBeenCalledWith('topic-3');
    });
  });

  describe('accessibility', () => {
    beforeEach(() => {
      (useTopics as jest.Mock).mockReturnValue({
        data: mockTopics,
        isLoading: false,
      });
    });

    it('has button role on topic cards', () => {
      const { getAllByRole } = render(
        <TopicPicker selectedTopicIds={[]} onToggle={jest.fn()} />
      );

      const buttons = getAllByRole('button');
      expect(buttons.length).toBe(4);
    });

    it('provides correct accessibility label for unselected topics', () => {
      const { getByLabelText } = render(
        <TopicPicker selectedTopicIds={[]} onToggle={jest.fn()} />
      );

      expect(getByLabelText('Technology')).toBeTruthy();
      expect(getByLabelText('Business')).toBeTruthy();
    });

    it('provides correct accessibility label for selected topics', () => {
      const { getByLabelText } = render(
        <TopicPicker selectedTopicIds={['topic-1', 'topic-2']} onToggle={jest.fn()} />
      );

      expect(getByLabelText('Technology, selected')).toBeTruthy();
      expect(getByLabelText('Business, selected')).toBeTruthy();
    });
  });
});

describe('keyExtractor', () => {
  it('extracts id from topic', () => {
    const topic = { id: 'topic-123', name: 'Test' };
    const keyExtractor = (item: { id: string }) => item.id;

    expect(keyExtractor(topic)).toBe('topic-123');
  });
});

describe('selectedTopicIds array operations', () => {
  it('correctly checks if topic is selected using includes', () => {
    const selectedTopicIds = ['topic-1', 'topic-3', 'topic-5'];

    expect(selectedTopicIds.includes('topic-1')).toBe(true);
    expect(selectedTopicIds.includes('topic-2')).toBe(false);
    expect(selectedTopicIds.includes('topic-3')).toBe(true);
  });

  it('handles empty selection array', () => {
    const selectedTopicIds: string[] = [];

    expect(selectedTopicIds.includes('topic-1')).toBe(false);
  });
});
