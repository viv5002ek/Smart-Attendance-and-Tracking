import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LocationService } from '@/services/LocationService';
import { CircleUtils } from '@/utils/CircleUtils';
import { supabase, Session } from '@/lib/supabase';

export default function StudentTab() {
  const [sessionCode, setSessionCode] = useState('');
  const [studentName, setStudentName] = useState('');
  const [regNo, setRegNo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionFound, setSessionFound] = useState(false);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);

  const verifySession = async () => {
    if (!sessionCode || sessionCode.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit session code.');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionCode)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        Alert.alert('Error', 'Invalid or expired session code.');
        return;
      }

      setCurrentSession(data);
      setSessionFound(true);
      Alert.alert('Success', `Session found!\nFaculty: ${data.faculty_name}\nStudents: ${data.student_list.length}`);
    } catch (error) {
      console.error('Session verification error:', error);
      Alert.alert('Error', 'Failed to verify session. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const submitAttendance = async () => {
    if (!studentName || !regNo || !currentSession) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }

    setIsLoading(true);
    try {
      // Verify WiFi connection
      const isConnectedToiBUS = await LocationService.verifyiBUSConnection();
      if (!isConnectedToiBUS) {
        Alert.alert(
          'WiFi Required',
          'You must be connected to iBUS@MUJ WiFi network to mark attendance.'
        );
        setIsLoading(false);
        return;
      }

      // Check if student is in faculty list
      if (!CircleUtils.isStudentInList(regNo, currentSession.student_list)) {
        Alert.alert(
          'Registration Not Found',
          'Your registration number is not in the faculty\'s student list. Please check with your faculty.'
        );
        setIsLoading(false);
        return;
      }

      // Get student's pinpoint location
      const locationData = await LocationService.getHighAccuracyLocation();
      const studentRadius = locationData.coords.accuracy + 1; // accuracy + 1 meter

      // Calculate distance from session location
      const distance = CircleUtils.getDistanceInMeters(
        currentSession.session_latitude,
        currentSession.session_longitude,
        locationData.coords.latitude,
        locationData.coords.longitude
      );

      // Calculate circle overlap percentage
      const coveragePercentage = CircleUtils.calculateCircleOverlap(
        currentSession.session_latitude,
        currentSession.session_longitude,
        currentSession.session_radius,
        locationData.coords.latitude,
        locationData.coords.longitude,
        studentRadius
      );

      // Determine status based on coverage
      const status = CircleUtils.determineAttendanceStatus(coveragePercentage);

      // Get correct student name from faculty list
      const correctName = CircleUtils.getStudentName(regNo, currentSession.student_list) || studentName;

      // Submit attendance record
      const { error } = await supabase
        .from('attendance')
        .insert({
          session_id: currentSession.id,
          student_name: correctName,
          student_registration: regNo,
          student_latitude: locationData.coords.latitude,
          student_longitude: locationData.coords.longitude,
          student_accuracy: locationData.coords.accuracy,
          student_radius: studentRadius,
          distance_from_session: distance,
          coverage_percentage: coveragePercentage,
          status: status,
          wifi_ssid: locationData.wifiSSID,
        });

      if (error) {
        console.error('Attendance submission error:', error);
        if (error.code === '23505') {
          Alert.alert('Error', 'You have already marked attendance for this session.');
        } else {
          Alert.alert('Error', `Failed to submit attendance: ${error.message}`);
        }
        setIsLoading(false);
        return;
      }

      const statusMessage = status === 'present' 
        ? `✅ PRESENT - You are within the attendance zone!\n\nCoverage: ${coveragePercentage.toFixed(1)}%\nDistance: ${distance.toFixed(1)}m\nYour radius: ${studentRadius.toFixed(1)}m\nSession radius: ${currentSession.session_radius.toFixed(1)}m`
        : `⚠️ PROXY - You are outside the attendance zone.\n\nCoverage: ${coveragePercentage.toFixed(1)}% (Need ≥50%)\nDistance: ${distance.toFixed(1)}m\nYour radius: ${studentRadius.toFixed(1)}m\nSession radius: ${currentSession.session_radius.toFixed(1)}m`;

      Alert.alert('Attendance Submitted!', statusMessage);
      
      // Reset form
      setSessionCode('');
      setStudentName('');
      setRegNo('');
      setSessionFound(false);
      setCurrentSession(null);
    } catch (error) {
      console.error('Attendance submission error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to submit attendance');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <MaterialIcons name="how-to-reg" size={40} color="#10B981" />
        <Text style={styles.title}>Mark Attendance</Text>
        <Text style={styles.subtitle}>Enter session code and your details</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Step 1: Enter Session Code</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter 6-digit session code"
          value={sessionCode}
          onChangeText={setSessionCode}
          maxLength={6}
          keyboardType="number-pad"
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={[styles.verifyButton, sessionCode.length !== 6 && styles.disabledButton]}
          onPress={verifySession}
          disabled={isLoading || sessionCode.length !== 6}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <MaterialIcons name="search" size={20} color="#FFFFFF" />
              <Text style={styles.verifyButtonText}>Verify Session</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {sessionFound && currentSession && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Step 2: Enter Your Details</Text>
          
          <View style={styles.sessionInfo}>
            <Text style={styles.sessionInfoText}>Faculty: {currentSession.faculty_name}</Text>
            <Text style={styles.sessionInfoText}>Students: {currentSession.student_list.length}</Text>
            <Text style={styles.sessionInfoText}>
              Expires: {new Date(currentSession.expires_at).toLocaleTimeString()}
            </Text>
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              value={studentName}
              onChangeText={setStudentName}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Registration Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your registration number"
              value={regNo}
              onChangeText={setRegNo}
              autoCapitalize="characters"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, (!studentName || !regNo) && styles.disabledButton]}
            onPress={submitAttendance}
            disabled={isLoading || !studentName || !regNo}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <MaterialIcons name="send" size={20} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Submit Attendance</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.infoCard}>
        <MaterialIcons name="info" size={24} color="#3B82F6" />
        <View style={styles.infoContent}>
          <Text style={styles.infoTitle}>How Circle-Based Attendance Works:</Text>
          <Text style={styles.infoText}>
            • Faculty creates a circle with radius = GPS accuracy + 10m{'\n'}
            • Your circle has radius = GPS accuracy + 1m{'\n'}
            • If your circle overlaps ≥50% with faculty circle = PRESENT{'\n'}
            • If overlap &lt;50% = PROXY{'\n'}
            • Must be connected to iBUS@MUJ WiFi{'\n'}
            • Registration number must match faculty's list
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  contentContainer: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 15,
  },
  sessionInfo: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  sessionInfoText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  inputContainer: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  verifyButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  submitButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  infoCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 10,
  },
  infoContent: {
    flex: 1,
    marginLeft: 15,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
});