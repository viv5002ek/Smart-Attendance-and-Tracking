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
import { supabase, User } from '@/lib/supabase';

export default function ProfileTab() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [role, setRole] = useState<'student' | 'faculty'>('student');

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
      
      if (data) {
        setUser(data);
        setName(data.name);
        setRegistrationNumber(data.registration_number);
        setRole(data.role);
      } else {
        // New user, show editing form
        setIsEditing(true);
      }
    } else {
      // No authenticated user, create anonymous session
      await createAnonymousUser();
    }
  };

  const createAnonymousUser = async () => {
    setIsEditing(true);
  };

  const saveProfile = async () => {
    if (!name.trim() || !registrationNumber.trim()) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    setIsLoading(true);
    try {
      // Check if user exists
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      let userId = authUser?.id;
      
      if (!userId) {
        // Create anonymous user session
        const { data: { user: newUser }, error: authError } = await supabase.auth.signInAnonymously();
        if (authError) throw authError;
        userId = newUser?.id;
      }

      if (!userId) {
        throw new Error('Failed to create user session');
      }

      // Check if registration number already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('registration_number', registrationNumber.trim())
        .neq('id', userId)
        .single();

      if (existingUser) {
        Alert.alert('Error', 'Registration number already exists. Please use a different one.');
        setIsLoading(false);
        return;
      }

      // Insert or update user profile
      const { data, error } = await supabase
        .from('users')
        .upsert({
          id: userId,
          name: name.trim(),
          registration_number: registrationNumber.trim(),
          role: role,
        })
        .select()
        .single();

      if (error) throw error;

      setUser(data);
      setIsEditing(false);
      Alert.alert('Success', 'Profile saved successfully!');
    } catch (error) {
      console.error('Profile save error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save profile');
    } finally {
      setIsLoading(false);
    }
  };

  const editProfile = () => {
    setIsEditing(true);
  };

  const cancelEdit = () => {
    if (user) {
      setName(user.name);
      setRegistrationNumber(user.registration_number);
      setRole(user.role);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <MaterialIcons name="person-add" size={40} color="#3B82F6" />
          <Text style={styles.title}>{user ? 'Edit Profile' : 'Create Profile'}</Text>
          <Text style={styles.subtitle}>Enter your details to continue</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Information</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Registration Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your registration number"
              value={registrationNumber}
              onChangeText={setRegistrationNumber}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Role *</Text>
            <View style={styles.roleContainer}>
              <TouchableOpacity
                style={[styles.roleButton, role === 'student' && styles.roleButtonActive]}
                onPress={() => setRole('student')}
              >
                <MaterialIcons 
                  name="school" 
                  size={20} 
                  color={role === 'student' ? '#FFFFFF' : '#6B7280'} 
                />
                <Text style={[styles.roleButtonText, role === 'student' && styles.roleButtonTextActive]}>
                  Student
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.roleButton, role === 'faculty' && styles.roleButtonActive]}
                onPress={() => setRole('faculty')}
              >
                <MaterialIcons 
                  name="person" 
                  size={20} 
                  color={role === 'faculty' ? '#FFFFFF' : '#6B7280'} 
                />
                <Text style={[styles.roleButtonText, role === 'faculty' && styles.roleButtonTextActive]}>
                  Faculty
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.saveButton, (!name.trim() || !registrationNumber.trim()) && styles.disabledButton]}
              onPress={saveProfile}
              disabled={isLoading || !name.trim() || !registrationNumber.trim()}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="save" size={20} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>Save Profile</Text>
                </>
              )}
            </TouchableOpacity>

            {user && (
              <TouchableOpacity style={styles.cancelButton} onPress={cancelEdit}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <MaterialIcons name="person" size={40} color="#3B82F6" />
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Your account information</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Personal Information</Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Name:</Text>
          <Text style={styles.infoValue}>{user.name}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Registration Number:</Text>
          <Text style={styles.infoValue}>{user.registration_number}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Role:</Text>
          <View style={styles.roleBadge}>
            <MaterialIcons 
              name={user.role === 'faculty' ? 'person' : 'school'} 
              size={16} 
              color="#3B82F6" 
            />
            <Text style={styles.roleBadgeText}>{user.role.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Member Since:</Text>
          <Text style={styles.infoValue}>
            {new Date(user.created_at).toLocaleDateString()}
          </Text>
        </View>

        <TouchableOpacity style={styles.editButton} onPress={editProfile}>
          <MaterialIcons name="edit" size={20} color="#FFFFFF" />
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>App Information</Text>
        <Text style={styles.appInfo}>
          Smart Attendance App v1.0.0{'\n'}
          Circle-based location detection{'\n'}
          Requires iBUS@MUJ WiFi connection{'\n'}
          Built with Expo & Supabase
        </Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6B7280',
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
  roleContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  roleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  roleButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  roleButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  roleButtonTextActive: {
    color: '#FFFFFF',
  },
  buttonContainer: {
    marginTop: 20,
  },
  saveButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#6B7280',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
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
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
  },
  editButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  appInfo: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
});