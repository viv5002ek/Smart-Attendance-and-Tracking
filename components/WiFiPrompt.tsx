import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LocationService } from '@/services/LocationService';

interface WiFiPromptProps {
  visible: boolean;
  onClose: () => void;
  onContinue: () => void;
}

export default function WiFiPrompt({ visible, onClose, onContinue }: WiFiPromptProps) {
  const checkWiFiAgain = async () => {
    const isConnected = await LocationService.checkWiFiConnection();
    if (isConnected) {
      Alert.alert('Success', 'Connected to iBUS@MUJ WiFi!');
      onContinue();
    } else {
      Alert.alert('Not Connected', 'Please connect to iBUS@MUJ WiFi network and try again.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <MaterialIcons name="wifi" size={48} color="#F59E0B" />
          <Text style={styles.title}>WiFi Connection Required</Text>
          <Text style={styles.message}>
            Please connect to "iBUS@MUJ" WiFi network for accurate attendance marking.
          </Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.checkButton} onPress={checkWiFiAgain}>
              <MaterialIcons name="refresh" size={20} color="#FFFFFF" />
              <Text style={styles.checkButtonText}>Check Again</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.continueButton} onPress={onContinue}>
              <Text style={styles.continueButtonText}>Continue Anyway</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    maxWidth: 320,
    width: '100%',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '500',
  },
  checkButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
  },
  checkButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  continueButton: {
    backgroundColor: '#F59E0B',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});