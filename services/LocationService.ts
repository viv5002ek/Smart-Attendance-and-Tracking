import * as Location from 'expo-location';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';

interface LocationData {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude?: number;
    altitudeAccuracy?: number;
    heading?: number;
    speed?: number;
  };
  wifiSSID: string | null;
  timestamp: number;
  provider: string;
  source: string;
}

export class LocationService {
  static async checkWiFiConnection(): Promise<boolean> {
    try {
      const netInfo = await NetInfo.fetch();
      if (netInfo.type === 'wifi' && netInfo.details && 'ssid' in netInfo.details) {
        return netInfo.details.ssid === 'iBUS@MUJ';
      }
      return false;
    } catch (error) {
      console.error('WiFi check failed:', error);
      return false;
    }
  }

  static async promptWiFiConnection(): Promise<boolean> {
    const isConnected = await this.checkWiFiConnection();
    
    if (!isConnected) {
      return new Promise((resolve) => {
        Alert.alert(
          'WiFi Connection Required',
          'Please connect to "iBUS@MUJ" WiFi network for accurate attendance marking.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => resolve(false),
            },
            {
              text: 'Continue Anyway',
              onPress: () => resolve(true),
            },
            {
              text: 'Check Again',
              onPress: async () => {
                const recheckResult = await this.checkWiFiConnection();
                resolve(recheckResult);
              },
            },
          ]
        );
      });
    }
    
    return true;
  }

  static async getHighAccuracyLocation(): Promise<LocationData> {
    // First check WiFi connection
    const wifiOk = await this.promptWiFiConnection();
    if (!wifiOk) {
      throw new Error('WiFi connection required for attendance');
    }

    try {
      // 1. Request location permissions
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        status = (await Location.requestForegroundPermissionsAsync()).status;
        if (status !== 'granted') {
          throw new Error('Location permission denied. Please enable location access in settings.');
        }
      }

      // 2. Check if location services are enabled
      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        throw new Error('Location services are disabled. Please enable GPS in your device settings.');
      }

      // 3. Get WiFi SSID using NetInfo
      let wifiSSID: string | null = null;
      try {
        const netInfo = await NetInfo.fetch();
        if (netInfo.type === 'wifi' && netInfo.details && 'ssid' in netInfo.details) {
          wifiSSID = netInfo.details.ssid;
        }
      } catch (error) {
        console.warn('WiFi SSID detection failed:', error);
        // Don't throw error for WiFi, just continue without it
      }

      // 4. Get high accuracy location with multiple attempts
      const locationOptions: Location.LocationOptions = {
        accuracy: Location.Accuracy.BestForNavigation,
        timeout: 15000,
        distanceInterval: 0,
      };

      // Take multiple readings and use the best one
      const readings = [];
      const maxReadings = 3;
      
      for (let i = 0; i < maxReadings; i++) {
        try {
          const reading = await Location.getCurrentPositionAsync(locationOptions);
          readings.push(reading);
          
          // If we get a very accurate reading (< 5 meters), use it immediately
          if (reading.coords.accuracy && reading.coords.accuracy < 5) {
            break;
          }
          
          // Wait between readings for GPS to stabilize
          if (i < maxReadings - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.warn(`GPS reading ${i + 1} failed:`, error);
          if (i === 0) throw error;
        }
      }

      if (readings.length === 0) {
        throw new Error('No GPS readings obtained');
      }

      // Select the most accurate reading
      const bestReading = readings.reduce((best, current) => {
        return (current.coords.accuracy || 999) < (best.coords.accuracy || 999) ? current : best;
      });

      return {
        coords: {
          latitude: bestReading.coords.latitude,
          longitude: bestReading.coords.longitude,
          accuracy: bestReading.coords.accuracy || 0,
          altitude: bestReading.coords.altitude || undefined,
          altitudeAccuracy: bestReading.coords.altitudeAccuracy || undefined,
          heading: bestReading.coords.heading || undefined,
          speed: bestReading.coords.speed || undefined,
        },
        wifiSSID,
        timestamp: bestReading.timestamp,
        provider: Platform.OS === 'android' ? 'Android Fused Location' : 'iOS Core Location',
        source: 'GPS'
      };
    } catch (error) {
      console.error('Location service error:', error);
      throw error;
    }
  }

  static async checkLocationPermissions(): Promise<boolean> {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  }

  static async requestLocationPermissions(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  }

  static async getLocationProviderStatus(): Promise<{
    locationServicesEnabled: boolean;
    wifiConnected: boolean;
    wifiSSID: string | null;
  }> {
    const isEnabled = await Location.hasServicesEnabledAsync();
    
    let wifiConnected = false;
    let wifiSSID: string | null = null;
    
    try {
      const netInfo = await NetInfo.fetch();
      if (netInfo.type === 'wifi' && netInfo.details && 'ssid' in netInfo.details) {
        wifiSSID = netInfo.details.ssid;
        wifiConnected = netInfo.isConnected || false;
      }
    } catch (error) {
      console.warn('WiFi status check failed:', error);
    }
    
    return {
      locationServicesEnabled: isEnabled,
      wifiConnected,
      wifiSSID,
    };
  }

  static async verifyiBUSConnection(): Promise<boolean> {
    try {
      const netInfo = await NetInfo.fetch();
      if (netInfo.type === 'wifi' && netInfo.details && 'ssid' in netInfo.details) {
        return netInfo.details.ssid === 'iBUS@MUJ';
      }
      return false;
    } catch (error) {
      console.error('WiFi verification failed:', error);
      return false;
    }
  }

  // Validate location accuracy for attendance
  static validateLocationForAttendance(location: LocationData, requiredAccuracy: number = 30): boolean {
    return location.coords.accuracy <= requiredAccuracy;
  }

  // Get location with specific accuracy requirements
  static async getLocationForAttendance(requiredAccuracy: number = 30, maxAttempts: number = 3): Promise<LocationData> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const location = await this.getHighAccuracyLocation();
        
        if (this.validateLocationForAttendance(location, requiredAccuracy)) {
          return location;
        }
        
        if (attempt < maxAttempts) {
          console.log(`Attempt ${attempt}: Accuracy ${location.coords.accuracy}m is insufficient, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          throw new Error(`Could not achieve required accuracy of ${requiredAccuracy}m. Best accuracy: ${location.coords.accuracy}m`);
        }
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }
        console.warn(`Attempt ${attempt} failed:`, error);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    throw new Error('All location attempts failed');
  }
}