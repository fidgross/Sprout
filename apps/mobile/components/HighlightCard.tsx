import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { HighlightWithContent } from '../hooks/useUserContent';

const SOURCE_ICONS: Record<string, string> = {
  podcast: 'mic',
  newsletter: 'mail',
  youtube: 'logo-youtube',
  blog: 'document-text',
};

interface HighlightCardProps {
  highlight: HighlightWithContent;
  onPress: () => void;
}

export function HighlightCard({ highlight, onPress }: HighlightCardProps) {
  const sourceIcon = SOURCE_ICONS[highlight.content.source.type] || 'document';

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityLabel={`Highlight from ${highlight.content.source.name}: ${highlight.text.substring(0, 50)}...`}
      accessibilityHint="Tap to view full content"
      accessibilityRole="button"
    >
      {/* Quote indicator */}
      <View style={styles.quoteBar} />

      {/* Highlight text */}
      <Text style={styles.highlightText} numberOfLines={4}>
        "{highlight.text}"
      </Text>

      {/* User note if present */}
      {highlight.note && (
        <View style={styles.noteContainer}>
          <Ionicons name="chatbubble-outline" size={14} color="#64748b" />
          <Text style={styles.noteText} numberOfLines={2}>
            {highlight.note}
          </Text>
        </View>
      )}

      {/* Source info */}
      <View style={styles.sourceInfo}>
        <Ionicons name={sourceIcon as any} size={14} color="#64748b" />
        <Text style={styles.sourceName} numberOfLines={1}>
          {highlight.content.source.name}
        </Text>
        <Text style={styles.separator}>-</Text>
        <Text style={styles.contentTitle} numberOfLines={1}>
          {highlight.content.title}
        </Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.date}>{formatDate(highlight.created_at)}</Text>
        <View style={styles.viewButton}>
          <Text style={styles.viewButtonText}>View</Text>
          <Ionicons name="chevron-forward" size={14} color="#3b82f6" />
        </View>
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
    position: 'relative',
    paddingLeft: 24,
  },
  quoteBar: {
    position: 'absolute',
    left: 12,
    top: 16,
    bottom: 16,
    width: 3,
    backgroundColor: '#3b82f6',
    borderRadius: 2,
  },
  highlightText: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 24,
    fontStyle: 'italic',
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  noteText: {
    flex: 1,
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
  },
  sourceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  sourceName: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  separator: {
    color: '#64748b',
  },
  contentTitle: {
    flex: 1,
    fontSize: 13,
    color: '#64748b',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  date: {
    fontSize: 12,
    color: '#64748b',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewButtonText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
});
