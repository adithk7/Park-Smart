import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAndReleaseExpiredBookings } from '@/lib/booking';

/**
 * POST /api/booking/pay-simulated
 * Simulated online payment execution for Prepay Online.
 * Enforces the 15-minute pre-booking window rule before allowing completion.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.bookingId && !body?.bookingCode) {
    return NextResponse.json(
      { success: false, message: 'bookingId or bookingCode is required' },
      { status: 400 }
    );
  }

  await checkAndReleaseExpiredBookings();

  const booking = await db.booking.findFirst({
    where: {
      OR: [
        { id: body.bookingId },
        { bookingCode: body.bookingCode },
      ],
    },
    include: { slot: true },
  });

  if (!booking) {
    return NextResponse.json({ success: false, message: 'Booking not found' }, { status: 404 });
  }

  if (booking.status === 'EXPIRED') {
    return NextResponse.json(
      { success: false, message: 'This booking has expired and cannot be paid.' },
      { status: 400 }
    );
  }

  if (booking.paymentStatus === 'PAID') {
    return NextResponse.json(
      { success: true, message: 'Booking is already paid', data: booking }
    );
  }

  // 15-minute pre-booking window check
  const now = new Date();
  const windowStartTime = new Date(booking.estimatedArrival.getTime() - 15 * 60 * 1000);
  if (now.getTime() < windowStartTime.getTime()) {
    const minutesRemaining = Math.ceil((windowStartTime.getTime() - now.getTime()) / 60000);
    return NextResponse.json(
      {
        success: false,
        message: `Pre-booking opens 15 minutes before your arrival (${minutesRemaining} mins remaining).`,
        minutesRemaining,
      },
      { status: 403 }
    );
  }

  // Confirm booking & set paymentStatus to PAID (Simulated Demo Test Mode)
  const updated = await db.booking.update({
    where: { id: booking.id },
    data: {
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
    },
  });

  // Ensure slot status is RESERVED
  if (booking.slotId) {
    await db.parkingSlot.update({
      where: { id: booking.slotId },
      data: { status: 'RESERVED' },
    });
  }

  return NextResponse.json({
    success: true,
    message: 'Payment completed successfully [SIMULATED TEST PAYMENT - DEMO MODE]',
    data: updated,
  });
}
