import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = 'https://ztaavlqakzdlkzacqnlp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0YWF2bHFha3pkbGt6YWNxbmxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzNTMzNzEsImV4cCI6MjA3MTkyOTM3MX0.KAZM3BDiqxnU4ObKKH6qWpeAGyHyIW1YnggAWGhy3ns';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: Platform.OS !== 'web',
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Database types
export interface User {
  id: string;
  name: string;
  registration_number: string;
  role: 'student' | 'faculty';
  created_at: string;
}

export interface Session {
  id: string;
  faculty_id: string;
  faculty_name: string;
  student_list: Array<{ name: string; registration_number: string }>;
  session_latitude: number;
  session_longitude: number;
  session_accuracy: number;
  session_radius: number;
  wifi_ssid: string;
  is_active: boolean;
  expires_at: string;
  created_at: string;
}

export interface Attendance {
  id: string;
  session_id: string;
  student_name: string;
  student_registration: string;
  student_latitude: number;
  student_longitude: number;
  student_accuracy: number;
  student_radius: number;
  distance_from_session: number;
  coverage_percentage: number;
  status: 'present' | 'proxy';
  wifi_ssid: string;
  created_at: string;
}