import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from '@/lib/auth';
import { checkAndReleaseExpiredBookings } from '@/lib/booking';

/**
 * GET & POST /api/staff/bookings
 * GET: Search/list bookings for staff console
 * POST: Record action (check-in, departure, record-payment)
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session || (session.role !== 'STAFF' && session.role !== 'ADMIN')) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  await checkAndReleaseExpiredBookings(session.parkingAreaId);

  const searchParams = req.nextUrl.searchParams;
  const q = searchParams.get('q')?.trim();

  const bookings = await db.booking.findMany({
    where: {
      parkingAreaId: session.parkingAreaId,
      ...(q
        ? {
            OR: [
              { bookingCode: { contains: q } },
              { vehiclePlate: { contains: q } },
              { slot: { slotNumber: { contains: q } } },
            ],
          }
        : {}),
    },
    include: {
      slot: { select: { slotNumber: true } },
      evChargingPoint: { select: { code: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({ success: true, data: bookings });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session || (session.role !== 'STAFF' && session.role !== 'ADMIN')) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { bookingId, action } = body || {};

  if (!bookingId || !action) {
    return NextResponse.json({ success: false, message: 'bookingId and action are required' }, { status: 400 });
  }

  const booking = await db.booking.findFirst({
    where: { id: bookingId, parkingAreaId: session.parkingAreaId },
  });

  if (!booking) {
    return NextResponse.json({ success: false, message: 'Booking not found' }, { status: 404 });
  }

  if (action === 'CHECK_IN') {
    await db.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'CHECKED_IN' },
      });
      if (booking.slotId) {
        await tx.parkingSlot.update({
          where: { id: booking.slotId },
          data: { status: 'OCCUPIED' },
        });
      }
      if (booking.evChargingPointId) {
        await tx.evChargingPoint.update({
          where: { id: booking.evChargingPointId },
          data: { status: 'IN_USE' },
        });
      }
    });
    return NextResponse.json({ success: true, message: 'Vehicle check-in recorded. Slot marked as OCCUPIED.' });
  }

  if (action === 'RECORD_PAYMENT') {
    const updated = await db.booking.update({
      where: { id: booking.id },
      data: { paymentStatus: 'PAID' },
    });
    return NextResponse.json({ success: true, message: 'Payment recorded as PAID.', data: updated });
  }

  if (action === 'DEPARTURE') {
    await db.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'COMPLETED', paymentStatus: 'PAID' },
      });
      if (booking.slotId) {
        await tx.parkingSlot.update({
          where: { id: booking.slotId },
          data: { status: 'FREE' },
        });
      }
      if (booking.evChargingPointId) {
        await tx.evChargingPoint.update({
          where: { id: booking.evChargingPointId },
          data: { status: 'AVAILABLE' },
        });
      }
    });
    return NextResponse.json({ success: true, message: 'Vehicle departure recorded. Slot and EV point released.' });
  }

  return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
}
