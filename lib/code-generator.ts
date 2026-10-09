/**
 * Generates a unique, human-readable Parking Area Code
 * Example: "MALL-PHOENIX-4821", "TECH-ORION-7913"
 */
export function generateParkingCode(name: string, city?: string): string {
  const cleanCity = (city || 'PARK')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3)
    .padEnd(3, 'X');

  const cleanName = (name || 'AREA')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6)
    .padEnd(4, 'P');

  const randomDigits = Math.floor(1000 + Math.random() * 9000); // 4-digit number (1000-9999)

  return `${cleanCity}-${cleanName}-${randomDigits}`;
}
