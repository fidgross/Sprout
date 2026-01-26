import { useState, useEffect } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { exportToNotion, isNotionConnected } from '../lib/notion';

interface NotionExportButtonProps {
  contentId: string;
  style?: 'icon' | 'full';
  onExportStart?: () => void;
  onExportComplete?: (success: boolean, pageUrl?: string) => void;
}

export function NotionExportButton({
  contentId,
  style = 'icon',
  onExportStart,
  onExportComplete,
}: NotionExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    const connected = await isNotionConnected();
    setIsConnected(connected);
  };

  const handleExport = async () => {
    if (isExporting) return;

    // Check if Notion is connected
    if (!isConnected) {
      Alert.alert(
        'Notion Not Connected',
        'Please connect your Notion account in your Profile settings first.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsExporting(true);
    onExportStart?.();

    try {
      const result = await exportToNotion(contentId);

      if (result.success) {
        Alert.alert(
          'Exported to Notion',
          'The content has been exported to your Notion database.',
          [
            { text: 'OK' },
            ...(result.pageUrl
              ? [
                  {
                    text: 'Open in Notion',
                    onPress: () => {
                      if (result.pageUrl) {
                        Linking.openURL(result.pageUrl);
                      }
                    },
                  },
                ]
              : []),
          ]
        );
        onExportComplete?.(true, result.pageUrl);
      } else {
        Alert.alert(
          'Export Failed',
          result.error || 'Failed to export to Notion. Please try again.',
          [{ text: 'OK' }]
        );
        onExportComplete?.(false);
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert(
        'Export Failed',
        'An unexpected error occurred. Please try again.',
        [{ text: 'OK' }]
      );
      onExportComplete?.(false);
    } finally {
      setIsExporting(false);
    }
  };

  if (style === 'icon') {
    return (
      <TouchableOpacity
        style={styles.iconButton}
        onPress={handleExport}
        disabled={isExporting}
        accessibilityLabel="Export to Notion"
        accessibilityRole="button"
        accessibilityState={{ disabled: isExporting }}
      >
        {isExporting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons
            name="cloud-upload-outline"
            size={24}
            color={isConnected === false ? '#64748b' : '#fff'}
          />
        )}
        <Text
          style={[
            styles.iconButtonText,
            isConnected === false && styles.iconButtonTextDisabled,
          ]}
        >
          Notion
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.fullButton, isConnected === false && styles.fullButtonDisabled]}
      onPress={handleExport}
      disabled={isExporting}
      accessibilityLabel="Export to Notion"
      accessibilityRole="button"
      accessibilityState={{ disabled: isExporting || isConnected === false }}
    >
      {isExporting ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Ionicons
          name="cloud-upload-outline"
          size={20}
          color="#fff"
        />
      )}
      <Text style={styles.fullButtonText}>
        {isExporting ? 'Exporting...' : 'Export to Notion'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  iconButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  iconButtonTextDisabled: {
    color: '#64748b',
  },
  fullButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  fullButtonDisabled: {
    backgroundColor: '#334155',
  },
  fullButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
