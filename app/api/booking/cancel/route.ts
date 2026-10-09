import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { broadcastParkingUpdate } from '@/lib/realtime/publisher';

/**
 * POST /api/booking/cancel
 * Cancels a booking and immediately releases its parking slot and EV charging reservation.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.bookingId && !body?.bookingCode) {
    return NextResponse.json(
      { success: false, message: 'bookingId or bookingCode is required' },
      { status: 400 }
    );
  }

  const booking = await db.booking.findFirst({
    where: {
      OR: [
        { id: body.bookingId },
        { bookingCode: body.bookingCode },
      ],
    },
    include: { evReservation: true },
  });

  if (!booking) {
    return NextResponse.json({ success: false, message: 'Booking not found' }, { status: 404 });
  }

  if (booking.status === 'CANCELLED' || booking.status === 'COMPLETED' || booking.status === 'EXPIRED') {
    return NextResponse.json(
      { success: false, message: `Booking cannot be cancelled because it is already ${booking.status}` },
      { status: 400 }
    );
  }

  await db.$transaction(async (tx) => {
    // 1. Mark booking as CANCELLED
    await tx.booking.update({
      where: { id: booking.id },
      data: { status: 'CANCELLED' },
    });

    // 2. Release ParkingSlot if currently RESERVED
    if (booking.slotId) {
      const slot = await tx.parkingSlot.findUnique({ where: { id: booking.slotId } });
      if (slot && slot.status === 'RESERVED') {
        await tx.parkingSlot.update({
          where: { id: booking.slotId },
          data: { status: 'FREE' },
        });
      }
    }

    // 3. Release EV Reservation & Point
    if (booking.evReservation) {
      await tx.evReservation.update({
        where: { id: booking.evReservation.id },
        data: { status: 'RELEASED' },
      });
      if (booking.evChargingPointId) {
        await tx.evChargingPoint.update({
          where: { id: booking.evChargingPointId },
          data: { status: 'AVAILABLE' },
        });
      }
    }
  });

  // Broadcast real-time availability release
  await broadcastParkingUpdate(booking.parkingAreaId, 'BOOKING_CANCELLED', booking.slotId ? {
    id: booking.slotId,
    slotNumber: '',
    vehicleType: booking.vehicleType,
    status: 'FREE',
  } : undefined);

  return NextResponse.json({
    success: true,
    message: 'Booking cancelled successfully. Parking slot and EV charging resources have been released.',
  });
}
