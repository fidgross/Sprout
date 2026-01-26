import { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useContentById } from '../../hooks/useContent';
import { useSaveContent, useMarkAsRead, useUnsaveContent } from '../../hooks/useUserContent';

const SOURCE_ICONS: Record<string, string> = {
  podcast: 'mic',
  newsletter: 'mail',
  youtube: 'logo-youtube',
  blog: 'document-text',
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ContentReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: content, isLoading, error } = useContentById(id || '');
  const { mutate: saveContent, isPending: isSaving } = useSaveContent();
  const { mutate: unsaveContent, isPending: isUnsaving } = useUnsaveContent();
  const { mutate: markAsRead } = useMarkAsRead();

  // Mark as read on mount
  useEffect(() => {
    if (id) {
      markAsRead(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]); // Only re-run when id changes

  const handleSaveToggle = () => {
    if (!id) return;
    if (content?.user_content?.status === 'saved') {
      unsaveContent(id);
    } else {
      saveContent(id);
    }
  };

  const handleOpenOriginal = async () => {
    if (content?.url) {
      try {
        await Linking.openURL(content.url);
      } catch (error) {
        console.error('Failed to open URL:', error);
      }
    }
  };

  const handleShare = async () => {
    if (!content) return;
    try {
      await Share.share({
        title: content.summary?.headline || content.title,
        message: `Check out: ${content.summary?.headline || content.title}\n\n${content.url}`,
        url: content.url,
      });
    } catch (error) {
      console.error('Failed to share:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer} accessibilityLabel="Loading content">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (error || !content) {
    return (
      <View style={styles.errorContainer} accessibilityRole="alert">
        <Ionicons name="alert-circle" size={48} color="#ef4444" />
        <Text style={styles.errorText}>Failed to load content</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => router.back()}
          accessibilityLabel="Go back to feed"
          accessibilityRole="button"
        >
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isSaved = content.user_content?.status === 'saved';
  const sourceIcon = SOURCE_ICONS[content.source.type] || 'document';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      accessibilityLabel="Content reader"
    >
      {/* Source Info Header */}
      <View
        style={styles.sourceHeader}
        accessibilityLabel={`From ${content.source.name}, ${content.source.type}, published ${formatDate(content.published_at)}`}
      >
        <View style={styles.sourceInfo}>
          <Ionicons name={sourceIcon as any} size={20} color="#64748b" />
          <Text style={styles.sourceName}>{content.source.name}</Text>
        </View>
        <Text style={styles.publishedDate}>{formatDate(content.published_at)}</Text>
      </View>

      {/* Headline */}
      <Text
        style={styles.headline}
        accessibilityRole="header"
      >
        {content.summary?.headline || content.title}
      </Text>

      {/* Deep Summary */}
      {content.summary?.deep_summary && (
        <View style={styles.section} accessibilityLabel="Full summary">
          <Text style={styles.summaryText}>{content.summary.deep_summary}</Text>
        </View>
      )}

      {/* Quotes Section */}
      {content.summary?.quotes && content.summary.quotes.length > 0 && (
        <View style={styles.section} accessibilityLabel="Key quotes">
          <Text style={styles.sectionTitle}>Key Quotes</Text>
          {content.summary.quotes.map((quote, index) => (
            <View key={index} style={styles.quoteContainer}>
              <View style={styles.quoteBorder} />
              <Text style={styles.quoteText}>"{quote}"</Text>
            </View>
          ))}
        </View>
      )}

      {/* Takeaways Section */}
      {content.summary?.takeaways && content.summary.takeaways.length > 0 && (
        <View style={styles.section} accessibilityLabel="Key takeaways">
          <Text style={styles.sectionTitle}>Key Takeaways</Text>
          {content.summary.takeaways.map((takeaway, index) => (
            <View key={index} style={styles.takeawayRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.takeawayText}>{takeaway}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, isSaved && styles.actionButtonActive]}
          onPress={handleSaveToggle}
          disabled={isSaving || isUnsaving}
          accessibilityLabel={isSaved ? 'Remove from saved' : 'Save for later'}
          accessibilityRole="button"
          accessibilityState={{ selected: isSaved }}
        >
          <Ionicons
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={24}
            color={isSaved ? '#3b82f6' : '#fff'}
          />
          <Text style={[styles.actionButtonText, isSaved && styles.actionButtonTextActive]}>
            {isSaved ? 'Saved' : 'Save'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleOpenOriginal}
          accessibilityLabel="Open original article"
          accessibilityRole="button"
        >
          <Ionicons name="open-outline" size={24} color="#fff" />
          <Text style={styles.actionButtonText}>Original</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleShare}
          accessibilityLabel="Share this content"
          accessibilityRole="button"
        >
          <Ionicons name="share-outline" size={24} color="#fff" />
          <Text style={styles.actionButtonText}>Share</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#fff',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sourceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sourceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sourceName: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  publishedDate: {
    fontSize: 14,
    color: '#64748b',
  },
  headline: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    lineHeight: 36,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  summaryText: {
    fontSize: 17,
    color: '#e2e8f0',
    lineHeight: 28,
  },
  quoteContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 16,
    overflow: 'hidden',
  },
  quoteBorder: {
    width: 4,
    backgroundColor: '#3b82f6',
    borderRadius: 2,
    marginRight: 12,
    marginLeft: -16,
    marginVertical: -16,
  },
  quoteText: {
    flex: 1,
    fontSize: 16,
    color: '#cbd5e1',
    fontStyle: 'italic',
    lineHeight: 24,
  },
  takeawayRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  bullet: {
    color: '#3b82f6',
    fontSize: 18,
    fontWeight: 'bold',
  },
  takeawayText: {
    flex: 1,
    fontSize: 16,
    color: '#e2e8f0',
    lineHeight: 24,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  actionButton: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  actionButtonActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  actionButtonTextActive: {
    color: '#3b82f6',
  },
});
