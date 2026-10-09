import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validatePlate } from '@/lib/plate';
import {
  checkAndReleaseExpiredBookings,
  checkEvChargingAvailability,
  findCompatibleSlot,
} from '@/lib/booking';

/**
 * POST /api/booking/create
 * Creates a new parking booking with slot allocation, EV charging reservation, and payment workflow.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    parkingAreaId,
    slotId,
    vehicleType = '4W',
    vehiclePlate,
    estimatedArrival,
    estimatedDuration = 1,
    carWashRequested = false,
    evChargingRequested = false,
    paymentMethod = 'PAY_AT_PARKING',
    driverPhone,
  } = body;

  if (!parkingAreaId || !vehiclePlate || !estimatedArrival) {
    return NextResponse.json(
      { success: false, message: 'parkingAreaId, vehiclePlate, and estimatedArrival are required' },
      { status: 400 }
    );
  }

  // 1. Clean up any expired bookings first
  await checkAndReleaseExpiredBookings(parkingAreaId);

  // 2. Validate plate format
  const plateResult = validatePlate(vehiclePlate);
  if (!plateResult.valid) {
    return NextResponse.json(
      { success: false, message: plateResult.reason || 'Invalid vehicle plate number format' },
      { status: 422 }
    );
  }

  // 3. Fetch parking area configuration
  const area = await db.parkingArea.findUnique({
    where: { id: parkingAreaId },
  });
  if (!area) {
    return NextResponse.json({ success: false, message: 'Parking area not found' }, { status: 404 });
  }

  const arrivalDate = new Date(estimatedArrival);
  if (isNaN(arrivalDate.getTime())) {
    return NextResponse.json({ success: false, message: 'Invalid arrival date/time' }, { status: 400 });
  }

  const now = new Date();
  // Arrival cannot be more than 1 hour in the past
  if (arrivalDate.getTime() < now.getTime() - 60 * 60 * 1000) {
    return NextResponse.json(
      { success: false, message: 'Estimated arrival time cannot be in the past' },
      { status: 400 }
    );
  }

  // 4. Check EV Charging availability if requested
  let allocatedEvPointId: string | undefined = undefined;
  if (evChargingRequested) {
    const evCheck = await checkEvChargingAvailability(parkingAreaId, arrivalDate, estimatedDuration);
    if (!evCheck.available) {
      return NextResponse.json(
        { success: false, message: evCheck.message || 'EV charging unavailable for your selected time.' },
        { status: 400 }
      );
    }
    allocatedEvPointId = evCheck.chargingPoint.id;
  }

  // 5. Find compatible parking slot
  const slot = await findCompatibleSlot(parkingAreaId, vehicleType, slotId);
  if (!slot) {
    return NextResponse.json(
      { success: false, message: 'No available compatible parking slot for your vehicle type.' },
      { status: 409 }
    );
  }

  // 6. Calculate Pricing
  const durationHours = Math.max(1, Number(estimatedDuration));
  const hourlyParkingRate =
    vehicleType === '2W'
      ? area.hourlyRate2W || 15.0
      : area.hourlyRate4W || area.hourlyRate || 30.0;
  const evRate = area.evHourlyRate || area.evRatePerKw || 50.0;

  const parkingFee = durationHours * hourlyParkingRate;
  const carWashFee = carWashRequested && area.carWashAvailable ? area.carWashRate : 0.0;
  const evChargingFee = evChargingRequested && area.evChargingAvailable ? durationHours * evRate : 0.0;
  const serviceCharge = 10.0;
  const totalAmount = parkingFee + carWashFee + evChargingFee + serviceCharge;

  // 7. Calculate Check-In Deadline (estimatedArrival + 20 minutes)
  const checkInDeadline = new Date(arrivalDate.getTime() + 20 * 60 * 1000);

  // 8. 15-Minute Pre-Booking Window check for Prepay Online
  const windowStartTime = new Date(arrivalDate.getTime() - 15 * 60 * 1000);
  const isWindowOpen = now.getTime() >= windowStartTime.getTime();
  const minutesUntilWindow = Math.max(0, Math.ceil((windowStartTime.getTime() - now.getTime()) / 60000));

  // Determine initial status based on payment method and timing
  let initialStatus = 'CONFIRMED';
  let paymentStatus = 'PENDING';

  if (paymentMethod === 'PREPAY_ONLINE') {
    if (!isWindowOpen) {
      initialStatus = 'PENDING';
      paymentStatus = 'PENDING';
    } else {
      // In demo test mode, if online prepay is requested and window is open, it gets pre-confirmed
      initialStatus = 'CONFIRMED';
      paymentStatus = 'PAID';
    }
  }

  // 9. Execute DB Transaction
  const booking = await db.$transaction(async (tx) => {
    // Generate unique short code
    const count = await tx.booking.count();
    const bookingCode = `BK-${String(count + 1001).padStart(5, '0')}`;

    const newBooking = await tx.booking.create({
      data: {
        bookingCode,
        parkingAreaId,
        slotId: slot.id,
        vehicleType,
        vehiclePlate: vehiclePlate.trim().toUpperCase(),
        estimatedArrival: arrivalDate,
        estimatedDuration: durationHours,
        checkInDeadline,
        carWashRequested: Boolean(carWashRequested),
        carWashFee,
        evChargingRequested: Boolean(evChargingRequested),
        evChargingFee,
        evChargingPointId: allocatedEvPointId || null,
        parkingRatePerHour: hourlyParkingRate,
        evRatePerHour: evRate,
        parkingFee,
        totalAmount,
        paymentMethod,
        paymentStatus,
        status: initialStatus,
        driverPhone: driverPhone || null,
      },
    });

    // Mark slot as RESERVED
    await tx.parkingSlot.update({
      where: { id: slot.id },
      data: { status: 'RESERVED' },
    });

    // Create EV Reservation if EV requested
    if (evChargingRequested && allocatedEvPointId) {
      const endTime = new Date(arrivalDate.getTime() + durationHours * 3600 * 1000);
      await tx.evReservation.create({
        data: {
          parkingAreaId,
          evChargingPointId: allocatedEvPointId,
          bookingId: newBooking.id,
          startTime: arrivalDate,
          endTime,
          status: 'RESERVED',
        },
      });
    }

    return newBooking;
  });

  return NextResponse.json({
    success: true,
    data: {
      id: booking.id,
      bookingCode: booking.bookingCode,
      parkingAreaId: booking.parkingAreaId,
      slotNumber: slot.slotNumber,
      vehiclePlate: booking.vehiclePlate,
      estimatedArrival: booking.estimatedArrival,
      checkInDeadline: booking.checkInDeadline,
      totalAmount: booking.totalAmount,
      paymentMethod: booking.paymentMethod,
      paymentStatus: booking.paymentStatus,
      status: booking.status,
      windowOpen: isWindowOpen,
      minutesUntilWindow,
    },
  });
}
