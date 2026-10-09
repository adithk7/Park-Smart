import crypto from 'crypto';

/**
 * Domain Security Rule:
 * Plates are never stored raw in analytics tables; store a token = HMAC-SHA256(plate, SECRET).
 * Raw plate is kept ONLY on the VisitSession record for exit display and dispute resolution.
 */
export function hashPlate(rawPlate: string, customSecret?: string): string {
  const secret = customSecret || process.env.PLATE_HMAC_SECRET || 'parksmart-hmac-secret-default';
  const normalizedPlate = rawPlate.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return crypto.createHmac('sha256', secret).update(normalizedPlate).digest('hex');
}

/**
 * Formats/normalizes vehicle license plate text (e.g. "ka-01-ab-1234" -> "KA01AB1234")
 */
export function normalizePlate(rawPlate: string): string {
  return rawPlate.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Masks phone numbers for privacy / masked Exotel proxy call displays (e.g. "+91 98*** **321")
 */
export function maskPhoneNumber(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.length < 10) return '***-***-****';
  const first3 = clean.slice(0, 3);
  const last3 = clean.slice(-3);
  return `+${first3}****${last3}`;
}
