import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { signOut } from '../../lib/auth';
import { useAuth } from '../../hooks/useAuth';

export default function ProfileScreen() {
  const { user } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.email}>{user?.email}</Text>

      <TouchableOpacity style={styles.button} onPress={signOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  email: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 8,
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    paddingHorizontal: 32,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
