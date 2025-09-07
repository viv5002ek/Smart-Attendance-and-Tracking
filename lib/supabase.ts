import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = 'https://ztaavlqakzdlkzacqnlp.supabase.co';
const supabaseAnonKey = 'sb_publishable_idkKklD6w9-AOgSxXqvBzw_JiypjQOz';

        
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// Database types
export interface User {
  id: string;
  email: string;
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