import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { checkImageQuality, getQualityFeedback, getQualityScore } from '../../utils/imageQuality';
import { extractMedicationInfo, formatForSpeech, getMissingFieldsWarning, hasCriticalInfo } from '../../utils/medicalParser';
import { categorizeMedicalText, extractText } from '../../utils/ocr';

export default function HomeScreen() {
  const [status, setStatus] = useState('Ready');
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [textCategory, setTextCategory] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = React.useRef<any>(null);
  const [qualityInfo, setQualityInfo] = useState<string>('');
  const [medicationInfo, setMedicationInfo] = useState<any>(null);
  const [missingFieldsWarning, setMissingFieldsWarning] = useState<string>('');


  const speakText = async (text: string) => {
    try {
      Speech.speak(text, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.85,
      });
    } catch (error) {
      console.error('Speech error:', error);
    }
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission denied', 'Camera access is required');
        return;
      }
    }

    setShowCamera(true);
    setStatus('Camera opened - Point at text');
    speakText('Camera opened. Point at text and tap capture');
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
        });
        
        setShowCamera(false);
        setCapturedImage(photo.uri);
        setStatus('Checking image quality...');
        setIsProcessing(true);
        
        // Check quality
        const qualityResult = await checkImageQuality(
          photo.uri,
          photo.width,
          photo.height
        );
        
        if (!qualityResult.isGoodQuality) {
          //setQualityInfo(`⚠️ ${qualityResult.issues.join(', ')}`);
          const score = getQualityScore(qualityResult);
          setQualityInfo(`⚠️ Quality: ${score} - ${qualityResult.issues.join(', ')}`);
          setStatus('Quality warning - retake recommended');
          speakText(`Warning: ${qualityResult.suggestions[0] || 'Image quality is low'}`);
          
          Alert.alert(
            'Quality Warning',
            `${getQualityFeedback(qualityResult)}\n\nRetake photo or proceed?`,
            [
              {
                text: 'Retake',
                onPress: () => {
                  setShowCamera(true);
                  setIsProcessing(false);
                }
              },
              {
                text: 'Proceed',
                onPress: () => proceedWithOCR(photo.uri)
              }
            ]
          );
        } else {
          //setQualityInfo('✓ Quality OK');
          const score = getQualityScore(qualityResult);
          setQualityInfo(`✓ Quality: ${score}`);
          await proceedWithOCR(photo.uri);
        }
        
      } catch (error) {
        Alert.alert('Error', 'Failed to capture image');
        setIsProcessing(false);
      }
    }
  };

  const testSpeaker = () => {
    speakText('Hello! This is the Blind Assistant test. Audio is working.');
    setStatus('Testing speaker...');
  };

  const handleVoice = () => {
    setStatus('Voice command pressed!');
    speakText('Voice command feature coming in Week 4');
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Gallery access is required');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets?.[0]) {
      const imageUri = result.assets[0].uri;
      const imageWidth = result.assets[0].width;
      const imageHeight = result.assets[0].height;
      
      setCapturedImage(imageUri);
      setStatus('Checking image quality...');
      setIsProcessing(true);
      
      try {
        // STEP 1: Check quality first
        const qualityResult = await checkImageQuality(imageUri, imageWidth, imageHeight);
        
        if (!qualityResult.isGoodQuality) {
          // Show quality warnings
          const feedback = getQualityFeedback(qualityResult);
          //setQualityInfo(`⚠️ ${qualityResult.issues.join(', ')}`);
          const score = getQualityScore(qualityResult);
          setQualityInfo(`⚠️ Quality: ${score} - ${qualityResult.issues.join(', ')}`);
          setStatus(`Quality Warning: ${qualityResult.issues.join(', ')}`);
          speakText(`Warning: ${qualityResult.suggestions.join('. ')}`);
          
          // Ask user if they want to proceed
          Alert.alert(
            'Image Quality Warning',
            `${feedback}\n\nProceed with OCR anyway?`,
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => {
                  setIsProcessing(false);
                  setStatus('Image quality too low. Please try again.');
                }
              },
              {
                text: 'Proceed Anyway',
                onPress: () => proceedWithOCR(imageUri)
              }
            ]
          );
        } else {
          // Quality is good, proceed
          const score = getQualityScore(qualityResult);
          setQualityInfo(`✓ Quality: ${score}`);
          //setQualityInfo('✓ Quality OK');
          setStatus('Quality check passed. Processing...');
          speakText('Image quality good. Processing text.');
          await proceedWithOCR(imageUri);
        }
        
      } catch (error) {
        console.error('Quality check error:', error);
        // If quality check fails, still try OCR
        await proceedWithOCR(imageUri);
      }
    }
  };

  // Separate function for OCR processing
