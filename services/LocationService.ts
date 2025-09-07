import * as Location from 'expo-location';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

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

// For production use, consider adding these environment variables
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'your_google_api_key_here';
const INDOOR_POSITIONING_API_URL = process.env.INDOOR_POSITIONING_URL || 'https://your-indoor-positioning-api.com';

export class LocationService {
  static async getHighAccuracyLocation(): Promise<LocationData> {
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
        throw new Error('Unable to detect WiFi network. Please ensure WiFi is enabled and you are connected to iBUS@MUJ.');
      }

      // 4. Verify campus WiFi connection
      if (!wifiSSID || wifiSSID !== 'iBUS@MUJ') {
        throw new Error(`You must be connected to iBUS@MUJ WiFi network. Currently connected to: ${wifiSSID || 'No WiFi'}`);
      }

      // 5. Try multiple location methods and use the most accurate one
      const locationMethods = [
        this.getGoogleFusedLocation(),
        this.getHighAccuracyGPSLocation(),
        this.getNetworkBasedLocation(),
        this.getIndoorPositioningLocation(wifiSSID)
      ];

      // Race to get the best location with timeout
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Location timeout')), 20000)
      );

      const results = await Promise.allSettled([...locationMethods, timeoutPromise]);
      
      // Filter successful results and find the most accurate
      const successfulResults = results
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<LocationData>).value);
      
      if (successfulResults.length === 0) {
        throw new Error('All location methods failed. Please ensure you have a stable connection and try again.');
      }
      
      // Sort by accuracy (lowest number is best)
      successfulResults.sort((a, b) => a.coords.accuracy - b.coords.accuracy);
      
      return successfulResults[0];
    } catch (error) {
      console.error('Location service error:', error);
      throw error;
    }
  }

  // High accuracy GPS method
  private static async getHighAccuracyGPSLocation(): Promise<LocationData> {
    try {
      let wifiSSID: string | null = null;
      try {
        const netInfo = await NetInfo.fetch();
        if (netInfo.type === 'wifi' && netInfo.details && 'ssid' in netInfo.details) {
          wifiSSID = netInfo.details.ssid;
        }
      } catch (error) {
        console.warn('WiFi SSID detection failed in GPS method:', error);
      }

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
      console.error('High accuracy GPS failed:', error);
      throw error;
    }
  }

  // Google's Fused Location Provider (Android only)
  private static async getGoogleFusedLocation(): Promise<LocationData> {
    if (Platform.OS !== 'android') {
      throw new Error('Google Fused Location only available on Android');
    }

    try {
      let wifiSSID: string | null = null;
      try {
        const netInfo = await NetInfo.fetch();
        if (netInfo.type === 'wifi' && netInfo.details && 'ssid' in netInfo.details) {
          wifiSSID = netInfo.details.ssid;
        }
      } catch (error) {
        console.warn('WiFi SSID detection failed in Google method:', error);
      }

      // Use Expo's built-in method which on Android uses Fused Location Provider
      const locationOptions: Location.LocationOptions = {
        accuracy: Location.Accuracy.High,
        timeout: 10000,
      };

      const position = await Location.getCurrentPositionAsync(locationOptions);
      
      return {
        coords: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy || 0,
          altitude: position.coords.altitude || undefined,
          altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
          heading: position.coords.heading || undefined,
          speed: position.coords.speed || undefined,
        },
        wifiSSID,
        timestamp: position.timestamp,
        provider: 'Google Fused Location',
        source: 'GoogleFused'
      };
    } catch (error) {
      console.error('Google Fused Location failed:', error);
      throw error;
    }
  }

  // Network-based location (WiFi/cell tower positioning)
  private static async getNetworkBasedLocation(): Promise<LocationData> {
    try {
      let wifiSSID: string | null = null;
      try {
        const netInfo = await NetInfo.fetch();
        if (netInfo.type === 'wifi' && netInfo.details && 'ssid' in netInfo.details) {
          wifiSSID = netInfo.details.ssid;
        }
      } catch (error) {
        console.warn('WiFi SSID detection failed in Network method:', error);
      }

      // Use lower accuracy setting which often uses network-based location
      const locationOptions: Location.LocationOptions = {
        accuracy: Location.Accuracy.Balanced,
        timeout: 10000,
      };

      const position = await Location.getCurrentPositionAsync(locationOptions);
      
      return {
        coords: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy || 0,
          altitude: position.coords.altitude || undefined,
          altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
          heading: position.coords.heading || undefined,
          speed: position.coords.speed || undefined,
        },
        wifiSSID,
        timestamp: position.timestamp,
        provider: 'Network Based',
        source: 'Network'
      };
    } catch (error) {
      console.error('Network-based location failed:', error);
      throw error;
    }
  }

  // Indoor positioning using WiFi fingerprinting (requires backend API)
  private static async getIndoorPositioningLocation(wifiSSID: string): Promise<LocationData> {
    try {
      // This would call your indoor positioning API
      // For now, we'll simulate this with the existing GPS but mark it as indoor
      const gpsLocation = await this.getHighAccuracyGPSLocation();
      
      return {
        ...gpsLocation,
        source: 'IndoorPositioning'
      };
      
      /* 
      // Actual implementation would look something like this:
      const response = await fetch(`${INDOOR_POSITIONING_API_URL}/locate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wifiSSID,
          timestamp: Date.now(),
        }),
      });
      
      if (!response.ok) {
        throw new Error('Indoor positioning service unavailable');
      }
      
      const data = await response.json();
      
      return {
        coords: {
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy: data.accuracy || 10, // Indoor positioning typically has 5-15m accuracy
        },
        wifiSSID,
        timestamp: Date.now(),
        provider: 'Indoor Positioning System',
        source: 'Indoor'
      };
      */
    } catch (error) {
      console.error('Indoor positioning failed:', error);
      throw error;
    }
  }

  // Google Maps Geolocation API (requires API key)
  private static async getGoogleGeolocationAPI(): Promise<LocationData> {
    try {
      // Get WiFi access points information
      // Note: This requires additional permissions and might not work in Expo
      /* 
      const wifiData = await getWifiAccessPoints(); // You'd need to implement this
      
      const response = await fetch(`https://www.googleapis.com/geolocation/v1/geolocate?key=${GOOGLE_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          considerIp: false,
          wifiAccessPoints: wifiData
        }),
      });
      
      if (!response.ok) {
        throw new Error('Google Geolocation API failed');
      }
      
      const data = await response.json();
      
      return {
        coords: {
          latitude: data.location.lat,
          longitude: data.location.lng,
          accuracy: data.accuracy,
        },
        wifiSSID: null, // You might extract this from wifiData
        timestamp: Date.now(),
        provider: 'Google Geolocation API',
        source: 'GoogleAPI'
      };
      */
      
      // For now, we'll fall back to regular GPS
      return await this.getHighAccuracyGPSLocation();
    } catch (error) {
      console.error('Google Geolocation API failed:', error);
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

  // New method to validate location accuracy for attendance
  static validateLocationForAttendance(location: LocationData, requiredAccuracy: number = 30): boolean {
    return location.coords.accuracy <= requiredAccuracy;
  }

  // New method to get location with specific accuracy requirements
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