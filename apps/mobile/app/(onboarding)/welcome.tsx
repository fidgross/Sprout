import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="library" size={80} color="#3b82f6" />
        </View>

        <Text style={styles.title}>Welcome to Curator</Text>
        <Text style={styles.subtitle}>
          Your AI-powered learning companion that summarizes podcasts, articles, and videos so you can learn more in less time.
        </Text>

        <View style={styles.features}>
          <FeatureItem icon="flash" text="Get key insights in seconds" />
          <FeatureItem icon="bookmark" text="Save and organize what matters" />
          <FeatureItem icon="search" text="Search your knowledge base" />
        </View>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push('/(onboarding)/topics')}
        accessibilityLabel="Continue to select topics"
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>Get Started</Text>
        <Ionicons name="arrow-forward" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

function FeatureItem({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureRow}>
      <Ionicons name={icon as any} size={24} color="#3b82f6" />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 24,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  features: {
    gap: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#fff',
    flex: 1,
  },
  button: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 18,
    borderRadius: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
