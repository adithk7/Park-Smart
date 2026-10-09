import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from '@/lib/auth';

/**
 * GET & PATCH /api/staff/slots
 * Staff management for parking slots with conflict protection.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session || (session.role !== 'STAFF' && session.role !== 'ADMIN')) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const slots = await db.parkingSlot.findMany({
    where: { parkingAreaId: session.parkingAreaId },
    orderBy: { slotNumber: 'asc' },
  });

  return NextResponse.json({ success: true, data: slots });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession();
  if (!session || (session.role !== 'STAFF' && session.role !== 'ADMIN')) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.slotId || !body?.status) {
    return NextResponse.json({ success: false, message: 'slotId and status are required' }, { status: 400 });
  }

  const validStatuses = ['FREE', 'OCCUPIED', 'RESERVED', 'BLOCKED'];
  if (!validStatuses.includes(body.status)) {
    return NextResponse.json({ success: false, message: 'Invalid slot status' }, { status: 400 });
  }

  const slot = await db.parkingSlot.findFirst({
    where: { id: body.slotId, parkingAreaId: session.parkingAreaId },
  });

  if (!slot) {
    return NextResponse.json({ success: false, message: 'Slot not found' }, { status: 404 });
  }

  // Conflict protection: Cannot mark slot as FREE while a vehicle is checked in or active reservation exists
  if (body.status === 'FREE') {
    const activeBooking = await db.booking.findFirst({
      where: {
        slotId: slot.id,
        status: { in: ['CHECKED_IN', 'CONFIRMED'] },
      },
    });

    if (activeBooking) {
      return NextResponse.json(
        {
          success: false,
          message: `Conflict Error: Cannot mark slot ${slot.slotNumber} as AVAILABLE while vehicle ${activeBooking.vehiclePlate} is checked in or has an active reservation. Record departure first.`,
        },
        { status: 409 }
      );
    }
  }

  const updated = await db.parkingSlot.update({
    where: { id: slot.id },
    data: { status: body.status },
  });

  return NextResponse.json({ success: true, data: updated });
}
