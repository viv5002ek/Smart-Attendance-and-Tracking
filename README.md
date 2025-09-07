# Smart Attendance App

A cross-platform mobile application built with Expo for managing classroom attendance using high-accuracy location detection.

## Features

### Core Functionality
- **Take Attendance (Professor)**: Upload Excel student list, generate session code, track real-time attendance
- **Mark Attendance (Student)**: Enter session code, submit attendance with location verification
- **Location-Based Verification**: 30-meter proximity detection with campus WiFi integration
- **Real-Time Status**: Present/Pending/Absent categorization with live updates

### Advanced Location Detection
- Primary: `expo-location` with highest accuracy settings
- Enhanced: `react-native-geolocation-service` (requires development build)
- Indoor verification: WiFi SSID detection (iBUS@MUJ campus network)
- Distance calculation using Haversine formula

## Tech Stack

- **Framework**: Expo (React Native)
- **Navigation**: Expo Router with tab-based layout
- **Database**: Supabase with Row Level Security
- **Location**: expo-location + react-native-geolocation-service
- **File Processing**: xlsx for Excel parsing
- **UI**: React Native Paper with custom styling

## Setup Instructions

### 1. Supabase Configuration

1. Create a new Supabase project
2. Run the SQL commands from `database/schema.sql` in your Supabase SQL editor
3. Update `lib/supabase.ts` with your project URL and anon key

### 2. Development Build (Recommended)

For enhanced location accuracy, create a development build:

```bash
# Install EAS CLI
npm install -g @expo/eas-cli

# Configure EAS
eas init

# Create development build
eas build --profile development --platform android
# or
eas build --profile development --platform ios
```

### 3. Install Additional Dependencies (Dev Build)

```bash
npm install react-native-geolocation-service @react-native-wifi/wifi-reachability
```

### 4. Run the App

```bash
# Start development server
npm run dev

# For development build
npx expo start --dev-client
```

## Database Schema

### Tables
- `profiles`: User profiles with role management
- `attendance_sessions`: Session data with location and student lists
- `attendance_records`: Individual attendance submissions

### Key Features
- Row Level Security (RLS) policies
- Automatic session expiry (10 minutes)
- Duplicate prevention
- Location data with coordinates and WiFi SSID

## Usage

### For Professors
1. Upload Excel file with student names and registration numbers
2. Start attendance session (gets current location)
3. Share the generated 6-digit code with students
4. Monitor real-time attendance as students submit

### For Students
1. Enter the session code from professor
2. Fill in name and registration number
3. Submit attendance (location automatically verified)
4. Receive immediate status feedback

## Location Accuracy

The app uses multiple methods for maximum accuracy:

- **GPS**: Primary positioning system
- **Network Location**: WiFi and cellular triangulation
- **Campus WiFi**: iBUS@MUJ network detection for indoor accuracy
- **Fused Location Provider**: (Development build only) Google Play Services integration

## Privacy & Security

- Location data only collected during active sessions
- All data encrypted in transit and at rest (Supabase)
- Student locations never shared with other students
- Sessions automatically expire after 10 minutes
- Row Level Security prevents unauthorized data access

## Development Notes

- Managed workflow supports basic location features
- Development build required for enhanced accuracy
- Test on physical devices for accurate location testing
- Campus WiFi integration requires android.permission.ACCESS_WIFI_STATE

## File Structure

```
app/
├── (tabs)/
│   ├── index.tsx          # Take Attendance screen
│   ├── mark.tsx           # Mark Attendance screen
│   ├── profile.tsx        # Profile and settings
│   └── _layout.tsx        # Tab navigation
├── _layout.tsx            # Root layout
database/
├── schema.sql             # Supabase database schema
lib/
├── supabase.ts           # Supabase client configuration
services/
├── LocationService.ts     # Location detection service
utils/
├── GeoUtils.ts           # Geographic calculations
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on physical devices
5. Submit a pull request

## License

MIT License - see LICENSE file for details