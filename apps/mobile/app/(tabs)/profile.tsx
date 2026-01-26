import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from '../../lib/auth';
import { useAuth } from '../../hooks/useAuth';
import {
  saveNotionCredentials,
  getNotionCredentials,
  clearNotionCredentials,
  validateNotionCredentials,
  extractDatabaseId,
  type NotionCredentials,
} from '../../lib/notion';

export default function ProfileScreen() {
  const { user } = useAuth();
  const [notionConnected, setNotionConnected] = useState(false);
  const [showNotionSetup, setShowNotionSetup] = useState(false);
  const [notionToken, setNotionToken] = useState('');
  const [notionDatabaseId, setNotionDatabaseId] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkNotionConnection();
  }, []);

  const checkNotionConnection = async () => {
    setIsLoading(true);
    const credentials = await getNotionCredentials();
    setNotionConnected(credentials !== null);
    setIsLoading(false);
  };

  const handleConnectNotion = async () => {
    if (!notionToken.trim()) {
      Alert.alert('Error', 'Please enter your Notion integration token.');
      return;
    }

    if (!notionDatabaseId.trim()) {
      Alert.alert('Error', 'Please enter your Notion database ID or URL.');
      return;
    }

    // Extract database ID from URL or validate the ID format
    const databaseId = extractDatabaseId(notionDatabaseId.trim());
    if (!databaseId) {
      Alert.alert(
        'Invalid Database ID',
        'Please enter a valid Notion database ID or URL.'
      );
      return;
    }

    setIsValidating(true);

    const credentials: NotionCredentials = {
      accessToken: notionToken.trim(),
      databaseId,
    };

    // Validate credentials
    const isValid = await validateNotionCredentials(credentials);

    if (!isValid) {
      setIsValidating(false);
      Alert.alert(
        'Connection Failed',
        'Could not connect to Notion. Please check your integration token and database ID.\n\nMake sure:\n1. Your integration token is correct\n2. The database is shared with your integration',
        [{ text: 'OK' }]
      );
      return;
    }

    // Save credentials
    await saveNotionCredentials(credentials);
    setNotionConnected(true);
    setShowNotionSetup(false);
    setNotionToken('');
    setNotionDatabaseId('');
    setIsValidating(false);

    Alert.alert('Success', 'Notion connected successfully!');
  };

  const handleDisconnectNotion = () => {
    Alert.alert(
      'Disconnect Notion',
      'Are you sure you want to disconnect your Notion account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await clearNotionCredentials();
            setNotionConnected(false);
          },
        },
      ]
    );
  };

  const openNotionHelp = () => {
    Linking.openURL('https://www.notion.so/my-integrations');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      {/* Integrations Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Integrations</Text>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#3b82f6" />
          </View>
        ) : showNotionSetup ? (
          <View style={styles.notionSetupContainer}>
            <View style={styles.setupHeader}>
              <Text style={styles.setupTitle}>Connect Notion</Text>
              <TouchableOpacity
                onPress={() => setShowNotionSetup(false)}
                accessibilityLabel="Cancel"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.setupDescription}>
              To connect Notion, you need to create an integration and share a
              database with it.
            </Text>

            <TouchableOpacity
              style={styles.helpLink}
              onPress={openNotionHelp}
              accessibilityLabel="Open Notion integrations page"
              accessibilityRole="link"
            >
              <Ionicons name="open-outline" size={16} color="#3b82f6" />
              <Text style={styles.helpLinkText}>Create integration at notion.so</Text>
            </TouchableOpacity>

            <Text style={styles.inputLabel}>Integration Token</Text>
            <TextInput
              style={styles.input}
              value={notionToken}
              onChangeText={setNotionToken}
              placeholder="secret_..."
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              accessibilityLabel="Notion integration token"
            />

            <Text style={styles.inputLabel}>Database ID or URL</Text>
            <TextInput
              style={styles.input}
              value={notionDatabaseId}
              onChangeText={setNotionDatabaseId}
              placeholder="https://notion.so/... or database ID"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Notion database ID or URL"
            />

            <TouchableOpacity
              style={[styles.connectButton, isValidating && styles.connectButtonDisabled]}
              onPress={handleConnectNotion}
              disabled={isValidating}
              accessibilityLabel="Connect to Notion"
              accessibilityRole="button"
            >
              {isValidating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.connectButtonText}>Connect</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.integrationCard}>
            <View style={styles.integrationInfo}>
              <View style={styles.integrationIcon}>
                <Text style={styles.notionIconText}>N</Text>
              </View>
              <View style={styles.integrationDetails}>
                <Text style={styles.integrationName}>Notion</Text>
                <Text style={styles.integrationStatus}>
                  {notionConnected ? 'Connected' : 'Not connected'}
                </Text>
              </View>
            </View>
            {notionConnected ? (
              <TouchableOpacity
                style={styles.disconnectButton}
                onPress={handleDisconnectNotion}
                accessibilityLabel="Disconnect Notion"
                accessibilityRole="button"
              >
                <Text style={styles.disconnectButtonText}>Disconnect</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.setupButton}
                onPress={() => setShowNotionSetup(true)}
                accessibilityLabel="Set up Notion"
                accessibilityRole="button"
              >
                <Text style={styles.setupButtonText}>Connect</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Sign Out */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
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
    padding: 24,
    paddingTop: 60,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  email: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 8,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  integrationCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  integrationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  integrationIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notionIconText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  integrationDetails: {
    gap: 2,
  },
  integrationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  integrationStatus: {
    fontSize: 14,
    color: '#64748b',
  },
  setupButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  setupButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  disconnectButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  disconnectButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  notionSetupContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
  },
  setupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  setupTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  setupDescription: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
    marginBottom: 12,
  },
  helpLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  helpLinkText: {
    fontSize: 14,
    color: '#3b82f6',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#e2e8f0',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    fontSize: 16,
    color: '#fff',
    marginBottom: 16,
  },
  connectButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  connectButtonDisabled: {
    backgroundColor: '#334155',
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  signOutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
