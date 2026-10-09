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
    // 2. STAFF LOGIN FLOW (Area Code + Staff ID + Shared Password)
    // ==========================================
    if (type === 'staff') {
      const { parkingCode, staffCode, staffPassword } = body;
      if (!parkingCode || !staffCode || !staffPassword) {
        return NextResponse.json(
          { success: false, message: 'Parking Code, Staff ID, and Staff Password are required' },
          { status: 400 }
        );
      }

      const cleanParkingCode = parkingCode.trim().toUpperCase();
      const cleanStaffCode = staffCode.trim().toUpperCase();
      const identifier = `staff:${cleanParkingCode}:${cleanStaffCode}`;

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

      // Find parking area
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
              : 'Invalid Parking Area Code or Password.',
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
          meta: { reason: 'Wrong staff password', staffCode: cleanStaffCode },
        });

        return NextResponse.json(
          {
            success: false,
            message: locked 
              ? 'Too many failed attempts. Terminal locked for 10 minutes.' 
              : 'Invalid staff password for this facility.',
            isLocked: locked,
          },
          { status: 401 }
        );
      }

      // Find staff record
      const staff = await db.staff.findUnique({
        where: {
          parkingAreaId_staffCode: {
            parkingAreaId: parkingArea.id,
            staffCode: cleanStaffCode,
          },
        },
      });

      if (!staff) {
        const { locked } = await recordFailedAttempt(identifier);
        return NextResponse.json(
          {
            success: false,
            message: `Staff ID [${cleanStaffCode}] was not found in facility [${cleanParkingCode}]. Please check with your administrator.`,
            isLocked: locked,
          },
          { status: 404 }
        );
      }

      if (!staff.active) {
        return NextResponse.json(
          {
            success: false,
            message: `Staff profile [${cleanStaffCode}] is currently disabled. Contact your facility administrator.`,
          },
          { status: 403 }
        );
      }

      // Reset failed attempts
      await resetFailedAttempts(identifier);

      // Log successful staff login
      await logAuditEvent({
        parkingAreaId: parkingArea.id,
        actorId: staff.id,
        actorRole: 'STAFF',
        action: 'LOGIN_SUCCESS',
        meta: { staffCode: staff.staffCode, name: staff.name, zone: staff.assignedZone },
      });

      // Issue signed JWT cookie
      const token = await signToken({
        userId: staff.id,
        role: 'STAFF',
        parkingAreaId: parkingArea.id,
        name: staff.name,
        staffCode: staff.staffCode,
        parkingCode: parkingArea.code,
      });

      const response = NextResponse.json({
        success: true,
        redirect: '/staff',
        staff: {
          id: staff.id,
          staffCode: staff.staffCode,
          name: staff.name,
          assignedZone: staff.assignedZone,
        },
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
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error during authentication' },
      { status: 500 }
    );
  }
}