const proceedWithOCR = async (imageUri: string) => {
  try {
    setStatus('Extracting text...');
    const ocrResult = await extractText(imageUri);
    
    if (ocrResult.text.trim().length > 0) {
      setExtractedText(ocrResult.text);
      
      // Categorize as medical
      const category = categorizeMedicalText(ocrResult.text);
      setTextCategory(category);
      
      // Extract medical information
      const medInfo = extractMedicationInfo(ocrResult.text);
      setMedicationInfo(medInfo);
      
      // Check for missing fields
      const missingWarning = getMissingFieldsWarning(medInfo);
      if (missingWarning) {
        setMissingFieldsWarning(missingWarning);
      } else {
        setMissingFieldsWarning('');
      }
      
      // Format for speech
      const speechText = formatForSpeech(medInfo);
      
      // Check if we have critical info
      if (hasCriticalInfo(medInfo)) {
        setStatus(`Found ${category}`);
        speakText(`Found ${category}. ${speechText}`);
        
        // Also speak missing fields warning if present
        if (missingWarning) {
          setTimeout(() => {
            speakText(missingWarning);
          }, 2000); // Delay to speak after main info
        }
      } else {
        setStatus('Incomplete information detected');
        setExtractedText('Critical information missing');
        speakText('Unable to read complete medication information. Please ensure the entire label is visible and try again.');
      }
    } else {
      setExtractedText('No text found');
      setStatus('No text detected in image');
      speakText('No text found in image');
    }
  } catch (error) {
    console.error('OCR error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    setStatus(`Error: ${errorMsg}`);
    setExtractedText(`Error: ${errorMsg}`);
  } finally {
    setIsProcessing(false);
  }
};
  
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Blind Assistant</Text>
          <Text style={styles.subtitle}>Week 2: OCR Integration</Text>
        </View>

        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Status:</Text>
          <Text style={styles.statusText}>{status}</Text>
          {qualityInfo && (
            <Text style={styles.qualityInfo}>{qualityInfo}</Text>
          )}
        </View>

        {isProcessing && (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color="#4ecca3" />
            <Text style={styles.processingText}>Extracting text...</Text>
          </View>
        )}

{capturedImage && (
  <View style={styles.imagePreview}>
    <Text style={styles.previewLabel}>Captured Image:</Text>
    <Image source={{ uri: capturedImage }} style={styles.thumbnail} />
    
    {extractedText && (
      <View style={styles.textResultContainer}>
        <Text style={styles.textCategoryLabel}>Category: {textCategory}</Text>
        
        {/* Show extracted medical information */}
        {medicationInfo && (
          <View style={styles.medInfoContainer}>
            {medicationInfo.drugName && (
              <Text style={styles.medInfoField}>
                <Text style={styles.medInfoLabel}>Drug: </Text>
                {medicationInfo.drugName}
              </Text>
            )}
            
            {medicationInfo.dosageAmount && (
              <Text style={styles.medInfoField}>
                <Text style={styles.medInfoLabel}>Dosage: </Text>
                {medicationInfo.dosageAmount}
              </Text>
            )}
            
            {medicationInfo.dosageInstructions && (
              <Text style={styles.medInfoField}>
                <Text style={styles.medInfoLabel}>Instructions: </Text>
                {medicationInfo.dosageInstructions}
              </Text>
            )}
            
            {medicationInfo.timing && (
              <Text style={styles.medInfoField}>
                <Text style={styles.medInfoLabel}>Timing: </Text>
                {medicationInfo.timing}
              </Text>
            )}
            
            {medicationInfo.warnings && medicationInfo.warnings.length > 0 && (
              <Text style={styles.medInfoWarning}>
                ⚠️ {medicationInfo.warnings.join(', ')}
              </Text>
            )}
            
            {medicationInfo.expirationDate && (
              <Text style={styles.medInfoField}>
                <Text style={styles.medInfoLabel}>Expires: </Text>
                {medicationInfo.expirationDate}
              </Text>
            )}
          </View>
        )}
        
        {/* Show missing fields warning */}
        {missingFieldsWarning && (
          <Text style={styles.missingFieldsWarning}>
            {missingFieldsWarning}
          </Text>
        )}
        
        {/* Show raw extracted text */}
        <Text style={styles.extractedTextLabel}>Raw Text:</Text>
        <Text style={styles.extractedText}>{extractedText}</Text>
      </View>
    )}
  </View>
)}

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.button}
            onPress={openCamera}
            disabled={isProcessing}
          >
            <Text style={styles.buttonText}>📷 Capture & Read Text</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.uploadButton]}
            onPress={pickImage}
            disabled={isProcessing}
          >
            <Text style={styles.buttonText}>📁 Upload Test Image</Text>
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
          <Text style={styles.footerText}>✓ Week 1: Camera</Text>
          <Text style={styles.footerText}>✓ Week 2: Medical Label OCR</Text>
          <Text style={styles.footerText}>→ Next: Enhanced Medical Parsing</Text>
        </View>
      </ScrollView>

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

              <View style={styles.guidanceContainer}>
                <Text style={styles.guidanceText}>Point at text</Text>
                <Text style={styles.guidanceSubtext}>Signs, labels, or documents</Text>
              </View>

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
  },
  scrollContent: {
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
  qualityInfo: {
    fontSize: 12,
    color: '#f39c12',
    marginTop: 8,
    textAlign: 'center',
  },
  processingContainer: {
    backgroundColor: '#16213e',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  processingText: {
    color: '#4ecca3',
    marginTop: 10,
    fontSize: 16,
  },
  imagePreview: {
    backgroundColor: '#16213e',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  previewLabel: {
    color: '#a0a0a0',
    fontSize: 14,
    marginBottom: 10,
  },
  thumbnail: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#000',
    marginBottom: 15,
  },
  textResultContainer: {
    backgroundColor: '#0f3460',
    padding: 15,
    borderRadius: 8,
  },
  textCategoryLabel: {
    color: '#4ecca3',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  extractedTextLabel: {
    color: '#a0a0a0',
    fontSize: 12,
    marginBottom: 5,
  },
  extractedText: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 24,
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
  uploadButton: {
    backgroundColor: '#9b59b6',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  footer: {
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
  guidanceContainer: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
  },
  guidanceText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  guidanceSubtext: {
    color: '#a0a0a0',
    fontSize: 14,
    marginTop: 5,
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
    medInfoContainer: {
    backgroundColor: '#1a4d2e',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4ecca3',
  },
  medInfoField: {
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  medInfoLabel: {
    fontWeight: 'bold',
    color: '#4ecca3',
  },
  medInfoWarning: {
    color: '#f39c12',
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f39c12',
  },
  missingFieldsWarning: {
    backgroundColor: '#8b4513',
    color: '#ffffff',
    padding: 10,
    borderRadius: 6,
    fontSize: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#ff6b6b',
  },
});