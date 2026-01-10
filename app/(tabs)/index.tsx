import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Speech from 'expo-speech';
import React, { useState } from 'react';
import { Alert, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  const [status, setStatus] = useState('Ready');
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = React.useRef<any>(null);

  const speakText = async (text: string) => {
    try {
      Speech.speak(text, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.85,
      });
      setStatus(`Speaking: ${text}`);
    } catch (error) {
      console.error('Speech error:', error);
      setStatus('Audio may not work in Expo Go');
    }
  };

  const openCamera = async () => {
    if (!permission) {
      setStatus('Requesting camera permission...');
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission denied', 'Camera access is required');
        return;
      }
    }

    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission denied', 'Camera access is required');
        return;
      }
    }

    setShowCamera(true);
    setStatus('Camera opened');
    speakText('Camera opened');
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
        });
        setCapturedImage(photo.uri);
        setShowCamera(false);
        setStatus('Image captured successfully!');
        speakText('Image captured');
      } catch (error) {
        Alert.alert('Error', 'Failed to capture image');
      }
    }
  };

  const testSpeaker = () => {
    speakText('Hello! This is the Blind Assistant test. Audio is working.');
  };

  const handleVoice = () => {
    setStatus('Voice command pressed!');
    speakText('Voice command feature coming soon');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Blind Assistant</Text>
        <Text style={styles.subtitle}>Capstone Project - Week 1</Text>
      </View>

      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Status:</Text>
        <Text style={styles.statusText}>{status}</Text>
      </View>

      {capturedImage && (
        <View style={styles.imagePreview}>
          <Text style={styles.previewLabel}>Last Captured Image:</Text>
          <Image source={{ uri: capturedImage }} style={styles.thumbnail} />
        </View>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.button}
          onPress={openCamera}
        >
          <Text style={styles.buttonText}>📷 Capture Image</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.button}
          onPress={handleVoice}
        >
          <Text style={styles.buttonText}>🎤 Voice Command</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton]}
          onPress={testSpeaker}
        >
          <Text style={styles.buttonText}>🔊 Test Speaker</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>✓ App Running</Text>
        <Text style={styles.footerText}>✓ Camera Ready</Text>
        <Text style={styles.footerText}>⚠ Audio limited in Expo Go</Text>
      </View>

      <Modal visible={showCamera} animationType="slide">
        <View style={styles.cameraContainer}>
          <CameraView style={styles.camera} ref={cameraRef} facing="back">
            <View style={styles.cameraOverlay}>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowCamera(false)}
              >
                <Text style={styles.closeButtonText}>✕ Close</Text>
              </TouchableOpacity>

              <View style={styles.captureButtonContainer}>
                <TouchableOpacity 
                  style={styles.captureButton}
                  onPress={takePicture}
                >
                  <View style={styles.captureButtonInner} />
                </TouchableOpacity>
              </View>
            </View>
          </CameraView>
        </View>
      </Modal>
    </View>
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
    marginBottom: 30,
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
    marginBottom: 20,
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    color: '#a0a0a0',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 16,
    color: '#4ecca3',
    fontWeight: '600',
    textAlign: 'center',
  },
  imagePreview: {
    backgroundColor: '#16213e',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  previewLabel: {
    color: '#a0a0a0',
    fontSize: 14,
    marginBottom: 10,
  },
  thumbnail: {
    width: 200,
    height: 150,
    borderRadius: 8,
    backgroundColor: '#000',
  },
  buttonContainer: {
    gap: 16,
    marginBottom: 30,
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
  footer: {
    marginTop: 'auto',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#16213e',
    gap: 8,
  },
  footerText: {
    color: '#a0a0a0',
    fontSize: 12,
    textAlign: 'center',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  captureButtonContainer: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
});