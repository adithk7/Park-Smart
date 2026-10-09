import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'parksmart-jwt-secret-secure-key-2026'
);

export const COOKIE_NAME = 'parksmart_session';

export interface SessionPayload {
  userId: string; // User ID or Staff ID
  role: 'ADMIN' | 'STAFF';
  parkingAreaId: string;
  name: string;
  email?: string;
  staffCode?: string;
  parkingCode?: string;
}

/**
 * Signs a JWT session token valid for 7 days
 */
export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

/**
 * Verifies a JWT session token
 */
export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Retrieves the current session from incoming cookies (Server Component / Route Handler)
 */
export async function getServerSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifyToken(token);
  } catch {
    return null;
  }
}

/**
 * Rate Limiting & Lockout Engine
 * Rule: 5 consecutive failed login attempts -> 10-minute lockout
 */
export async function checkRateLimit(identifier: string): Promise<{ isLocked: boolean; remainingMinutes?: number }> {
  try {
    const attempt = await db.loginAttempt.findUnique({
      where: { identifier: identifier.toLowerCase().trim() },
    });

    if (!attempt) return { isLocked: false };

    if (attempt.lockedUntil && attempt.lockedUntil > new Date()) {
      const remainingMs = attempt.lockedUntil.getTime() - Date.now();
      const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
      return { isLocked: true, remainingMinutes };
    }

    return { isLocked: false };
  } catch {
    return { isLocked: false };
  }
}

export async function recordFailedAttempt(identifier: string): Promise<{ locked: boolean }> {
  try {
    const cleanId = identifier.toLowerCase().trim();
    const existing = await db.loginAttempt.findUnique({ where: { identifier: cleanId } });
    const failures = (existing?.failures || 0) + 1;

    let lockedUntil: Date | null = null;
    if (failures >= 5) {
      // 10 minute lockout
      lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
    }

    await db.loginAttempt.upsert({
      where: { identifier: cleanId },
      update: {
        failures,
        lockedUntil,
      },
      create: {
        identifier: cleanId,
        failures,
        lockedUntil,
      },
    });

    return { locked: failures >= 5 };
  } catch {
    return { locked: false };
  }
}

export async function resetFailedAttempts(identifier: string): Promise<void> {
  try {
    const cleanId = identifier.toLowerCase().trim();
    await db.loginAttempt.deleteMany({
      where: { identifier: cleanId },
    });
  } catch {
    // Ignore error
  }
}

/**
 * Creates an immutable AuditLog record
 */
export async function logAuditEvent({
  parkingAreaId,
  actorId,
  actorRole,
  action,
  meta,
}: {
  parkingAreaId: string;
  actorId?: string;
  actorRole: 'ADMIN' | 'STAFF' | 'SYSTEM';
  action: string;
  meta?: Record<string, any>;
}) {
  try {
    await db.auditLog.create({
      data: {
        parkingAreaId,
        actorId,
        actorRole,
        action,
        meta: meta ? JSON.stringify(meta) : null,
      },
    });
  } catch (err) {
    console.error('AuditLog write error:', err);
  }
}
