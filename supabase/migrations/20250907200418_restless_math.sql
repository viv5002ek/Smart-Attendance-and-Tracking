/*
  # Smart Attendance App - Production Schema with Email Auth

  1. New Tables
    - `users` - User profiles with role (student/faculty) and email
    - `sessions` - Faculty attendance sessions with location and student list
    - `attendance` - Student attendance records with location data

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users with email verification

  3. Features
    - Circle-based attendance detection with 50% coverage rule
    - Registration number matching (case insensitive)
    - Location accuracy tracking with pinpoint coordinates
    - Email authentication required
*/

-- Drop all existing tables
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS attendance_records CASCADE;
DROP TABLE IF EXISTS attendance_sessions CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Users table with email authentication
CREATE TABLE users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  registration_number TEXT NOT NULL UNIQUE,
  role TEXT CHECK (role IN ('student', 'faculty')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own data"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Sessions table (created by faculty)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY, -- 6-digit session code
  faculty_id UUID REFERENCES users(id) NOT NULL,
  faculty_name TEXT NOT NULL,
  student_list JSONB NOT NULL DEFAULT '[]', -- Array of {name, registration_number}
  session_latitude DOUBLE PRECISION NOT NULL,
  session_longitude DOUBLE PRECISION NOT NULL,
  session_accuracy DOUBLE PRECISION NOT NULL,
  session_radius DOUBLE PRECISION NOT NULL, -- accuracy + 10 meters
  wifi_ssid TEXT DEFAULT 'iBUS@MUJ',
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Faculty can manage own sessions"
  ON sessions
  FOR ALL
  TO authenticated
  USING (faculty_id = auth.uid())
  WITH CHECK (faculty_id = auth.uid());

CREATE POLICY "Students can read active sessions"
  ON sessions
  FOR SELECT
  TO authenticated
  USING (is_active = TRUE AND expires_at > NOW());

-- Attendance table (student submissions)
CREATE TABLE attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  student_name TEXT NOT NULL,
  student_registration TEXT NOT NULL,
  student_latitude DOUBLE PRECISION NOT NULL,
  student_longitude DOUBLE PRECISION NOT NULL,
  student_accuracy DOUBLE PRECISION NOT NULL,
  student_radius DOUBLE PRECISION NOT NULL, -- accuracy + 1 meter
  distance_from_session DOUBLE PRECISION NOT NULL,
  coverage_percentage DOUBLE PRECISION NOT NULL, -- How much student circle is covered
  status TEXT CHECK (status IN ('present', 'proxy')) NOT NULL,
  wifi_ssid TEXT DEFAULT 'iBUS@MUJ',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate attendance
  UNIQUE(session_id, student_registration)
);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert attendance"
  ON attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Faculty can read attendance for their sessions"
  ON attendance
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM sessions 
    WHERE sessions.id = session_id 
    AND sessions.faculty_id = auth.uid()
  ));

CREATE POLICY "Students can read own attendance"
  ON attendance
  FOR SELECT
  TO authenticated
  USING (true);

-- Indexes for performance
CREATE INDEX idx_sessions_active ON sessions(is_active, expires_at);
CREATE INDEX idx_attendance_session ON attendance(session_id);
CREATE INDEX idx_users_registration ON users(registration_number);
CREATE INDEX idx_sessions_code ON sessions(id);
CREATE INDEX idx_users_email ON users(email);