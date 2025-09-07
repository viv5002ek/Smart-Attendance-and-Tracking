import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { MaterialIcons } from '@expo/vector-icons';
import MapView, { Circle, Marker } from 'react-native-maps';
import { LocationService } from '@/services/LocationService';
import { CircleUtils } from '@/utils/CircleUtils';
import { supabase, User, Session, Attendance } from '@/lib/supabase';

interface Student {
  name: string;
  registration_number: string;
  status: 'present' | 'pending' | 'absent' | 'proxy';
  attendance?: Attendance;
}

export default function FacultyTab() {
  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [sessionCode, setSessionCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [sessionActive, setSessionActive] = useState(false);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (sessionActive && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            endSession();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [sessionActive, timeRemaining]);

  useEffect(() => {
    if (sessionActive && currentSession) {
      const interval = setInterval(() => {
        fetchAttendanceRecords();
      }, 2000); // Poll every 2 seconds
      return () => clearInterval(interval);
    }
  }, [sessionActive, currentSession]);

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

  const generateSessionCode = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const uploadExcel = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const fileUri = result.assets[0].uri;
        const fileContent = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const workbook = XLSX.read(fileContent, { type: 'base64' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const parsedStudents: Student[] = jsonData.map((row: any) => ({
          name: (row.name || row.Name || '').toString().trim(),
          registration_number: (row.registration_number || row['Registration Number'] || row.reg_no || '').toString().trim(),
          status: 'pending' as const,
        }));

        setStudents(parsedStudents);
        Alert.alert('Success', `${parsedStudents.length} students loaded from Excel file.`);
      }
    } catch (error) {
      console.error('Excel upload error:', error);
      Alert.alert('Error', 'Failed to read Excel file. Please try again.');
    }
  };

  const startSession = async () => {
    if (students.length === 0) {
      Alert.alert('Error', 'Please upload a student list first.');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'Please login first.');
      return;
    }

    setIsLoading(true);
    try {
      // Verify WiFi connection
      const isConnectedToiBUS = await LocationService.verifyiBUSConnection();
      if (!isConnectedToiBUS) {
        Alert.alert(
          'WiFi Required',
          'You must be connected to iBUS@MUJ WiFi network to create an attendance session.'
        );
        setIsLoading(false);
        return;
      }

      // Get pinpoint location
      const locationData = await LocationService.getHighAccuracyLocation();
      
      // Generate session code
      const code = generateSessionCode();
      const sessionRadius = locationData.coords.accuracy + 10; // accuracy + 10 meters
      
      // Create session in database
      const { error } = await supabase
        .from('sessions')
        .insert({
          id: code,
          faculty_id: user.id,
          faculty_name: user.name,
          student_list: students.map(s => ({ name: s.name, registration_number: s.registration_number })),
          session_latitude: locationData.coords.latitude,
          session_longitude: locationData.coords.longitude,
          session_accuracy: locationData.coords.accuracy,
          session_radius: sessionRadius,
          wifi_ssid: locationData.wifiSSID,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          is_active: true,
        });

      if (error) {
        throw new Error(`Failed to create session: ${error.message}`);
      }

      setSessionCode(code);
      setTimeRemaining(600); // 10 minutes
      setSessionActive(true);
      setCurrentSession({
        id: code,
        faculty_id: user.id,
        faculty_name: user.name,
        student_list: students.map(s => ({ name: s.name, registration_number: s.registration_number })),
        session_latitude: locationData.coords.latitude,
        session_longitude: locationData.coords.longitude,
        session_accuracy: locationData.coords.accuracy,
        session_radius: sessionRadius,
        wifi_ssid: locationData.wifiSSID || 'iBUS@MUJ',
        is_active: true,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
      });

      Alert.alert(
        'Session Created!',
        `Session Code: ${code}\nValid for 10 minutes\nRadius: ${Math.round(sessionRadius)}m\nLocation: ${locationData.coords.latitude.toFixed(6)}, ${locationData.coords.longitude.toFixed(6)}`
      );
    } catch (error) {
      console.error('Session creation error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create session');
    } finally {
      setIsLoading(false);
    }
  };

  const endSession = async () => {
    if (currentSession) {
      // Mark session as inactive
      await supabase
        .from('sessions')
        .update({ is_active: false })
        .eq('id', currentSession.id);

      // Convert pending to absent
      const updatedStudents = students.map(student => ({
        ...student,
        status: student.status === 'pending' ? 'absent' as const : student.status
      }));
      setStudents(updatedStudents);
    }
    
    setSessionActive(false);
    setTimeRemaining(0);
    setCurrentSession(null);
  };

  const fetchAttendanceRecords = async () => {
    if (!currentSession) return;

    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('session_id', currentSession.id);

    if (data) {
      setAttendanceRecords(data);
      
      // Update student statuses
      const updatedStudents = students.map(student => {
        const attendance = data.find(a => 
          a.student_registration.toLowerCase() === student.registration_number.toLowerCase()
        );
        
        if (attendance) {
          return {
            ...student,
            status: attendance.status,
            attendance
          };
        }
        return student;
      });
      
      setStudents(updatedStudents);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return '#10B981';
      case 'proxy': return '#F59E0B';
      case 'pending': return '#6B7280';
      case 'absent': return '#EF4444';
      default: return '#6B7280';
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <MaterialIcons name="school" size={40} color="#3B82F6" />
        <Text style={styles.title}>Faculty Dashboard</Text>
        <Text style={styles.subtitle}>Upload student list and manage attendance</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Step 1: Upload Student List</Text>
        <TouchableOpacity style={styles.uploadButton} onPress={uploadExcel}>
          <MaterialIcons name="upload-file" size={24} color="#FFFFFF" />
          <Text style={styles.uploadButtonText}>Upload Excel File</Text>
        </TouchableOpacity>
        {students.length > 0 && (
          <Text style={styles.studentCount}>
            {students.length} students loaded
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Step 2: Start Session</Text>
        <TouchableOpacity
          style={[styles.createButton, (students.length === 0 || sessionActive) && styles.disabledButton]}
          onPress={startSession}
          disabled={isLoading || students.length === 0 || sessionActive}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <MaterialIcons name="play-arrow" size={24} color="#FFFFFF" />
              <Text style={styles.createButtonText}>Start Attendance Session</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {sessionActive && currentSession && (
        <>
          <View style={styles.sessionCard}>
            <Text style={styles.sessionTitle}>Session Active</Text>
            <View style={styles.codeContainer}>
              <Text style={styles.codeLabel}>Session Code:</Text>
              <Text style={styles.code}>{sessionCode}</Text>
            </View>
            <View style={styles.timerContainer}>
              <MaterialIcons name="timer" size={24} color="#EF4444" />
              <Text style={styles.timer}>{formatTime(timeRemaining)}</Text>
            </View>
            <TouchableOpacity style={styles.endButton} onPress={endSession}>
              <Text style={styles.endButtonText}>End Session</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Live Map View</Text>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: currentSession.session_latitude,
                longitude: currentSession.session_longitude,
                latitudeDelta: 0.001,
                longitudeDelta: 0.001,
              }}
            >
              {/* Faculty location circle */}
              <Circle
                center={{
                  latitude: currentSession.session_latitude,
                  longitude: currentSession.session_longitude,
                }}
                radius={currentSession.session_radius}
                fillColor="rgba(59, 130, 246, 0.2)"
                strokeColor="#3B82F6"
                strokeWidth={2}
              />
              
              {/* Faculty marker */}
              <Marker
                coordinate={{
                  latitude: currentSession.session_latitude,
                  longitude: currentSession.session_longitude,
                }}
                title="Faculty Location"
                description={`Radius: ${Math.round(currentSession.session_radius)}m`}
                pinColor="#3B82F6"
              />

              {/* Student markers */}
              {attendanceRecords.map((attendance) => (
                <React.Fragment key={attendance.id}>
                  <Circle
                    center={{
                      latitude: attendance.student_latitude,
                      longitude: attendance.student_longitude,
                    }}
                    radius={attendance.student_radius}
                    fillColor={attendance.status === 'present' ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)"}
                    strokeColor={attendance.status === 'present' ? "#10B981" : "#F59E0B"}
                    strokeWidth={1}
                  />
                  <Marker
                    coordinate={{
                      latitude: attendance.student_latitude,
                      longitude: attendance.student_longitude,
                    }}
                    title={attendance.student_name}
                    description={`${attendance.student_registration} - ${attendance.status.toUpperCase()}`}
                    pinColor={attendance.status === 'present' ? "#10B981" : "#F59E0B"}
                  />
                </React.Fragment>
              ))}
            </MapView>
          </View>
        </>
      )}

      {students.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Student Attendance</Text>
          {students.map((student, index) => (
            <View key={index} style={styles.studentRow}>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{student.name}</Text>
                <Text style={styles.studentReg}>{student.registration_number}</Text>
                {student.attendance && (
                  <Text style={styles.studentDetails}>
                    Coverage: {student.attendance.coverage_percentage.toFixed(1)}% | 
                    Distance: {student.attendance.distance_from_session.toFixed(1)}m
                  </Text>
                )}
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(student.status) + '20' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(student.status) }]}>
                  {student.status.toUpperCase()}
                </Text>
              </View>
            </View>
          ))}
        </View>
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
  uploadButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  studentCount: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
  },
  createButtonText: {
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
  codeContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  codeLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 5,
  },
  code: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1F2937',
    letterSpacing: 4,
    fontFamily: 'monospace',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  timer: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#EF4444',
    marginLeft: 8,
    fontFamily: 'monospace',
  },
  endButton: {
    backgroundColor: '#EF4444',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  endButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  map: {
    height: 300,
    borderRadius: 8,
  },
  studentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  studentReg: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  studentDetails: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
});