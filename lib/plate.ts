/**
 * lib/plate.ts
 * Indian vehicle plate utilities:
 *  - normalise()       strip spaces/dashes, uppercase
 *  - validate()        true if matches any Indian plate format
 *  - hashPlate()       HMAC-SHA256 with env secret
 *  - isDuplicateEntry  60-second dedup guard
 */
import crypto from 'crypto';
import { db } from '@/lib/db';

const PLATE_SECRET =
  process.env.PLATE_HMAC_SECRET || 'parksmart-hmac-secret-change-in-prod';

// Covers BH-series, old format, new format, private, govt, etc.
const INDIAN_PLATE_PATTERNS: RegExp[] = [
  /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{1,4}$/,          // Standard: KA01AB1234
  /^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$/,             // Older: MH12PQR5678
  /^\d{2}BH\d{4}[A-Z]{1,2}$/,                    // BH series: 22BH1234AA
  /^[A-Z]{2}\d{2}[A-Z]\d{4}$/,                   // Compact: DL03C9999
  /^[A-Z]{2}\d{2}[A-Z]{4}$/,                     // 4-letter zone: TN22ABCD
];

// Valid Indian state codes (2-letter prefix)
const VALID_STATE_CODES = new Set([
  'AN','AP','AR','AS','BR','CG','CH','DD','DL','DN','GA','GJ','HR',
  'HP','JH','JK','KA','KL','LA','LD','MH','ML','MN','MP','MZ','NL',
  'OD','PB','PY','RJ','SK','TN','TR','TS','UK','UP','WB',
  // BH series handled separately
]);

export function normalisePlate(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s\-_]/g, '');
}

export function validatePlate(raw: string): { valid: boolean; reason?: string } {
  const plate = normalisePlate(raw);
  if (plate.length < 6 || plate.length > 12) {
    return { valid: false, reason: 'Invalid length' };
  }
  const stateCode = plate.slice(0, 2);
  const isBH = /^\d{2}BH/.test(plate);
  if (!isBH && !VALID_STATE_CODES.has(stateCode)) {
    return { valid: false, reason: `Unknown state code: ${stateCode}` };
  }
  const matches = INDIAN_PLATE_PATTERNS.some((r) => r.test(plate));
  if (!matches) {
    return { valid: false, reason: 'Plate format not recognised' };
  }
  return { valid: true };
}

export function hashPlate(raw: string): string {
  const plate = normalisePlate(raw);
  return crypto.createHmac('sha256', PLATE_SECRET).update(plate).digest('hex');
}

/**
 * Returns true if an OPEN/PARKED session for the same plate exists
 * within the last 60 seconds (dedup guard).
 */
export async function isDuplicateEntry(
  parkingAreaId: string,
  plateRaw: string
): Promise<boolean> {
  const token = hashPlate(plateRaw);
  const since = new Date(Date.now() - 60_000);
  const count = await db.visitSession.count({
    where: {
      parkingAreaId,
      plateToken: token,
      status: { in: ['OPEN', 'PARKED'] },
      entryAt: { gte: since },
    },
  });
  return count > 0;
}
