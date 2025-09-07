import React, { useState, useEffect } from 'react';
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
import { supabase, User, Session } from '@/lib/supabase';

export default function MarkAttendanceTab() {
  const [user, setUser] = useState<User | null>(null);
  const [sessionCode, setSessionCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [attendanceMarked, setAttendanceMarked] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();
      setUser(data);
    }
  };

  const findSession = async () => {
    if (!sessionCode.trim()) {
      Alert.alert('Error', 'Please enter session code');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionCode.trim())
        .eq('is_active', true)
        .single();

      if (error || !data) {
        Alert.alert('Error', 'Session not found or expired');
        return;
      }

      // Check if session is still active
      if (new Date(data.expires_at) < new Date()) {
        Alert.alert('Error', 'Session has expired');
        return;
      }

      setCurrentSession(data);
    } catch (error) {
      console.error('Session lookup error:', error);
      Alert.alert('Error', 'Failed to find session');
    } finally {
      setIsLoading(false);
    }
  };

  const markAttendance = async () => {
    if (!currentSession || !user) {
      Alert.alert('Error', 'Session or user data missing');
      return;
    }

    // Check if student is in faculty list
    const isInList = CircleUtils.isStudentInList(
      user.registration_number,
      currentSession.student_list
    );

    if (!isInList) {
      Alert.alert('Error', 'Your registration number is not in the faculty\'s student list');
      return;
    }

    setIsLoading(true);
    try {
      // Get student's pinpoint location
      const locationData = await LocationService.getHighAccuracyLocation();
      
      const studentRadius = locationData.coords.accuracy + 1; // accuracy + 1 meter
      
      // Calculate distance from session
      const distance = CircleUtils.getDistanceInMeters(
        currentSession.session_latitude,
        currentSession.session_longitude,
        locationData.coords.latitude,
        locationData.coords.longitude
      );

      // Calculate coverage percentage
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

      // Insert attendance record
      const { error } = await supabase
        .from('attendance')
        .insert({
          session_id: currentSession.id,
          student_name: user.name,
          student_registration: user.registration_number,
          student_latitude: locationData.coords.latitude,
          student_longitude: locationData.coords.longitude,
          student_accuracy: locationData.coords.accuracy,
          student_radius: studentRadius,
          distance_from_session: distance,
          coverage_percentage: coveragePercentage,
          status: status,
          wifi_ssid: locationData.wifiSSID || 'iBUS@MUJ',
        });

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          Alert.alert('Error', 'You have already marked attendance for this session');
        } else {
          throw error;
        }
        return;
      }

      setAttendanceMarked(true);
      Alert.alert(
        'Attendance Marked!',
        `Status: ${status.toUpperCase()}\nCoverage: ${coveragePercentage.toFixed(1)}%\nDistance: ${distance.toFixed(1)}m`
      );
    } catch (error) {
      console.error('Attendance marking error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to mark attendance');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setSessionCode('');
    setCurrentSession(null);
    setAttendanceMarked(false);
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error" size={48} color="#EF4444" />
          <Text style={styles.errorText}>Please create your profile first</Text>
          <Text style={styles.errorSubtext}>Go to Profile tab to set up your account</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <MaterialIcons name="how-to-reg" size={40} color="#3B82F6" />
        <Text style={styles.title}>Mark Attendance</Text>
        <Text style={styles.subtitle}>Enter session code to mark your attendance</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Student Information</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Name:</Text>
          <Text style={styles.infoValue}>{user.name}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Registration:</Text>
          <Text style={styles.infoValue}>{user.registration_number}</Text>
        </View>
      </View>

      {!currentSession ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Enter Session Code</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter 6-digit session code"
            value={sessionCode}
            onChangeText={setSessionCode}
            maxLength={6}
            keyboardType="numeric"
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.findButton, !sessionCode.trim() && styles.disabledButton]}
            onPress={findSession}
            disabled={isLoading || !sessionCode.trim()}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <MaterialIcons name="search" size={20} color="#FFFFFF" />
                <Text style={styles.findButtonText}>Find Session</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.sessionCard}>
            <Text style={styles.sessionTitle}>Session Found</Text>
            <View style={styles.sessionInfo}>
              <Text style={styles.sessionLabel}>Faculty:</Text>
              <Text style={styles.sessionValue}>{currentSession.faculty_name}</Text>
            </View>
            <View style={styles.sessionInfo}>
              <Text style={styles.sessionLabel}>Code:</Text>
              <Text style={styles.sessionValue}>{currentSession.id}</Text>
            </View>
            <View style={styles.sessionInfo}>
              <Text style={styles.sessionLabel}>Expires:</Text>
              <Text style={styles.sessionValue}>
                {new Date(currentSession.expires_at).toLocaleTimeString()}
              </Text>
            </View>
            <View style={styles.sessionInfo}>
              <Text style={styles.sessionLabel}>Students:</Text>
              <Text style={styles.sessionValue}>{currentSession.student_list.length}</Text>
            </View>
          </View>

          {!attendanceMarked ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Mark Your Attendance</Text>
              <Text style={styles.instructions}>
                Make sure you are within the session location. Your location will be verified automatically.
              </Text>
              <TouchableOpacity
                style={styles.markButton}
                onPress={markAttendance}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="location-on" size={20} color="#FFFFFF" />
                    <Text style={styles.markButtonText}>Mark Attendance</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.successCard}>
              <MaterialIcons name="check-circle" size={48} color="#10B981" />
              <Text style={styles.successTitle}>Attendance Marked!</Text>
              <Text style={styles.successText}>
                Your attendance has been successfully recorded.
              </Text>
              <TouchableOpacity style={styles.newSessionButton} onPress={resetForm}>
                <Text style={styles.newSessionButtonText}>Mark Another Session</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#EF4444',
    marginTop: 10,
  },
  errorSubtext: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 5,
    textAlign: 'center',
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 15,
    fontSize: 18,
    textAlign: 'center',
    fontFamily: 'monospace',
    letterSpacing: 2,
    marginBottom: 15,
  },
  findButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
  },
  findButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  sessionCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  sessionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3B82F6',
    textAlign: 'center',
    marginBottom: 15,
  },
  sessionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  sessionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  sessionValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
  instructions: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 15,
    textAlign: 'center',
  },
  markButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
  },
  markButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  successCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10B981',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10B981',
    marginTop: 15,
    marginBottom: 10,
  },
  successText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  newSessionButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  newSessionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});