import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { 
  signToken, 
  COOKIE_NAME, 
  checkRateLimit, 
  recordFailedAttempt, 
  resetFailedAttempts, 
  logAuditEvent 
} from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type } = body; // 'admin' | 'staff'

    // ==========================================
    // 1. ADMIN LOGIN FLOW (Email + Password)
    // ==========================================
    if (type === 'admin') {
      const { email, password } = body;
      if (!email || !password) {
        return NextResponse.json(
          { success: false, message: 'Email and password are required' },
          { status: 400 }
        );
      }

      const identifier = `admin:${email.toLowerCase().trim()}`;
      
      // Check Rate Limit lockout
      const rateLimit = await checkRateLimit(identifier);
      if (rateLimit.isLocked) {
        return NextResponse.json(
          {
            success: false,
            message: `Account temporarily locked due to 5 failed attempts. Please try again in ${rateLimit.remainingMinutes} minutes.`,
            isLocked: true,
          },
          { status: 429 }
        );
      }

      // Find user
      const user = await db.user.findUnique({
        where: { email: email.toLowerCase().trim() },
        include: { parkingArea: true },
      });

      if (!user || user.role !== 'ADMIN') {
        const { locked } = await recordFailedAttempt(identifier);
        return NextResponse.json(
          {
            success: false,
            message: locked 
              ? 'Too many failed attempts. Account locked for 10 minutes.' 
              : 'Invalid administrator email or password.',
            isLocked: locked,
          },
          { status: 401 }
        );
      }

      // Verify bcrypt password
      const passwordMatch = await bcrypt.compare(password, user.passwordHash);
      if (!passwordMatch) {
        const { locked } = await recordFailedAttempt(identifier);
        await logAuditEvent({
          parkingAreaId: user.parkingAreaId,
          actorId: user.id,
          actorRole: 'ADMIN',
          action: 'LOGIN_FAILED',
          meta: { email: user.email, ip: req.headers.get('x-forwarded-for') || 'local' },
        });

        return NextResponse.json(
          {
            success: false,
            message: locked 
              ? 'Too many failed attempts. Account locked for 10 minutes.' 
              : 'Invalid administrator email or password.',
            isLocked: locked,
          },
          { status: 401 }
        );
      }

      // Reset failed attempts on success
      await resetFailedAttempts(identifier);

      // Log successful login
      await logAuditEvent({
        parkingAreaId: user.parkingAreaId,
        actorId: user.id,
        actorRole: 'ADMIN',
        action: 'LOGIN_SUCCESS',
        meta: { email: user.email },
      });

      // Issue signed JWT cookie
      const token = await signToken({
        userId: user.id,
        role: 'ADMIN',
        parkingAreaId: user.parkingAreaId,
        name: user.name,
        email: user.email,
        parkingCode: user.parkingArea.code,
      });

      const response = NextResponse.json({
        success: true,
        redirect: '/admin',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        parkingArea: {
          id: user.parkingArea.id,
          name: user.parkingArea.name,
          code: user.parkingArea.code,
          tier: user.parkingArea.tier,
        },
      });

      response.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });

      return response;
    }

    // ==========================================
    // 2. STAFF LOGIN FLOW — Parking Area Code + Shared Password only
    //    No individual staff account or staff ID required.
    // ==========================================
    if (type === 'staff') {
      const { parkingCode, staffPassword } = body;
      if (!parkingCode || !staffPassword) {
        return NextResponse.json(
          { success: false, message: 'Parking Area Code and Staff Password are required' },
          { status: 400 }
        );
      }

      const cleanParkingCode = parkingCode.trim().toUpperCase();
      const identifier = `staff:${cleanParkingCode}`;

      // Check Rate Limit lockout
      const rateLimit = await checkRateLimit(identifier);
      if (rateLimit.isLocked) {
        return NextResponse.json(
          {
            success: false,
            message: `Staff login locked due to repeated failures. Please try again in ${rateLimit.remainingMinutes} minutes.`,
            isLocked: true,
          },
          { status: 429 }
        );
      }

      // Find parking area by code
      const parkingArea = await db.parkingArea.findUnique({
        where: { code: cleanParkingCode },
      });

      if (!parkingArea || !parkingArea.staffPasswordHash) {
        const { locked } = await recordFailedAttempt(identifier);
        return NextResponse.json(
          {
            success: false,
            message: locked
              ? 'Too many failed attempts. Terminal locked for 10 minutes.'
              : 'Invalid parking area code or password.',
            isLocked: locked,
          },
          { status: 401 }
        );
      }

      // Verify shared staff password
      const passwordMatch = await bcrypt.compare(staffPassword, parkingArea.staffPasswordHash);
      if (!passwordMatch) {
        const { locked } = await recordFailedAttempt(identifier);
        await logAuditEvent({
          parkingAreaId: parkingArea.id,
          actorRole: 'STAFF',
          action: 'LOGIN_FAILED',
          meta: { reason: 'Wrong staff password', code: cleanParkingCode },
        });

        return NextResponse.json(
          {
            success: false,
            message: locked
              ? 'Too many failed attempts. Terminal locked for 10 minutes.'
              : 'Invalid parking area code or password.',
            isLocked: locked,
          },
          { status: 401 }
        );
      }

      // Reset failed attempts
      await resetFailedAttempts(identifier);

      // Log successful staff login
      await logAuditEvent({
        parkingAreaId: parkingArea.id,
        actorRole: 'STAFF',
        action: 'LOGIN_SUCCESS',
        meta: { code: cleanParkingCode, facility: parkingArea.name },
      });

      // Issue signed JWT cookie — userId is parkingArea.id for staff (no individual user record)
      const token = await signToken({
        userId: parkingArea.id,
        role: 'STAFF',
        parkingAreaId: parkingArea.id,
        name: `Staff — ${parkingArea.name}`,
        parkingCode: parkingArea.code,
      });

      const response = NextResponse.json({
        success: true,
        redirect: '/staff',
        parkingArea: {
          id: parkingArea.id,
          name: parkingArea.name,
          code: parkingArea.code,
          tier: parkingArea.tier,
        },
      });

      response.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });

      return response;
    }

    return NextResponse.json(
      { success: false, message: 'Invalid authentication type' },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error during authentication' },
      { status: 500 }
    );
  }
}
