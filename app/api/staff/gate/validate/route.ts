import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from '@/lib/auth';
import { parseGateScanInput, verifyQrToken } from '@/lib/qr';
import { checkAndReleaseExpiredBookings } from '@/lib/booking';

/**
 * POST /api/staff/gate/validate
 * Validates a scanned QR token or manual booking code against gate rules.
 * Strictly scoped to staff's authenticated parkingAreaId.
 * Does NOT advance the booking lifecycle - preview/validation step before confirmation.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session || (session.role !== 'STAFF' && session.role !== 'ADMIN')) {
    return NextResponse.json({ success: false, message: 'Unauthorized. Staff session required.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { input, gateType = 'ENTRY', scanMethod = 'QR_CAMERA' } = body || {};

  if (!input || typeof input !== 'string') {
    return NextResponse.json({ success: false, message: 'Scan input is required' }, { status: 400 });
  }

  if (gateType !== 'ENTRY' && gateType !== 'EXIT') {
    return NextResponse.json({ success: false, message: 'Invalid gateType. Must be ENTRY or EXIT' }, { status: 400 });
  }

  // 1. Run expiration sweep
  await checkAndReleaseExpiredBookings(session.parkingAreaId);

  // 2. Parse input
  const parsed = parseGateScanInput(input);

  // 3. Find the candidate booking
  let booking: any = null;

  if (parsed.bookingCode) {
    booking = await db.booking.findFirst({
      where: { bookingCode: parsed.bookingCode },
      include: {
        parkingArea: { select: { id: true, name: true, code: true } },
        slot: { select: { id: true, slotNumber: true, vehicleType: true, status: true } },
        evChargingPoint: { select: { id: true, code: true, status: true } },
      },
    });
  } else if (parsed.token) {
    // If only token provided, look up by matching token against all active bookings
    const bookings = await db.booking.findMany({
      where: {
        parkingAreaId: session.parkingAreaId,
        status: { in: ['CONFIRMED', 'PENDING', 'CHECKED_IN'] },
      },
      include: {
        parkingArea: { select: { id: true, name: true, code: true } },
        slot: { select: { id: true, slotNumber: true, vehicleType: true, status: true } },
        evChargingPoint: { select: { id: true, code: true, status: true } },
      },
    });

    for (const b of bookings) {
      if (b.qrTokenHash && verifyQrToken(parsed.token, b.qrTokenHash)) {
        booking = b;
        break;
      }
    }
  }

  // Helper to record rejected audit scan
  const recordRejectedScan = async (reason: string, bookingId?: string) => {
    try {
      await db.gateScanLog.create({
        data: {
          bookingId: bookingId || booking?.id || null,
          parkingAreaId: session.parkingAreaId,
          gateType,
          staffId: session.userId,
          staffName: session.name,
          scanMethod,
          result: 'REJECTED',
          reason,
        },
      });
    } catch (err) {
      console.error('Failed to write GateScanLog:', err);
    }
  };

  // CHECK: Booking exists
  if (!booking) {
    await recordRejectedScan('Booking not found');
    return NextResponse.json(
      { success: false, reason: 'Booking not found', message: 'Booking not found. Please verify the code or QR pass.' },
      { status: 404 }
    );
  }

  // CHECK: Authorization - belongs to staff's facility
  if (booking.parkingAreaId !== session.parkingAreaId) {
    await recordRejectedScan('Wrong parking area', booking.id);
    return NextResponse.json(
      {
        success: false,
        reason: 'Wrong parking area',
        message: `Wrong parking area. This booking belongs to facility ${booking.parkingArea?.code || 'another venue'}.`,
      },
      { status: 403 }
    );
  }

  // CHECK: Cryptographic token validation if token was in scan
  if (parsed.token && booking.qrTokenHash) {
    const isValidToken = verifyQrToken(parsed.token, booking.qrTokenHash);
    if (!isValidToken) {
      await recordRejectedScan('Invalid QR code', booking.id);
      return NextResponse.json(
        { success: false, reason: 'Invalid QR code', message: 'Invalid QR code token. Gate pass could not be authenticated.' },
        { status: 400 }
      );
    }
  }

  const now = new Date();

  // ─── GATE TYPE SPECIFIC CHECKS ───
  if (gateType === 'ENTRY') {
    // Cannot entry if already checked in
    if (booking.status === 'CHECKED_IN') {
      await recordRejectedScan('Already checked in', booking.id);
      return NextResponse.json(
        { success: false, reason: 'Already checked in', message: 'Vehicle has already checked in through the entry gate.' },
        { status: 400 }
      );
    }

    // Cannot entry if already completed
    if (booking.status === 'COMPLETED') {
      await recordRejectedScan('Booking already completed', booking.id);
      return NextResponse.json(
        { success: false, reason: 'Booking already completed', message: 'This booking has already completed its visit and departed.' },
        { status: 400 }
      );
    }

    // Cannot entry if cancelled
    if (booking.status === 'CANCELLED') {
      await recordRejectedScan('Booking cancelled', booking.id);
      return NextResponse.json(
        { success: false, reason: 'Booking cancelled', message: 'This booking was cancelled by the customer or operator.' },
        { status: 400 }
      );
    }

    // Cannot entry if expired
    if (booking.status === 'EXPIRED') {
      await recordRejectedScan('Booking expired', booking.id);
      return NextResponse.json(
        { success: false, reason: 'Booking expired', message: 'Reservation expired due to 20-minute arrival grace window elapse.' },
        { status: 400 }
      );
    }

    // Check 20-minute arrival grace window
    if (booking.checkInDeadline && now.getTime() > new Date(booking.checkInDeadline).getTime()) {
      // Mark as EXPIRED now
      await db.$transaction(async (tx) => {
        await tx.booking.update({ where: { id: booking.id }, data: { status: 'EXPIRED' } });
        if (booking.slotId) {
          await tx.parkingSlot.update({ where: { id: booking.slotId }, data: { status: 'FREE' } }).catch(() => {});
        }
      });
      await recordRejectedScan('Booking expired', booking.id);
      return NextResponse.json(
        { success: false, reason: 'Booking expired', message: 'Booking expired (20-minute check-in deadline exceeded).' },
        { status: 400 }
      );
    }

    // Check status is eligible for check-in
    if (booking.status !== 'CONFIRMED' && booking.status !== 'PENDING') {
      await recordRejectedScan(`Status ineligible: ${booking.status}`, booking.id);
      return NextResponse.json(
        { success: false, reason: 'Booking status ineligible', message: `Booking status (${booking.status}) is not eligible for entry.` },
        { status: 400 }
      );
    }

    // Check slot still reserved for this booking
    if (!booking.slotId) {
      await recordRejectedScan('No slot allocated', booking.id);
      return NextResponse.json(
        { success: false, reason: 'Slot allocation conflict', message: 'No slot allocated to this booking.' },
        { status: 400 }
      );
    }

    if (booking.slot?.status === 'OCCUPIED') {
      await recordRejectedScan('Slot allocation conflict', booking.id);
      return NextResponse.json(
        { success: false, reason: 'Slot allocation conflict', message: `Slot ${booking.slot.slotNumber} is currently occupied by another vehicle.` },
        { status: 409 }
      );
    }

    // Payment condition: if required online prepay and still pending
    if (booking.paymentMethod === 'PREPAY_ONLINE' && booking.paymentStatus !== 'PAID') {
      // Allow staff to view that payment is required
      return NextResponse.json({
        success: true,
        approved: true,
        gateType: 'ENTRY',
        warning: 'Payment required at gate before entry.',
        data: {
          bookingId: booking.id,
          bookingCode: booking.bookingCode,
          vehiclePlate: booking.vehiclePlate,
          vehicleType: booking.vehicleType,
          slotNumber: booking.slot?.slotNumber || 'UNALLOCATED',
          evChargingPoint: booking.evChargingRequested ? (booking.evChargingPoint?.code || 'Assigned') : null,
          estimatedArrival: booking.estimatedArrival,
          paymentStatus: booking.paymentStatus,
          paymentMethod: booking.paymentMethod,
          totalAmount: booking.totalAmount,
          message: 'ENTRY APPROVED (PAYMENT PENDING)',
        },
      });
    }

    // Valid Entry!
    return NextResponse.json({
      success: true,
      approved: true,
      gateType: 'ENTRY',
      data: {
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        vehiclePlate: booking.vehiclePlate,
        vehicleType: booking.vehicleType,
        slotNumber: booking.slot?.slotNumber || 'UNALLOCATED',
        evChargingPoint: booking.evChargingRequested ? (booking.evChargingPoint?.code || 'Assigned') : null,
        estimatedArrival: booking.estimatedArrival,
        paymentStatus: booking.paymentStatus,
        paymentMethod: booking.paymentMethod,
        totalAmount: booking.totalAmount,
        message: 'ENTRY APPROVED',
      },
    });
  }

  // ─── EXIT GATE CHECKS ───
  if (gateType === 'EXIT') {
    // If not checked in, cannot exit
    if (booking.status === 'CONFIRMED' || booking.status === 'PENDING') {
      await recordRejectedScan('Wrong gate: vehicle has not entered', booking.id);
      return NextResponse.json(
        {
          success: false,
          reason: 'Vehicle has not entered',
          message: 'Vehicle has not checked in through the entry gate yet. Please use Entry Gate scanner.',
        },
        { status: 400 }
      );
    }

    if (booking.status === 'COMPLETED') {
      await recordRejectedScan('Booking already completed', booking.id);
      return NextResponse.json(
        { success: false, reason: 'Booking already completed', message: 'Booking has already been completed. Repeated exit scans are prohibited.' },
        { status: 400 }
      );
    }

    if (booking.status !== 'CHECKED_IN') {
      await recordRejectedScan(`Invalid status for exit: ${booking.status}`, booking.id);
      return NextResponse.json(
        { success: false, reason: 'Invalid status for exit', message: `Booking status is ${booking.status}, not CHECKED_IN.` },
        { status: 400 }
      );
    }

    // Calculate duration
    const entryTime = booking.entryAt ? new Date(booking.entryAt) : new Date(booking.createdAt);
    const durationMinutes = Math.max(1, Math.round((now.getTime() - entryTime.getTime()) / 60000));
    const durationHours = (durationMinutes / 60).toFixed(1);

    return NextResponse.json({
      success: true,
      approved: true,
      gateType: 'EXIT',
      data: {
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        vehiclePlate: booking.vehiclePlate,
        vehicleType: booking.vehicleType,
        slotNumber: booking.slot?.slotNumber || 'UNALLOCATED',
        entryAt: entryTime.toISOString(),
        exitAt: now.toISOString(),
        parkingDuration: `${durationHours} hours (${durationMinutes} mins)`,
        durationMinutes,
        finalParkingFee: booking.parkingFee,
        evChargingFee: booking.evChargingFee,
        totalAmount: booking.totalAmount,
        paymentStatus: booking.paymentStatus,
        paymentMethod: booking.paymentMethod,
        message: 'EXIT APPROVED',
      },
    });
  }

  return NextResponse.json({ success: false, message: 'Invalid gate operation' }, { status: 400 });
}
