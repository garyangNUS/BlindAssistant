import { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function App() {
  const [status, setStatus] = useState('Ready');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Blind Assistant</Text>
        <Text style={styles.subtitle}>Capstone Project</Text>
      </View>

      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Status:</Text>
        <Text style={styles.statusText}>{status}</Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.button}
          onPress={() => setStatus('Camera button pressed!')}
        >
          <Text style={styles.buttonText}>📷 Capture Image</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.button}
          onPress={() => setStatus('Voice button pressed!')}
        >
          <Text style={styles.buttonText}>🎤 Voice Command</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton]}
          onPress={() => setStatus('Speaker button pressed!')}
        >
          <Text style={styles.buttonText}>🔊 Test Speaker</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#a0a0a0',
  },
  statusContainer: {
    backgroundColor: '#16213e',
    padding: 20,
    borderRadius: 12,
    marginBottom: 40,
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    color: '#a0a0a0',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 18,
    color: '#4ecca3',
    fontWeight: '600',
  },
  buttonContainer: {
    gap: 16,
  },
  button: {
    backgroundColor: '#4ecca3',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#0f3460',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
});

