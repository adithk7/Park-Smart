/**
 * lib/booking.ts
 * Core business logic for ParkSmart Booking, EV Charging, Pre-booking Window, and Automatic Expiration
 */
import { db } from '@/lib/db';

/**
 * 1. Automatic Reservation Expiration Job / Helper
 * Checks for any active or confirmed bookings whose checkInDeadline has passed.
 * Automatically marks them as EXPIRED, frees the allocated ParkingSlot, and releases EV charging points.
 */
export async function checkAndReleaseExpiredBookings(parkingAreaId?: string): Promise<number> {
  const now = new Date();
  
  // Find bookings that have passed their check-in deadline
  const expiredBookings = await db.booking.findMany({
    where: {
      ...(parkingAreaId ? { parkingAreaId } : {}),
      status: { in: ['PENDING', 'CONFIRMED'] },
      checkInDeadline: { lt: now },
    },
    include: {
      evReservation: true,
    },
  });

  if (expiredBookings.length === 0) return 0;

  for (const booking of expiredBookings) {
    await db.$transaction(async (tx) => {
      // 1. Mark booking as EXPIRED
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'EXPIRED' },
      });

      // 2. Release ParkingSlot if allocated and currently RESERVED
      if (booking.slotId) {
        const slot = await tx.parkingSlot.findUnique({
          where: { id: booking.slotId },
        });
        if (slot && slot.status === 'RESERVED') {
          await tx.parkingSlot.update({
            where: { id: booking.slotId },
            data: { status: 'FREE' },
          });
        }
      }

      // 3. Release EV Reservation and Charging Point if applicable
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
  }

  return expiredBookings.length;
}

/**
 * 2. Check EV Charging Point Availability for a specified period
 */
