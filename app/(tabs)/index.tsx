import Voice from '@react-native-voice/voice';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { checkImageQuality, getQualityFeedback, getQualityScore } from '../../utils/imageQuality';
import { extractMedicationInfo, formatForSpeech, getMissingFieldsWarning, hasCriticalInfo } from '../../utils/medicalParser';
import { categorizeMedicalText, extractText } from '../../utils/ocr';
import { getHelpMessage, matchIntent, speakText as voiceSpeakText } from '../../utils/voiceHandler';



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
  const [isListening, setIsListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const voiceContextRef = useRef<'main' | 'camera'>('main');

// Cleanup voice when component unmounts
React.useEffect(() => {
  return () => {
    Voice.destroy().then(Voice.removeAllListeners);
  };
}, []);

React.useEffect(() => {
  if (!showCamera) {
    console.log('📷 Camera closed - stopping voice');
    Voice.stop();
    Voice.removeAllListeners();
  }
}, [showCamera]);

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
  const stopSpeaking = () => {
    try {
      Speech.stop();
      console.log('🔇 Audio stopped');
    } catch (error) {
      console.error('Error stopping speech:', error);
    }
  };
  // Separate function for OCR processing
  const proceedWithOCR = async (imageUri: string): Promise<boolean> => {
    try {
      // Clear old data FIRST (before starting new OCR)
      console.log('🧹 Clearing old medication data before new scan');
      setExtractedText('');
      setTextCategory('');
      setMedicationInfo(null);
      setMissingFieldsWarning('');
      setQualityInfo('');

      setStatus('Extracting text...');
      const ocrResult = await extractText(imageUri);
      
      if (!ocrResult.text || ocrResult.text.trim().length < 10) {
        // OCR returned nothing or very little text
        console.log('❌ OCR failed - no text extracted');
        setStatus('Failed to extract text');
       
        // SPEAK ERROR MESSAGE
        await speakText('Cannot detect any text in the image. Please retake the photo with better lighting and focus.');
        setIsProcessing(false);
        return false; // ← RETURN FALSE
      }
      
      setExtractedText(ocrResult.text);
      
      const category = categorizeMedicalText(ocrResult.text);
      setTextCategory(category);
      
      const medInfo = extractMedicationInfo(ocrResult.text);
      setMedicationInfo(medInfo);
      
      console.log('=== MEDICATION INFO SET ===');
      console.log('Full medInfo object:', JSON.stringify(medInfo, null, 2));
      
      // Check if we got critical information
      const hasCritical = hasCriticalInfo(medInfo);
      
      if (!hasCritical) {
        // No critical info extracted
        console.log('❌ No critical medication info extracted');
        setStatus('Could not identify medication information');
        // CLEAR MEDICATION DATA (keep extracted text for debugging)
        setTextCategory('Unknown');
        setMedicationInfo(null);
        setMissingFieldsWarning('No medication information found');

        // SPEAK ERROR MESSAGE
        await speakText('Could not identify medication information from the image. Please ensure the label is clearly visible and retake the photo.');      
        setIsProcessing(false);
        return false; // ← RETURN FALSE
      }
      
      const missingWarning = getMissingFieldsWarning(medInfo);
      if (missingWarning) {
        setMissingFieldsWarning(missingWarning);
      }
      
      const speechText = formatForSpeech(medInfo);
      
      setStatus(`Found ${category}`);
      await speakText(`Found ${category}. ${speechText}`);
      
      setIsProcessing(false);
      return true; // ← RETURN TRUE (success!)
      
    } catch (error) {
      console.error('OCR error:', error);
      setStatus('OCR failed');
      // CLEAR ALL DATA
      setExtractedText('');
      setTextCategory('');
      setMedicationInfo(null);
      setMissingFieldsWarning('');
      setQualityInfo('');
      await speakText('An error occurred while reading the label. Please try again.');
      setIsProcessing(false);
      return false; // ← RETURN FALSE
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
    // CRITICAL: Set context to camera BEFORE opening
    console.log('🔄 Setting voice context to CAMERA');
    voiceContextRef.current = 'camera'; // CHANGED
    
    setShowCamera(true);
    setStatus('Camera opened - Point at text');
    speakText('Camera opened. Point at text and say capture, or tap the button');

     // Start voice listening for camera capture
     // Start camera-specific voice listener
    setTimeout(async () => {
    setupVoiceHandler();
    // Small delay before starting
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('🎤 Starting voice recognition...');
    await Voice.start('en-US');
    console.log('✅ Camera voice active');
    }, 2000);
  };

// UNIFIED VOICE HANDLER - handles both contexts
const setupVoiceHandler = () => {
  Voice.onSpeechResults = (e) => {
    if (e.value && e.value.length > 0) {
      const transcript = e.value[0];
      console.log('🎤 Voice heard:', transcript);
      console.log('📍 Current voice context:', voiceContextRef.current); // ADD THIS DEBUG LINE
      // Route based on context
      if (voiceContextRef.current === 'camera') {
        // CAMERA CONTEXT
        handleCameraVoiceCommand(transcript);
      } else {
        // MAIN CONTEXT
        handleMainVoiceCommand(transcript);
      }
    }
  };
  
  Voice.onSpeechError = (e) => {
    console.log('⚠️ Voice error:', e);
  };
  
  Voice.onSpeechEnd = () => {
    console.log('🔄 Speech ended');
    
    // Restart if in camera context
    if (voiceContextRef.current === 'camera' && showCamera) {
      setTimeout(async () => {
        if (showCamera) {
          try {
            await Voice.start('en-US');
            console.log('✅ Camera listener restarted');
          } catch (err) {
            console.log('Restart error:', err);
          }
        }
      }, 500);
    }
  };
};

const handleCameraVoiceCommand = async (transcript: string) => {
  const text = transcript.toLowerCase();
  console.log('📷 Camera processing:', text);
  
  // CANCEL
  if (text.match(/cancel|close|exit|stop|abort|back/)) {
    console.log('✅ Cancel detected');
    await Voice.stop();
    speakText('Cancelled');
    setShowCamera(false);
    voiceContextRef.current = 'main'; // CHANGED
    return;
  }
  
  // CAPTURE
  if (text.match(/capture|click|snap|shoot|take|photo|picture/)) {
    console.log('✅ Capture detected');
    await Voice.stop();
    speakText('Capturing');
    voiceContextRef.current = 'main'; // CHANGED
    console.log('📸 Calling takePicture...');
    await takePicture();  // ← ADD AWAIT
    console.log('📸 takePicture completed');
    return;
  }
  
  // Unknown
  console.log('❓ Unknown camera command');
  speakText('Say capture to take photo, or cancel to close');
};

const handleMainVoiceCommand = async (transcript: string) => {
  console.log('🏠 Main processing:', transcript);
  
  setStatus(`You said: "${transcript}"`);
  setIsListening(false);
  
  // Use matcher
  const command = matchIntent(transcript);
  console.log('Matched command:', command);
  
  if (command.confidence > 0.5) {
    await Voice.stop();
    executeVoiceCommand(command.action);
  } else {
    voiceSpeakText('Sorry, I did not understand that command.');
  }
};


 const takePicture = async () => {
  console.log('📸 ========== takePicture ENTERED ==========');
  console.log('📸 cameraRef exists?', !!cameraRef);
  console.log('📸 cameraRef.current exists?', !!cameraRef.current);
  if (cameraRef.current) {
    try {      
       // Stop voice listener when capturing
      console.log('📸 Stopping voice...');
      await Voice.stop();
      
      console.log('📸 Calling takePictureAsync...');
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.3,
        base64: false,
      });
      console.log('📸 Photo captured!', photo.uri);
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
      
      const score = getQualityScore(qualityResult);
      
      if (!qualityResult.isGoodQuality) {
        // Low quality detected - show warning but proceed anyway
        setQualityInfo(`⚠️ Quality: ${score} - ${qualityResult.issues.join(', ')}`);
        setStatus('Low quality detected - attempting OCR...');
        console.log('⚠️ Quality warning:', qualityResult.issues);
        
        // Try OCR despite low quality
        const success = await proceedWithOCR(photo.uri);
        
        // If OCR completely failed, THEN ask to retake
        if (!success) {
          // SPEAK THE ERROR MESSAGE
          const errorMessage = `Cannot read the label. ${getQualityFeedback(qualityResult)}. Please retake the photo.`;
          await speakText(errorMessage);
          Alert.alert(
            'Cannot Read Label',
            `Image quality is too low to extract information.\n\n${getQualityFeedback(qualityResult)}\n\nPlease retake the photo.`,
            [
              {
                text: 'Retake Photo',
                onPress: async () => {
                  stopSpeaking();
                  await speakText('Opening camera. Point at the label and tap capture.');
                  setShowCamera(true);
                  setIsProcessing(false);
                }
              },
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => {
                  stopSpeaking();
                  setIsProcessing(false);
                }
              }
            ]
          );
        }
      } else {
        // Good quality
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

// Line 117 - Define submenu functions FIRST
const showBasicInfoCommands = () => {
  Alert.alert(
    'Basic Info Commands',
    'What would you like to know?',
    [
      {
        text: '📋 What is it?',
        onPress: async () => {
          if (medicationInfo) {
            let parts = [];
            if (medicationInfo.drugName) parts.push(medicationInfo.drugName);
            if (medicationInfo.medicationType) parts.push(medicationInfo.medicationType.toLowerCase());
            if (medicationInfo.dosageAmount) parts.push(`Strength: ${medicationInfo.dosageAmount}`);
            if (medicationInfo.quantity) parts.push(`Quantity: ${medicationInfo.quantity}`);
            
            if (parts.length > 0) {
              await voiceSpeakText(parts.join('. '));
            } else {
              await voiceSpeakText('Medication information not complete');
            }
          } else {
            await voiceSpeakText('No medication scanned yet');
          }
        }
      },
      {
        text: '💊 What\'s the dosage?',
        onPress: async () => {
          await executeVoiceCommand('read_dosage');
        }
      },
      {
        text: '📋 What\'s it for?',
        onPress: async () => {
          await executeVoiceCommand('read_purpose');
        }
      },
      {
        text: '◀️ Back',
        onPress: () => handleVoice()
      }
    ],
    { cancelable: true }
  );
};

const showUsageCommands = () => {
  Alert.alert(
    'Usage Commands',
    'How to use this medication:',
    [
      {
        text: '📖 Instructions',
        onPress: async () => {
          await executeVoiceCommand('read_instructions');
        }
      },
      {
        text: '⏰ When to take?',
        onPress: async () => {
          if (medicationInfo?.timing) {
            await voiceSpeakText(`Timing: ${medicationInfo.timing}`);
          } else if (medicationInfo?.dosageInstructions) {
            await voiceSpeakText(medicationInfo.dosageInstructions);
          } else {
            await voiceSpeakText('Timing information not found');
          }
        }
      },
      {
        text: '💊 How do I take it?',
        onPress: async () => {
          if (medicationInfo?.dosageInstructions) {
            let response = medicationInfo.dosageInstructions;
            if (medicationInfo.timing) {
              response += `. ${medicationInfo.timing}`;
            }
            await voiceSpeakText(response);
          } else {
            await voiceSpeakText('Instructions not found');
          }
        }
      },
      {
        text: '◀️ Back',
        onPress: () => handleVoice()
      }
    ],
    { cancelable: true }
  );
};

const showSafetyCommands = () => {
  Alert.alert(
    'Safety Info Commands',
    'Safety information:',
    [
      {
        text: '⚠️ Any warnings?',
        onPress: async () => {
          await executeVoiceCommand('read_warnings');
        }
      },
      {
        text: '📅 Expiration date?',
        onPress: async () => {
          await executeVoiceCommand('read_expiration');
        }
      },
      {
        text: '🏥 Where prescribed?',
        onPress: async () => {
          if (medicationInfo?.pharmacy) {
            await voiceSpeakText(`From: ${medicationInfo.pharmacy}`);
          } else if (medicationInfo?.prescriptionDate) {
            await voiceSpeakText(`Prescribed on: ${medicationInfo.prescriptionDate}`);
          } else {
            await voiceSpeakText('Clinic information not found');
          }
        }
      },
      {
        text: '◀️ Back',
        onPress: () => handleVoice()
      }
    ],
    { cancelable: true }
  );
};

// NOW define handleVoice LAST (after the submenu functions exist)

const showVoiceMenu = () => {
  Alert.alert(
    'Voice Command',
    'Choose a category:',
    [
      {
        text: '📋 Basic Info',
        onPress: () => showBasicInfoCommands()
      },
      {
        text: '💊 Usage Info',
        onPress: () => showUsageCommands()
      },
      {
        text: '⚠️ Safety Info',
        onPress: () => showSafetyCommands()
      },
      {
        text: '🔁 Repeat All',
        onPress: async () => {
          await executeVoiceCommand('repeat');
        }
      },
      {
        text: 'Cancel',
        style: 'cancel'
      }
    ],
    { cancelable: true }
  );
}; 

const handleVoice = async () => {
  try {
    setIsListening(true);
    voiceContextRef.current = 'main'; // CHANGED
    setStatus('🎤 Listening... Speak now');
    await voiceSpeakText('Listening');
    
    // Set up handlers
    setupVoiceHandler();
    
    // Start listening
    await Voice.start('en-US');
    
    // Timeout
    setTimeout(async () => {
      if (isListening) {
        console.log('Listening timed out');
        setIsListening(false);
        await Voice.stop();
        voiceSpeakText('Listening timed out');
      }
    }, 10000);
    
  } catch (error) {
    console.error('Voice error:', error);
    setIsListening(false);
    showVoiceMenu();
  }
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
      
  // CLEAR OLD DATA before processing new image
      setExtractedText('');
      setTextCategory('');
      setMedicationInfo(null);
      setMissingFieldsWarning('');
      setQualityInfo('');

      setCapturedImage(imageUri);
      setStatus('Checking image quality...');
      setIsProcessing(true);
    
    try {
      // Check quality first
      const qualityResult = await checkImageQuality(imageUri, imageWidth, imageHeight);
      const score = getQualityScore(qualityResult);
      
      if (!qualityResult.isGoodQuality) {
        // Low quality - show warning but try OCR anyway
        setQualityInfo(`⚠️ Quality: ${score} - ${qualityResult.issues.join(', ')}`);
        setStatus('Low quality detected - attempting OCR...');
        console.log('⚠️ Quality warning:', qualityResult.issues);
        
        const success = await proceedWithOCR(imageUri);
        
        // Only alert if OCR completely failed
        if (!success) {
          Alert.alert(
            'Cannot Read Label',
            `Unable to extract medication information from this image.\n\n${getQualityFeedback(qualityResult)}\n\nPlease choose a clearer image.`,
            [
              {
                text: 'Choose Another',
                onPress: () => pickImage()
              },
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => setIsProcessing(false)
              }
            ]
          );
        }
      } else {
        // Good quality
        setQualityInfo(`✓ Quality: ${score}`);
        await proceedWithOCR(imageUri);
      }
      
    } catch (error) {
      console.error('Image processing error:', error);
      setStatus('Failed to process image');
      setIsProcessing(false);
    }
    }   
  };

const executeVoiceCommand = async (action: string) => {
  console.log('Executing voice command:', action);
  
  switch (action) {
    case 'read_clinic':
      if (medicationInfo?.pharmacy) {
        await voiceSpeakText(`From: ${medicationInfo.pharmacy}`);
      } else if (medicationInfo?.prescriptionDate) {
        await voiceSpeakText(`Prescribed on: ${medicationInfo.prescriptionDate}`);
      } else {
        await voiceSpeakText('Clinic information not found');
      }
      break;

    case 'read_full':
      // Check if medication info exists
      if (medicationInfo) {
        const speechText = formatForSpeech(medicationInfo);
        await voiceSpeakText(speechText);
        setStatus('Spoke full medication info');
      } else {
        await voiceSpeakText('No medication scanned yet. Please scan a label first.');
        setStatus('No medication scanned');
      }
      break;

    case 'read_dosage':
      if (medicationInfo?.dosageAmount) {
        await voiceSpeakText(`Dosage: ${medicationInfo.dosageAmount}`);
        setStatus(`Spoke: Dosage ${medicationInfo.dosageAmount}`);
      } else if (medicationInfo) {
        await voiceSpeakText('Dosage amount not found on this label');
        setStatus('Dosage not found');
      } else {
        await voiceSpeakText('No medication scanned yet. Please scan a label first.');
        setStatus('No medication scanned');
      }
      break;
      
    case 'read_purpose':
      if (medicationInfo?.purpose) {
        await voiceSpeakText(`Purpose: ${medicationInfo.purpose}`);
        setStatus(`Spoke: ${medicationInfo.purpose}`);
      } else if (medicationInfo) {
        await voiceSpeakText('Purpose not found on this label');
        setStatus('Purpose not found');
      } else {
        await voiceSpeakText('No medication scanned yet.');
        setStatus('No medication scanned');
      }
      break;
      
    case 'read_warnings':
      if (medicationInfo?.warnings && medicationInfo.warnings.length > 0) {
        await voiceSpeakText(`Warnings: ${medicationInfo.warnings.join('. ')}`);
        setStatus(`Spoke warnings`);
      } else if (medicationInfo) {
        await voiceSpeakText('No warnings detected on this label');
        setStatus('No warnings found');
      } else {
        await voiceSpeakText('No medication scanned yet. Please scan a label first.');
        setStatus('No medication scanned');
      }
      break;
      
    case 'read_expiration':
      if (medicationInfo?.expirationDate) {
        await voiceSpeakText(`Expires: ${medicationInfo.expirationDate}`);
        setStatus(`Spoke: Expires ${medicationInfo.expirationDate}`);
      } else if (medicationInfo?.prescriptionDate) {
        await voiceSpeakText(`Prescription date: ${medicationInfo.prescriptionDate}`);
        setStatus(`Spoke prescription date`);
      } else if (medicationInfo) {
        await voiceSpeakText('No expiration date found');
        setStatus('No expiration found');
      } else {
        await voiceSpeakText('No medication scanned yet.');
        setStatus('No medication scanned');
      }
      break;
      
    case 'read_instructions':
      if (medicationInfo?.dosageInstructions) {
        await voiceSpeakText(`Instructions: ${medicationInfo.dosageInstructions}`);
        setStatus(`Spoke instructions`);
      } else if (medicationInfo) {
        await voiceSpeakText('No instructions found');
        setStatus('Instructions not found');
      } else {
        await voiceSpeakText('No medication scanned yet.');
        setStatus('No medication scanned');
      }
      break;
      
    case 'repeat':
      if (medicationInfo) {
        const speechText = formatForSpeech(medicationInfo);
        await voiceSpeakText(speechText);
        setStatus('Repeated medication info');
      } else {
        await voiceSpeakText('Nothing to repeat. Please scan a label first.');
        setStatus('Nothing to repeat');
      }
      break;
      
    case 'help':
      const helpText = getHelpMessage();
      await voiceSpeakText(helpText);
      setStatus('Spoke help message');
      break;

    case 'take_photo':
      console.log('📸 TAKE PHOTO CASE TRIGGERED');  
    // Stop current voice listener
      await Voice.stop();
      setIsListening(false);
      voiceContextRef.current = 'camera'; // CHANGED
      await voiceSpeakText('Opening camera');
      setStatus('Opening camera...');
      
      // Open camera (which will start camera voice listener)
      await openCamera();
      break;

    default:
      await voiceSpeakText('Unknown command');
      setStatus('Unknown command');
      console.log('Unknown action:', action);
  }
};


  
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>MediSense AI</Text>
          <Text style={styles.subtitle}>Medical Label Reader</Text>
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
    
    {/* CHANGED: Only show if medicationInfo exists */}
    {medicationInfo ? (
      <View style={styles.textResultContainer}>
        <Text style={styles.textCategoryLabel}>Category: {textCategory}</Text>
        
        {/* Show extracted medical information */}
        <View style={styles.medInfoContainer}>
          {medicationInfo.drugName && (
            <View style={styles.medInfoField}>
              <Text style={styles.medInfoLabel}>Drug:</Text>
              <Text style={styles.medInfoValue}>{medicationInfo.drugName}</Text>
            </View>
          )}
          
          {medicationInfo.medicationType && (
            <View style={styles.medInfoField}>
              <Text style={styles.medInfoLabel}>Type:</Text>
              <Text style={styles.medInfoValue}>{medicationInfo.medicationType}</Text>
            </View>
          )}
          
          {medicationInfo.quantity && (
            <View style={styles.medInfoField}>
              <Text style={styles.medInfoLabel}>Quantity:</Text>
              <Text style={styles.medInfoValue}>{medicationInfo.quantity}</Text>
            </View>
          )}
          
          {medicationInfo.dosageAmount && (
            <View style={styles.medInfoField}>
              <Text style={styles.medInfoLabel}>Dosage:</Text>
              <Text style={styles.medInfoValue}>{medicationInfo.dosageAmount}</Text>
            </View>
          )}
          
          {medicationInfo.dosageInstructions && (
            <View style={styles.medInfoField}>
              <Text style={styles.medInfoLabel}>Instructions:</Text>
              <Text style={styles.medInfoValue}>{medicationInfo.dosageInstructions}</Text>
            </View>
          )}
          
          {medicationInfo.timing && (
            <View style={styles.medInfoField}>
              <Text style={styles.medInfoLabel}>Timing:</Text>
              <Text style={styles.medInfoValue}>{medicationInfo.timing}</Text>
            </View>
          )}
          
          {medicationInfo.purpose && (
            <View style={styles.medInfoField}>
              <Text style={styles.medInfoLabel}>Purpose:</Text>
              <Text style={styles.medInfoValue}>{medicationInfo.purpose}</Text>
            </View>
          )}
          
          {medicationInfo.warnings && medicationInfo.warnings.length > 0 && (
            <View style={styles.medInfoField}>
              <Text style={[styles.medInfoLabel, styles.medInfoWarning]}>⚠️ Warnings:</Text>
              <Text style={styles.medInfoWarning}>
                {medicationInfo.warnings.join(', ')}
              </Text>
            </View>
          )}
          
          {medicationInfo.expirationDate && (
            <View style={styles.medInfoField}>
              <Text style={styles.medInfoLabel}>Expires:</Text>
              <Text style={styles.medInfoValue}>{medicationInfo.expirationDate}</Text>
            </View>
          )}
          
          {medicationInfo.prescriptionDate && (
            <View style={styles.medInfoField}>
              <Text style={styles.medInfoLabel}>Prescribed:</Text>
              <Text style={styles.medInfoValue}>{medicationInfo.prescriptionDate}</Text>
            </View>
          )}
          
          {medicationInfo.pharmacy && (
            <View style={styles.medInfoField}>
              <Text style={styles.medInfoLabel}>Clinic:</Text>
              <Text style={styles.medInfoValue}>{medicationInfo.pharmacy}</Text>
            </View>
          )}
        </View>
        
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
    ) : extractedText ? (
      /* NEW: Show error when OCR worked but no medication info */
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>❌ No Medication Information Found</Text>
        <Text style={styles.errorSubtext}>
          The image was scanned but no medication details were detected.
        </Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => {
            setCapturedImage(null);
            setExtractedText('');
            openCamera();
          }}
        >
          <Text style={styles.retryButtonText}>📷 Retake Photo</Text>
        </TouchableOpacity>
      </View>
    ) : null}
  </View>
)}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.button}
             onPress={() => {
              stopSpeaking();
              openCamera();
            }}
            disabled={isProcessing}
          >
            <Text style={styles.buttonText}>📷 Capture & Read Text</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.uploadButton]}
            onPress={() => {
              stopSpeaking();
              pickImage();
            }}
            disabled={isProcessing}
          >
            <Text style={styles.buttonText}>📁 Upload Test Image</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.button}
            onPress={() => {
              stopSpeaking();
              handleVoice();
            }}
          >
            <Text style={styles.buttonText}>🎤 Voice Command</Text>
          </TouchableOpacity>
        {/* Remove test function
          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]}
            onPress={testSpeaker}
          >
            <Text style={styles.buttonText}>🔊 Test Speaker</Text>
          </TouchableOpacity>
        */}
        </View>

      </ScrollView>

      <Modal visible={showCamera} animationType="slide">
        <View style={styles.cameraContainer}>
          <CameraView style={styles.camera} ref={cameraRef} facing="back">
            <View style={styles.cameraOverlay}>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={async () => {
                stopSpeaking();
                await Voice.stop();
                voiceContextRef.current = 'main'; // CHANGED
                setShowCamera(false);
                }}
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
                  onPress={() => {
                    stopSpeaking();
                    takePicture();
                  }}
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
  errorContainer: {
  backgroundColor: '#8b0000',
  padding: 20,
  borderRadius: 8,
  marginTop: 15,
  alignItems: 'center',
},
errorText: {
  color: '#ffffff',
  fontSize: 16,
  fontWeight: 'bold',
  textAlign: 'center',
  marginBottom: 8,
},
errorSubtext: {
  color: '#ffcccc',
  fontSize: 14,
  textAlign: 'center',
  marginBottom: 10,
},
retryButton: {
  backgroundColor: '#4ecca3',
  paddingHorizontal: 20,
  paddingVertical: 12,
  borderRadius: 8,
  marginTop: 10,
},
retryButtonText: {
  color: '#ffffff',
  fontSize: 16,
  fontWeight: '600',
},
medInfoValue: {
  color: '#ffffff',
  fontSize: 14,
},
});