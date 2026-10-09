import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from '@/lib/auth';

/**
 * GET & PATCH /api/admin/facility
 * Admin settings for parking name, address, hours, tariffs, EV, and car wash.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const area = await db.parkingArea.findUnique({
    where: { id: session.parkingAreaId },
  });

  return NextResponse.json({ success: true, data: area });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ success: false, message: 'Invalid body' }, { status: 400 });
  }

  const {
    name,
    address,
    city,
    contactPhone,
    openingTime,
    closingTime,
    hourlyRate,
    carWashAvailable,
    carWashRate,
    evChargingAvailable,
    evRatePerKw,
  } = body;

  const updated = await db.parkingArea.update({
    where: { id: session.parkingAreaId },
    data: {
      ...(name && { name: name.trim() }),
      ...(address !== undefined && { address: address ? address.trim() : null }),
      ...(city !== undefined && { city: city ? city.trim() : null }),
      ...(contactPhone !== undefined && { contactPhone: contactPhone ? contactPhone.trim() : null }),
      ...(openingTime && { openingTime }),
      ...(closingTime && { closingTime }),
      ...(hourlyRate !== undefined && { hourlyRate: Number(hourlyRate) }),
      ...(carWashAvailable !== undefined && { carWashAvailable: Boolean(carWashAvailable) }),
      ...(carWashRate !== undefined && { carWashRate: Number(carWashRate) }),
      ...(evChargingAvailable !== undefined && { evChargingAvailable: Boolean(evChargingAvailable) }),
      ...(evRatePerKw !== undefined && { evRatePerKw: Number(evRatePerKw) }),
    },
  });

  return NextResponse.json({ success: true, message: 'Facility configuration updated', data: updated });
}
