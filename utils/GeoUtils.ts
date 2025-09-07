export class GeoUtils {
  static getDistanceFromLatLonInMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
  }

  static deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  static determineStatus(
    distance: number,
    originWifi: string | null,
    markedWifi: string | null,
    threshold: number = 30
  ): 'present' | 'pending' | 'absent' {
    // Within threshold meters and on campus WiFi - definitely present
    if (distance <= threshold) {
      return 'present';
    }

    // Extended range for campus WiFi (up to 50m) - still present if both on iBUS@MUJ
    if (
      originWifi === 'iBUS@MUJ' &&
      markedWifi === 'iBUS@MUJ' &&
      distance <= 50 // Extended range for campus WiFi
    ) {
      return 'present';
    }

    // More than 50 meters away - absent
    if (distance > 50) {
      return 'absent';
    }

    // Edge cases - mark as pending for manual review
    return 'pending';
  }

  static formatDistance(distance: number): string {
    if (distance < 1000) {
      return `${Math.round(distance)}m`;
    }
    return `${(distance / 1000).toFixed(1)}km`;
  }
}