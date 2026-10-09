import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from '@/lib/auth';

/**
 * GET, POST, PATCH /api/staff/ev
 * Staff EV Charging Management API
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session || (session.role !== 'STAFF' && session.role !== 'ADMIN')) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const [area, points, reservations] = await Promise.all([
    db.parkingArea.findUnique({
      where: { id: session.parkingAreaId },
      select: { evChargingAvailable: true, evRatePerKw: true },
    }),
    db.evChargingPoint.findMany({
      where: { parkingAreaId: session.parkingAreaId },
      orderBy: { code: 'asc' },
    }),
    db.evReservation.findMany({
      where: { parkingAreaId: session.parkingAreaId, status: { in: ['RESERVED', 'ACTIVE'] } },
      include: {
        evChargingPoint: { select: { code: true } },
        booking: { select: { bookingCode: true, vehiclePlate: true, estimatedArrival: true, estimatedDuration: true } },
      },
      orderBy: { startTime: 'asc' },
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      evChargingAvailable: area?.evChargingAvailable ?? false,
      evRatePerKw: area?.evRatePerKw ?? 15.0,
      points,
      reservations,
    },
  });
}

// Add new charging point
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session || (session.role !== 'STAFF' && session.role !== 'ADMIN')) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { code, powerKw = 22.0 } = body || {};

  if (!code?.trim()) {
    return NextResponse.json({ success: false, message: 'Charging point code is required (e.g. EV01)' }, { status: 400 });
  }

  const normalisedCode = code.trim().toUpperCase();

  const existing = await db.evChargingPoint.findFirst({
    where: { parkingAreaId: session.parkingAreaId, code: normalisedCode },
  });

  if (existing) {
    return NextResponse.json({ success: false, message: `Charging point ${normalisedCode} already exists` }, { status: 409 });
  }

  const newPoint = await db.evChargingPoint.create({
    data: {
      parkingAreaId: session.parkingAreaId,
      code: normalisedCode,
      powerKw: Number(powerKw),
      status: 'AVAILABLE',
    },
  });

  return NextResponse.json({ success: true, data: newPoint });
}

// Toggle status or global EV availability
export async function PATCH(req: NextRequest) {
  const session = await getServerSession();
  if (!session || (session.role !== 'STAFF' && session.role !== 'ADMIN')) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);

  // Toggle global EV availability for the facility
  if (typeof body?.evChargingAvailable === 'boolean') {
    await db.parkingArea.update({
      where: { id: session.parkingAreaId },
      data: { evChargingAvailable: body.evChargingAvailable },
    });
    return NextResponse.json({ success: true, message: 'Facility EV charging setting updated' });
  }

  // Update specific charging point status
  if (body?.pointId && body?.status) {
    const validStatuses = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'DISABLED'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ success: false, message: 'Invalid point status' }, { status: 400 });
    }

    const updated = await db.evChargingPoint.update({
      where: { id: body.pointId },
      data: { status: body.status },
    });
    return NextResponse.json({ success: true, data: updated });
  }

  return NextResponse.json({ success: false, message: 'Invalid payload' }, { status: 400 });
}
