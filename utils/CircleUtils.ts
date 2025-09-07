export class CircleUtils {
  // Calculate distance between two points using Haversine formula
  static getDistanceInMeters(
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
    return R * c;
  }

  private static deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  // Calculate circle overlap percentage
  static calculateCircleOverlap(
    center1Lat: number,
    center1Lon: number,
    radius1: number,
    center2Lat: number,
    center2Lon: number,
    radius2: number
  ): number {
    const distance = this.getDistanceInMeters(center1Lat, center1Lon, center2Lat, center2Lon);
    
    // If circles don't overlap at all
    if (distance >= radius1 + radius2) {
      return 0;
    }
    
    // If one circle is completely inside the other
    if (distance <= Math.abs(radius1 - radius2)) {
      const smallerRadius = Math.min(radius1, radius2);
      const smallerArea = Math.PI * smallerRadius * smallerRadius;
      const circle2Area = Math.PI * radius2 * radius2;
      return (smallerArea / circle2Area) * 100;
    }
    
    // Partial overlap calculation
    const r1Sq = radius1 * radius1;
    const r2Sq = radius2 * radius2;
    const dSq = distance * distance;
    
    const area1 = r1Sq * Math.acos((dSq + r1Sq - r2Sq) / (2 * distance * radius1));
    const area2 = r2Sq * Math.acos((dSq + r2Sq - r1Sq) / (2 * distance * radius2));
    const area3 = 0.5 * Math.sqrt((-distance + radius1 + radius2) * (distance + radius1 - radius2) * (distance - radius1 + radius2) * (distance + radius1 + radius2));
    
    const overlapArea = area1 + area2 - area3;
    const circle2Area = Math.PI * radius2 * radius2;
    
    return Math.max(0, Math.min(100, (overlapArea / circle2Area) * 100));
  }

  // Determine attendance status based on coverage
  static determineAttendanceStatus(coveragePercentage: number): 'present' | 'proxy' {
    return coveragePercentage >= 50 ? 'present' : 'proxy';
  }

  // Check if student registration exists in faculty list (case insensitive)
  static isStudentInList(
    studentRegistration: string,
    facultyList: Array<{ name: string; registration_number: string }>
  ): boolean {
    const studentRegLower = studentRegistration.toLowerCase().trim();
    return facultyList.some(student => 
      student.registration_number.toLowerCase().trim() === studentRegLower
    );
  }

  // Get student name from faculty list
  static getStudentName(
    studentRegistration: string,
    facultyList: Array<{ name: string; registration_number: string }>
  ): string | null {
    const studentRegLower = studentRegistration.toLowerCase().trim();
    const student = facultyList.find(s => 
      s.registration_number.toLowerCase().trim() === studentRegLower
    );
    return student ? student.name : null;
  }
}