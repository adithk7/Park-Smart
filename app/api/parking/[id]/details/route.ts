import { NextRequest, NextResponse } from 'next/server';
import { getCalculatedAvailability } from '@/lib/booking';

/**
 * GET /api/parking/[id]/details
 * Returns comprehensive details for the parking area including 2W and 4W calculated breakdowns,
 * EV charging point availability, car wash configuration, and operating hours.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ success: false, message: 'Parking area ID is required' }, { status: 400 });
  }

  const availability = await getCalculatedAvailability(id);
  if (!availability) {
    return NextResponse.json({ success: false, message: 'Parking area not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: {
      id: availability.parkingArea.id,
      name: availability.parkingArea.name,
      code: availability.parkingArea.code,
      city: availability.parkingArea.city,
      address: availability.parkingArea.address,
      hourlyRate: availability.parkingArea.hourlyRate4W || availability.parkingArea.hourlyRate || 30.0,
      hourlyRate2W: availability.parkingArea.hourlyRate2W || 15.0,
      hourlyRate4W: availability.parkingArea.hourlyRate4W || 30.0,
      evHourlyRate: availability.parkingArea.evHourlyRate || 50.0,
      currency: availability.parkingArea.currency,
      openingTime: availability.parkingArea.openingTime || '00:00',
      closingTime: availability.parkingArea.closingTime || '23:59',
      carWashAvailable: availability.parkingArea.carWashAvailable,
      carWashRate: availability.parkingArea.carWashRate,
      evChargingAvailable: availability.parkingArea.evChargingAvailable,
      evRatePerKw: availability.parkingArea.evHourlyRate || 50.0,
      totalSlots: availability.totalSlots,
      freeSlots: availability.freeSlots,
      occupiedSlots: availability.occupiedSlots,
      reservedSlots: availability.reservedSlots,
      maintenanceSlots: availability.maintenanceSlots,
      stats2W: availability.stats2W,
      stats4W: availability.stats4W,
      freeEvPoints: availability.freeEvPoints,
      totalEvPoints: availability.evPoints.length,
      evPoints: availability.evPoints,
      slots: availability.slots.map((s) => ({
        id: s.id,
        slotNumber: s.slotNumber,
        vehicleType: s.vehicleType,
        status: s.status, // "FREE", "OCCUPIED", "RESERVED", "BLOCKED"
        zoneId: s.zoneId,
      })),
    },
  });
}
