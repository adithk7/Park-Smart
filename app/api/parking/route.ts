import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAndReleaseExpiredBookings, ensureDefaultSlots } from '@/lib/booking';

// GET /api/parking?q=search&city=Bangalore
// Public endpoint — returns published parking areas with real-time calculated available slots count.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const city = searchParams.get('city')?.trim() ?? '';

  // 1. Release any expired reservations first
  await checkAndReleaseExpiredBookings();

  const areas = await db.parkingArea.findMany({
    where: {
      isPublished: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { city: { contains: q } },
              { address: { contains: q } },
              { code: { contains: q } },
            ],
          }
        : {}),
      ...(city ? { city: { contains: city } } : {}),
    },
    include: {
      slots: {
        select: {
          id: true,
          status: true,
          vehicleType: true,
        },
      },
      chargingPoints: {
        select: {
          id: true,
          status: true,
        },
      },
    },
    orderBy: { name: 'asc' },
    take: 30,
  });

  // Calculate real-time dynamic availability counts for every card
  const result = await Promise.all(
    areas.map(async (area) => {
      // Ensure slots exist if not generated yet
      if (area.slots.length === 0) {
        await ensureDefaultSlots(area.id);
      }

      const freshSlots =
        area.slots.length > 0
          ? area.slots
          : await db.parkingSlot.findMany({ where: { parkingAreaId: area.id } });

      const totalSlots = freshSlots.length > 0 ? freshSlots.length : area.totalCapacity;
      const availableSlots = freshSlots.filter((s) => s.status === 'FREE').length;
      const occupiedSlots = freshSlots.filter((s) => s.status === 'OCCUPIED').length;
      const reservedSlots = freshSlots.filter((s) => s.status === 'RESERVED').length;
      const maintenanceSlots = freshSlots.filter((s) => s.status === 'BLOCKED').length;

      const freeEvPoints = area.chargingPoints.filter((p) => p.status === 'AVAILABLE').length;

      return {
        id: area.id,
        name: area.name,
        code: area.code,
        city: area.city,
        address: area.address,
        venueType: area.venueType,
        tier: area.tier,
        totalCapacity: totalSlots,
        availableSlots,
        occupiedCount: occupiedSlots,
        reservedSlots,
        maintenanceSlots,
        hourlyRate: area.hourlyRate4W || area.hourlyRate || 30.0,
        hourlyRate2W: area.hourlyRate2W || 15.0,
        hourlyRate4W: area.hourlyRate4W || 30.0,
        evChargingAvailable: area.evChargingAvailable,
        evHourlyRate: area.evHourlyRate || 50.0,
        evPointsCount: area.chargingPoints.length,
        freeEvPoints,
        currency: area.currency || 'INR',
      };
    })
  );

  return NextResponse.json({ success: true, data: result });
}
