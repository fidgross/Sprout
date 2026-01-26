import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ContentWithSummary } from '@curator/shared';

interface ContentCardProps {
  content: ContentWithSummary;
  onPress: () => void;
  onSave: () => void;
  onDismiss: () => void;
}

const SOURCE_ICONS: Record<string, string> = {
  podcast: 'mic',
  newsletter: 'mail',
  youtube: 'logo-youtube',
  blog: 'document-text',
};

export function ContentCard({
  content,
  onPress,
  onSave,
  onDismiss,
}: ContentCardProps) {
  const [expanded, setExpanded] = useState(false);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  };

  const isSaved = content.user_content?.status === 'saved';
  const sourceIcon = SOURCE_ICONS[content.source.type] || 'document';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.8}
      accessibilityLabel={`${content.source.name}: ${content.summary?.headline || content.title}`}
      accessibilityHint={expanded ? "Tap to collapse" : "Tap to expand takeaways"}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.sourceInfo}>
          <Ionicons name={sourceIcon as any} size={16} color="#64748b" />
          <Text style={styles.sourceName}>{content.source.name}</Text>
        </View>
        {content.duration_seconds && (
          <Text style={styles.duration}>
            {formatDuration(content.duration_seconds)}
          </Text>
        )}
      </View>

      {/* Headline */}
      <Text style={styles.headline}>
        {content.summary?.headline || content.title}
      </Text>

      {/* Expanded: Takeaways */}
      {expanded && content.summary?.takeaways && (
        <View style={styles.takeaways}>
          {content.summary.takeaways.map((takeaway, index) => (
            <View key={index} style={styles.takeawayRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.takeawayText}>{takeaway}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={(e) => {
            e.stopPropagation();
            onSave();
          }}
          accessibilityLabel={isSaved ? "Remove from saved" : "Save for later"}
          accessibilityRole="button"
        >
          <Ionicons
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={isSaved ? '#3b82f6' : '#64748b'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={onPress}
          accessibilityLabel={expanded ? "Read full summary" : "See more details"}
          accessibilityRole="button"
        >
          <Text style={styles.readMore}>
            {expanded ? 'Read full summary' : 'See more'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#3b82f6" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          accessibilityLabel="Dismiss this content"
          accessibilityRole="button"
        >
          <Ionicons name="close-circle-outline" size={20} color="#64748b" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sourceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sourceName: {
    fontSize: 14,
    color: '#64748b',
  },
  duration: {
    fontSize: 12,
    color: '#64748b',
  },
  headline: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 24,
  },
  takeaways: {
    marginTop: 16,
    gap: 8,
  },
  takeawayRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bullet: {
    color: '#3b82f6',
    fontSize: 16,
  },
  takeawayText: {
    flex: 1,
    fontSize: 15,
    color: '#cbd5e1',
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  readMore: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
});
