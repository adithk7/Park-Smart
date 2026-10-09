// lib/availability.ts

import { db } from '@/lib/db';
import { checkAndReleaseExpiredBookings } from '@/lib/booking';

/**
 * Returns an object with the counts for a given parking area.
 * All numbers are derived from the live ParkingSlot rows and active bookings.
 */
export async function getParkingAvailability(parkingAreaId: string) {
  // Clean up any expired bookings before returning live slot counts
  await checkAndReleaseExpiredBookings(parkingAreaId);

  const total = await db.parkingSlot.count({ where: { parkingAreaId } });
  const [free, occupied, reserved, blocked] = await Promise.all([
    db.parkingSlot.count({ where: { parkingAreaId, status: 'FREE' } }),
    db.parkingSlot.count({ where: { parkingAreaId, status: 'OCCUPIED' } }),
    db.parkingSlot.count({ where: { parkingAreaId, status: 'RESERVED' } }),
    db.parkingSlot.count({ where: { parkingAreaId, status: 'BLOCKED' } }),
  ]);
  const available = free; // Business rule: FREE slots are considered available.
  return { total, free, occupied, reserved, blocked, available };
}
