import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

interface LoginModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function LoginModal({ visible, onClose, onSuccess }: LoginModalProps) {
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [role, setRole] = useState<'student' | 'faculty'>('student');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim() || !name.trim() || !registrationNumber.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    try {
      // Check if registration number already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('registration_number', registrationNumber.trim())
        .single();

      if (existingUser) {
        Alert.alert('Error', 'Registration number already exists. Please use a different one.');
        return;
      }

      // Sign up user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('Failed to create user account');
      }

      // Insert user profile
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: email.trim(),
          name: name.trim(),
          registration_number: registrationNumber.trim(),
          role: role,
        });

      if (profileError) throw profileError;

      Alert.alert('Success', 'Account created successfully!');
      onSuccess();
      resetForm();
    } catch (error) {
      console.error('Sign up error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) throw error;

      Alert.alert('Success', 'Signed in successfully!');
      onSuccess();
      resetForm();
    } catch (error) {
      console.error('Sign in error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setRegistrationNumber('');
    setRole('student');
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    resetForm();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <MaterialIcons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
          <Text style={styles.title}>
            {isSignUp ? 'Create Account' : 'Sign In'}
          </Text>
          <Text style={styles.subtitle}>
            {isSignUp ? 'Enter your details to get started' : 'Welcome back! Please sign in'}
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
            />
          </View>

          {isSignUp && (
            <>
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
            </>
          )}

          <TouchableOpacity
            style={[
              styles.authButton, 
              (!email.trim() || !password.trim() || (isSignUp && (!name.trim() || !registrationNumber.trim()))) && styles.disabledButton
            ]}
            onPress={isSignUp ? handleSignUp : handleSignIn}
            disabled={isLoading || !email.trim() || !password.trim() || (isSignUp && (!name.trim() || !registrationNumber.trim()))}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <MaterialIcons name={isSignUp ? "person-add" : "login"} size={20} color="#FFFFFF" />
                <Text style={styles.authButtonText}>
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.toggleButton} onPress={toggleMode}>
            <Text style={styles.toggleButtonText}>
              {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  contentContainer: {
    flexGrow: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    alignItems: 'center',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    padding: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 5,
    textAlign: 'center',
  },
  form: {
    padding: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 15,
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
    padding: 15,
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
  authButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
  },
  authButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  toggleButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  toggleButtonText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '500',
  },
});