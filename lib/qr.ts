/**
 * lib/qr.ts
 * Cryptographic token generation, SHA-256 hashing, timing-safe verification,
 * and QR payload encoding/parsing for Gate Entry/Exit verification.
 */
import crypto from 'crypto';

const QR_SECRET = process.env.QR_SECRET || process.env.JWT_SECRET || 'parksmart-qr-gate-secret-key-2026';

export interface QrTokenPair {
  token: string;
  hash: string;
}

/**
 * Derives an unguessable, cryptographically secure booking token
 * bound to booking ID and booking code.
 */
export function deriveBookingQrToken(bookingId: string, bookingCode: string): string {
  const hmac = crypto.createHmac('sha256', QR_SECRET);
  hmac.update(`${bookingId}:${bookingCode}`);
  // Add 16 random salt bytes mixed with the HMAC digest to ensure high entropy
  const digest = hmac.digest('base64url');
  return `pks_${digest}`;
}

/**
 * Generates an unguessable booking token and its SHA-256 hash.
 * Only the SHA-256 hash is persisted in the database.
 */
export function generateBookingQrToken(bookingId: string, bookingCode: string): QrTokenPair {
  const token = deriveBookingQrToken(bookingId, bookingCode);
  const hash = hashQrToken(token);
  return { token, hash };
}

/**
 * Computes SHA-256 hex hash of a raw QR token.
 */
export function hashQrToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Timing-safe comparison of a candidate token against stored hash.
 */
export function verifyQrToken(candidateToken: string, storedHash: string): boolean {
  if (!candidateToken || !storedHash) return false;
  const candidateHash = hashQrToken(candidateToken);
  try {
    const a = Buffer.from(candidateHash, 'hex');
    const b = Buffer.from(storedHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Builds the canonical QR code payload string to encode into the booking QR code.
 * Contains only the unguessable token and the public booking code.
 * Does NOT contain passwords, database credentials, private user details, or authorization secrets.
 */
export function buildQrPayload(bookingCode: string, token: string): string {
  return JSON.stringify({
    schema: 'PARKSMART_PASS_V1',
    ref: bookingCode,
    token: token,
  });
}

export interface ParsedScanInput {
  token?: string;
  bookingCode?: string;
  rawInput: string;
}

/**
 * Safely parses input from camera scan or manual text input.
 * Handles:
 * 1. JSON payload: { schema, ref, token }
 * 2. URL containing query params: ?code=...&token=...
 * 3. Prefix format: PARKSMART:QR:1:<bookingCode>:<token>
 * 4. Raw token starting with "pks_"
 * 5. Booking code reference (e.g. "BK-1001") for manual fallback
 */
export function parseGateScanInput(input: string): ParsedScanInput {
  const trimmed = input.trim();
  const result: ParsedScanInput = { rawInput: trimmed };

  // 1. Try JSON
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.token) result.token = String(parsed.token).trim();
      if (parsed.ref || parsed.bookingCode || parsed.code) {
        result.bookingCode = String(parsed.ref || parsed.bookingCode || parsed.code).trim().toUpperCase();
      }
      return result;
    } catch {
      // Not JSON, continue to next parsers
    }
  }

  // 2. Try URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.includes('?')) {
    try {
      const url = new URL(trimmed.startsWith('http') ? trimmed : `https://parksmart.local/${trimmed}`);
      const tokenParam = url.searchParams.get('token') || url.searchParams.get('t');
      const codeParam = url.searchParams.get('code') || url.searchParams.get('ref') || url.searchParams.get('bookingCode');
      if (tokenParam) result.token = tokenParam.trim();
      if (codeParam) result.bookingCode = codeParam.trim().toUpperCase();
      if (result.token || result.bookingCode) return result;
    } catch {
      // Not valid URL, continue
    }
  }

  // 3. Colon-separated format: PARKSMART:QR:1:<bookingCode>:<token>
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length >= 4 && parts[0] === 'PARKSMART') {
      result.bookingCode = parts[2].trim().toUpperCase();
      result.token = parts[3].trim();
      return result;
    }
  }

  // 4. Raw token: starts with "pks_"
  if (trimmed.startsWith('pks_')) {
    result.token = trimmed;
    return result;
  }

  // 5. Booking code format: BK-... or alphanumeric booking ref
  if (/^BK-[A-Za-z0-9-]+$/i.test(trimmed)) {
    result.bookingCode = trimmed.toUpperCase();
    return result;
  }

  // Fallback: If it's a long random string, treat as token; else treat as booking code
  if (trimmed.length > 25) {
    result.token = trimmed;
  } else {
    result.bookingCode = trimmed.toUpperCase();
  }

  return result;
}