export async function checkEvChargingAvailability(
  parkingAreaId: string,
  startTime: Date,
  durationHours: number
): Promise<{ available: boolean; chargingPoint?: any; message?: string; totalPoints: number; freePointsCount: number }> {
  const area = await db.parkingArea.findUnique({
    where: { id: parkingAreaId },
    select: { evChargingAvailable: true },
  });

  if (!area || !area.evChargingAvailable) {
    return { available: false, message: 'EV charging is not supported at this facility', totalPoints: 0, freePointsCount: 0 };
  }

  const endTime = new Date(startTime.getTime() + durationHours * 3600 * 1000);

  // Get all active EV points for this parking area (exclude maintenance/disabled)
  const allPoints = await db.evChargingPoint.findMany({
    where: {
      parkingAreaId,
      status: { in: ['AVAILABLE', 'IN_USE'] },
    },
  });

  if (allPoints.length === 0) {
    return { available: false, message: 'No EV charging points configured at this venue', totalPoints: 0, freePointsCount: 0 };
  }

  // Find points that have overlapping reservations
  const overlappingReservations = await db.evReservation.findMany({
    where: {
      parkingAreaId,
      status: { in: ['RESERVED', 'ACTIVE'] },
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
    select: { evChargingPointId: true },
  });

  const reservedPointIds = new Set(overlappingReservations.map((r) => r.evChargingPointId));
  const availablePoints = allPoints.filter((p) => !reservedPointIds.has(p.id));

  if (availablePoints.length === 0) {
    return {
      available: false,
      message: 'EV charging unavailable for your selected time.',
      totalPoints: allPoints.length,
      freePointsCount: 0,
    };
  }

  return {
    available: true,
    chargingPoint: availablePoints[0],
    totalPoints: allPoints.length,
    freePointsCount: availablePoints.length,
  };
}

/**
 * Ensures a parking area has at least a default Level and Zone with slots if none exist.
 */
export async function ensureDefaultSlots(parkingAreaId: string) {
  const existingCount = await db.parkingSlot.count({ where: { parkingAreaId } });
  if (existingCount > 0) return;

  // Create Level 1 -> Zone A -> 12 slots (A01..A12)
  let level = await db.level.findFirst({ where: { parkingAreaId, name: 'Level 1' } });
  if (!level) {
    level = await db.level.create({
      data: { parkingAreaId, name: 'Level 1', displayOrder: 1 },
    });
  }

  let zone = await db.zone.findFirst({ where: { levelId: level.id, name: 'Zone A' } });
  if (!zone) {
    zone = await db.zone.create({
      data: { parkingAreaId, levelId: level.id, name: 'Zone A', zoneType: 'VISITOR_POOL' },
    });
  }

  const slotData = [];
  for (let i = 1; i <= 12; i++) {
    const num = String(i).padStart(2, '0');
    const vType = i <= 2 ? '2W' : i === 3 ? 'EV' : '4W';
    slotData.push({
      parkingAreaId,
      zoneId: zone.id,
      slotNumber: `A${num}`,
      vehicleType: vType,
      status: 'FREE',
    });
  }

  for (const s of slotData) {
    await db.parkingSlot.create({ data: s }).catch(() => {});
  }
}

/**
 * 3. Calculate Real-Time Dynamic Slot & Availability Breakdown
 */
export async function getCalculatedAvailability(parkingAreaId: string) {
  // First clean up any expired bookings for accurate numbers
  await checkAndReleaseExpiredBookings(parkingAreaId);

  // Ensure default slots exist if operator hasn't generated layout yet
  await ensureDefaultSlots(parkingAreaId);

  const [area, slots, evPoints] = await Promise.all([
    db.parkingArea.findUnique({ where: { id: parkingAreaId } }),
    db.parkingSlot.findMany({ where: { parkingAreaId } }),
    db.evChargingPoint.findMany({ where: { parkingAreaId } }),
  ]);

  if (!area) return null;

  const twoWheelerSlots = slots.filter((s) => s.vehicleType === '2W' || s.slotNumber.startsWith('B'));
  const fourWheelerSlots = slots.filter((s) => s.vehicleType === '4W' || s.slotNumber.startsWith('C') || s.vehicleType === 'EV' || s.vehicleType === 'SUV');

  const stats2W = {
    total: twoWheelerSlots.length,
    available: twoWheelerSlots.filter((s) => s.status === 'FREE').length,
    occupied: twoWheelerSlots.filter((s) => s.status === 'OCCUPIED').length,
    reserved: twoWheelerSlots.filter((s) => s.status === 'RESERVED').length,
    maintenance: twoWheelerSlots.filter((s) => s.status === 'BLOCKED').length,
  };

  const stats4W = {
    total: fourWheelerSlots.length,
    available: fourWheelerSlots.filter((s) => s.status === 'FREE').length,
    occupied: fourWheelerSlots.filter((s) => s.status === 'OCCUPIED').length,
    reserved: fourWheelerSlots.filter((s) => s.status === 'RESERVED').length,
    maintenance: fourWheelerSlots.filter((s) => s.status === 'BLOCKED').length,
  };

  const totalSlots = slots.length;
  const freeSlots = slots.filter((s) => s.status === 'FREE').length;
  const occupiedSlots = slots.filter((s) => s.status === 'OCCUPIED').length;
  const reservedSlots = slots.filter((s) => s.status === 'RESERVED').length;
  const maintenanceSlots = slots.filter((s) => s.status === 'BLOCKED').length;

  const freeEvPoints = evPoints.filter((p) => p.status === 'AVAILABLE').length;

  return {
    parkingArea: area,
    totalSlots,
    freeSlots,
    occupiedSlots,
    reservedSlots,
    maintenanceSlots,
    stats2W,
    stats4W,
    slots,
    evPoints,
    freeEvPoints,
  };
}

/**
 * 4. Helper to allocate a compatible slot
 */
export async function findCompatibleSlot(
  parkingAreaId: string,
  vehicleType: string,
  requestedSlotId?: string
) {
  await ensureDefaultSlots(parkingAreaId);

  // If specific slot requested, check if it's free
  if (requestedSlotId) {
    const slot = await db.parkingSlot.findFirst({
      where: { id: requestedSlotId, parkingAreaId, status: 'FREE' },
    });
    if (slot) return slot;
  }

  // Map requested type to candidate slot vehicleTypes
  const candidateTypes = [vehicleType, '4W', '2W', 'EV', 'SUV', 'ACCESSIBLE'];

  const slot = await db.parkingSlot.findFirst({
    where: {
      parkingAreaId,
      status: 'FREE',
      vehicleType: { in: candidateTypes },
    },
    orderBy: { slotNumber: 'asc' },
  });

  return slot;
}
