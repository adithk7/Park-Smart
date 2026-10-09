import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from '@/lib/auth';

/**
 * POST /api/staff/gate/confirm
 * Atomically executes Gate Entry or Exit state transition.
 * Uses Prisma $transaction and concurrency checks to prevent duplicate transitions.
 * Strictly scoped to staff's authenticated parkingAreaId.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session || (session.role !== 'STAFF' && session.role !== 'ADMIN')) {
    return NextResponse.json({ success: false, message: 'Unauthorized. Staff session required.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { bookingId, gateType = 'ENTRY', scanMethod = 'QR_CAMERA' } = body || {};

  if (!bookingId || typeof bookingId !== 'string') {
    return NextResponse.json({ success: false, message: 'bookingId is required' }, { status: 400 });
  }

  if (gateType !== 'ENTRY' && gateType !== 'EXIT') {
    return NextResponse.json({ success: false, message: 'Invalid gateType. Must be ENTRY or EXIT' }, { status: 400 });
  }

  try {
    const result = await db.$transaction(async (tx) => {
      // 1. Fetch live booking within transaction
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, parkingAreaId: session.parkingAreaId },
        include: {
          slot: true,
          evChargingPoint: true,
          evReservation: true,
        },
      });

      if (!booking) {
        throw new Error('BOOKING_NOT_FOUND');
      }

      const now = new Date();

      // ─── ENTRY GATE CONFIRMATION ───
      if (gateType === 'ENTRY') {
        // Idempotency check: Cannot check in twice
        if (booking.status === 'CHECKED_IN') {
          throw new Error('ALREADY_CHECKED_IN');
        }

        if (booking.status === 'COMPLETED') {
          throw new Error('ALREADY_COMPLETED');
        }

        if (booking.status !== 'CONFIRMED' && booking.status !== 'PENDING') {
          throw new Error(`STATUS_INVALID_${booking.status}`);
        }

        // Verify slot is available or reserved for this booking
        if (booking.slotId) {
          const slot = await tx.parkingSlot.findUnique({ where: { id: booking.slotId } });
          if (slot && slot.status === 'OCCUPIED') {
            throw new Error('SLOT_OCCUPIED_BY_ANOTHER');
          }
        }

        // 1. Mark booking Checked In and record entry timestamp
        const updatedBooking = await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: 'CHECKED_IN',
            entryAt: now,
            scanCount: { increment: 1 },
          },
        });

        // 2. Change slot status to OCCUPIED
        if (booking.slotId) {
          await tx.parkingSlot.update({
            where: { id: booking.slotId },
            data: { status: 'OCCUPIED' },
          });
        }

        // 3. Change EV Charging Point to IN_USE if requested
        if (booking.evChargingPointId) {
          await tx.evChargingPoint.update({
            where: { id: booking.evChargingPointId },
            data: { status: 'IN_USE' },
          });
        }

        // 4. Update EV reservation to ACTIVE if exists
        if (booking.evReservation) {
          await tx.evReservation.update({
            where: { id: booking.evReservation.id },
            data: { status: 'ACTIVE' },
          });
        }

        // 5. Create GateScanLog audit record
        await tx.gateScanLog.create({
          data: {
            bookingId: booking.id,
            parkingAreaId: session.parkingAreaId,
            gateType: 'ENTRY',
            staffId: session.userId,
            staffName: session.name,
            scanMethod,
            result: 'SUCCESS',
            reason: 'ENTRY APPROVED: Vehicle checked in. Slot marked OCCUPIED.',
          },
        });

        return {
          action: 'ENTRY_CHECKED_IN',
          booking: updatedBooking,
          message: 'ENTRY APPROVED: Vehicle successfully checked in and slot marked as OCCUPIED.',
        };
      }

      // ─── EXIT GATE CONFIRMATION ───
      if (gateType === 'EXIT') {
        if (booking.status === 'COMPLETED') {
          throw new Error('ALREADY_COMPLETED');
        }

        if (booking.status !== 'CHECKED_IN') {
          throw new Error('NOT_CHECKED_IN');
        }

        // 1. Mark booking Completed and record exit timestamp
        const updatedBooking = await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: 'COMPLETED',
            exitAt: now,
            scanCount: { increment: 1 },
            paymentStatus: 'PAID', // Set payment completed upon authorized exit confirmation
          },
        });

        // 2. Release slot to FREE
        if (booking.slotId) {
          await tx.parkingSlot.update({
            where: { id: booking.slotId },
            data: { status: 'FREE' },
          });
        }

        // 3. Release EV charging point to AVAILABLE
        if (booking.evChargingPointId) {
          await tx.evChargingPoint.update({
            where: { id: booking.evChargingPointId },
            data: { status: 'AVAILABLE' },
          });
        }

        // 4. Release EV reservation to COMPLETED
        if (booking.evReservation) {
          await tx.evReservation.update({
            where: { id: booking.evReservation.id },
            data: { status: 'COMPLETED' },
          });
        }

        // 5. Create GateScanLog audit record
        await tx.gateScanLog.create({
          data: {
            bookingId: booking.id,
            parkingAreaId: session.parkingAreaId,
            gateType: 'EXIT',
            staffId: session.userId,
            staffName: session.name,
            scanMethod,
            result: 'SUCCESS',
            reason: 'EXIT APPROVED: Vehicle completed visit. Slot released to AVAILABLE.',
          },
        });

        return {
          action: 'EXIT_COMPLETED',
          booking: updatedBooking,
          message: 'EXIT APPROVED: Vehicle successfully exited. Slot released to AVAILABLE.',
        };
      }

      throw new Error('INVALID_GATE_TYPE');
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    const errorMap: Record<string, { status: number; message: string }> = {
      BOOKING_NOT_FOUND: { status: 404, message: 'Booking not found in this parking facility.' },
      ALREADY_CHECKED_IN: { status: 400, message: 'Vehicle is already checked in. Duplicate check-in rejected.' },
      ALREADY_COMPLETED: { status: 400, message: 'Booking already completed. Repeated exit scans cannot release slot twice.' },
      NOT_CHECKED_IN: { status: 400, message: 'Vehicle has not entered through valid check-in.' },
      SLOT_OCCUPIED_BY_ANOTHER: { status: 409, message: 'Slot allocation conflict: bay currently occupied.' },
    };

    const mapped = errorMap[err.message] || { status: 500, message: err.message || 'Gate transition error' };

    // Record rejected scan log if possible
    try {
      await db.gateScanLog.create({
        data: {
          bookingId,
          parkingAreaId: session.parkingAreaId,
          gateType,
          staffId: session.userId,
          staffName: session.name,
          scanMethod,
          result: 'REJECTED',
          reason: mapped.message,
        },
      });
    } catch {
      // Ignore
    }

    return NextResponse.json({ success: false, reason: err.message, message: mapped.message }, { status: mapped.status });
  }
}
