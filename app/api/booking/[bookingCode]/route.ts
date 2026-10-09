import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAndReleaseExpiredBookings } from '@/lib/booking';
import { deriveBookingQrToken, hashQrToken, buildQrPayload } from '@/lib/qr';

/**
 * GET /api/booking/[bookingCode]
 * Public endpoint to fetch full booking confirmation details by bookingCode.
 * Runs checkAndReleaseExpiredBookings to update status if deadline passed.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ bookingCode: string }> }
) {
  const { bookingCode } = await params;
  if (!bookingCode) {
    return NextResponse.json({ success: false, message: 'bookingCode is required' }, { status: 400 });
  }

  // Clean up any expired bookings first
  await checkAndReleaseExpiredBookings();

  const booking = await db.booking.findUnique({
    where: { bookingCode },
    include: {
      parkingArea: {
        select: {
          name: true,
          code: true,
          address: true,
          city: true,
          hourlyRate: true,
          currency: true,
          contactPhone: true,
        },
      },
      slot: {
        select: {
          slotNumber: true,
          vehicleType: true,
          zone: { select: { name: true, level: { select: { name: true } } } },
        },
      },
      evChargingPoint: {
        select: {
          code: true,
          powerKw: true,
        },
      },
    },
  });

  if (!booking) {
    return NextResponse.json({ success: false, message: 'Booking not found' }, { status: 404 });
  }

  // Ensure qrTokenHash exists
  const qrToken = deriveBookingQrToken(booking.id, booking.bookingCode);
  if (!booking.qrTokenHash) {
    const hash = hashQrToken(qrToken);
    await db.booking.update({
      where: { id: booking.id },
      data: { qrTokenHash: hash },
    });
  }

  const qrPayload = buildQrPayload(booking.bookingCode, qrToken);

  const now = new Date();
  const windowStartTime = new Date(booking.estimatedArrival.getTime() - 15 * 60 * 1000);
  const isWindowOpen = now.getTime() >= windowStartTime.getTime();
  const minutesUntilWindow = Math.max(0, Math.ceil((windowStartTime.getTime() - now.getTime()) / 60000));

  return NextResponse.json({
    success: true,
    data: {
      ...booking,
      qrToken,
      qrPayload,
      isWindowOpen,
      minutesUntilWindow,
    },
  });
}
