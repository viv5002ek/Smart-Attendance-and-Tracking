/*
  # Smart Attendance App Database Schema

  1. New Tables
    - `profiles` - Extends auth.users with role information
    - `attendance_sessions` - Created by professors with location and student list
    - `attendance_records` - Individual student attendance submissions

  2. Security  
    - Enable RLS on all tables
    - Add policies for authenticated users based on roles
    - Prevent duplicate attendance submissions

  3. Features
    - Location-based attendance with coordinates and WiFi SSID
    - Session expiry management (10 minutes)
    - Status calculation (present/pending/absent)
*/

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  role TEXT CHECK (role IN ('professor', 'student')) DEFAULT 'student',
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Attendance sessions table (created by professors)
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID REFERENCES profiles(id) NOT NULL,
  class_name TEXT NOT NULL DEFAULT 'Attendance Session',
  expected_students JSONB NOT NULL DEFAULT '[]',
  secret_code TEXT NOT NULL UNIQUE,
  origin_latitude DOUBLE PRECISION NOT NULL,
  origin_longitude DOUBLE PRECISION NOT NULL,
  origin_wifi_ssid TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professors can create sessions"
  ON attendance_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'professor'
  ));

CREATE POLICY "Professors can read own sessions"
  ON attendance_sessions
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Students can read active sessions by code"
  ON attendance_sessions
  FOR SELECT
  TO authenticated
  USING (
    expires_at > NOW() 
    AND is_active = TRUE
  );

-- Attendance records table (student submissions)
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES attendance_sessions(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES profiles(id),
  student_name TEXT NOT NULL,
  student_reg_no TEXT NOT NULL,
  marked_latitude DOUBLE PRECISION NOT NULL,
  marked_longitude DOUBLE PRECISION NOT NULL,
  marked_wifi_ssid TEXT,
  distance_from_origin DOUBLE PRECISION,
  status TEXT CHECK (status IN ('present', 'pending', 'absent')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate attendance for same session
  UNIQUE(session_id, student_reg_no)
);

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can insert own attendance"
  ON attendance_records
  FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid() OR student_id IS NULL);

CREATE POLICY "Professors can read attendance for their sessions"
  ON attendance_records
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM attendance_sessions 
    WHERE attendance_sessions.id = session_id 
    AND attendance_sessions.created_by = auth.uid()
  ));

CREATE POLICY "Students can read own attendance"
  ON attendance_records
  FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

-- Function to automatically expire old sessions
CREATE OR REPLACE FUNCTION expire_old_sessions()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE attendance_sessions 
  SET is_active = FALSE 
  WHERE expires_at < NOW() AND is_active = TRUE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_code ON attendance_sessions(secret_code);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_active ON attendance_sessions(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_attendance_records_session ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student ON attendance_records(student_reg_no);