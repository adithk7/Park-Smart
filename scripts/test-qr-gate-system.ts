/**
 * scripts/test-qr-gate-system.ts
 * Rigorous test suite validating all 15 scenarios of the QR gate entry & exit system.
 */
import { db } from '../lib/db';
import { signToken } from '../lib/auth';
import { generateBookingQrToken, buildQrPayload, hashQrToken, verifyQrToken } from '../lib/qr';
import { getParkingAvailability } from '../lib/availability';

async function runTests() {
  console.log('====================================================');
  console.log('PARK-SMART QR GATE ENTRY & EXIT VERIFICATION TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let total = 15;

  // ── Setup Test Fixtures ──
  console.log('[SETUP] Preparing test parking facilities and staff accounts...');
  
  // Clean up any previous test areas
  await db.gateScanLog.deleteMany({ where: { parkingArea: { code: { in: ['TEST-QR-A', 'TEST-QR-B'] } } } });
  await db.booking.deleteMany({ where: { parkingArea: { code: { in: ['TEST-QR-A', 'TEST-QR-B'] } } } });
  await db.parkingSlot.deleteMany({ where: { parkingArea: { code: { in: ['TEST-QR-A', 'TEST-QR-B'] } } } });
  await db.evChargingPoint.deleteMany({ where: { parkingArea: { code: { in: ['TEST-QR-A', 'TEST-QR-B'] } } } });
  await db.zone.deleteMany({ where: { parkingArea: { code: { in: ['TEST-QR-A', 'TEST-QR-B'] } } } });
  await db.level.deleteMany({ where: { parkingArea: { code: { in: ['TEST-QR-A', 'TEST-QR-B'] } } } });
  await db.parkingArea.deleteMany({ where: { code: { in: ['TEST-QR-A', 'TEST-QR-B'] } } });

  // Facility A
  const areaA = await db.parkingArea.create({
    data: {
      name: 'Metro Plaza Terminal A',
      code: 'TEST-QR-A',
      totalCapacity: 10,
      twoWheelerCapacity: 5,
      fourWheelerCapacity: 5,
      hourlyRate: 20.0,
      evChargingAvailable: true,
      evHourlyRate: 40.0,
      evPointsCount: 1,
    },
  });

  const levelA = await db.level.create({
    data: { parkingAreaId: areaA.id, name: 'Ground Floor', displayOrder: 1 },
  });
  const zoneA = await db.zone.create({
    data: { parkingAreaId: areaA.id, levelId: levelA.id, name: 'Zone G', zoneType: 'VISITOR_POOL' },
  });

  const slotA1 = await db.parkingSlot.create({
    data: { parkingAreaId: areaA.id, zoneId: zoneA.id, slotNumber: 'A-01', vehicleType: '4W', status: 'FREE' },
  });
  const slotA2 = await db.parkingSlot.create({
    data: { parkingAreaId: areaA.id, zoneId: zoneA.id, slotNumber: 'A-02', vehicleType: '4W', status: 'FREE' },
  });

  const evPointA = await db.evChargingPoint.create({
    data: { parkingAreaId: areaA.id, code: 'EV-A1', powerKw: 22.0, status: 'AVAILABLE' },
  });

  // Facility B (for cross-tenant rejection testing)
  const areaB = await db.parkingArea.create({
    data: {
      name: 'Airport Cargo Terminal B',
      code: 'TEST-QR-B',
      totalCapacity: 10,
      hourlyRate: 30.0,
    },
  });

  // Staff A JWT
  const staffTokenA = await signToken({
    userId: 'staff_user_a',
    role: 'STAFF',
    parkingAreaId: areaA.id,
    name: 'Gate Attendant Alice',
  });

  // Staff B JWT
  const staffTokenB = await signToken({
    userId: 'staff_user_b',
    role: 'STAFF',
    parkingAreaId: areaB.id,
    name: 'Gate Attendant Bob',
  });

  console.log('[SETUP COMPLETE] Test fixture ready.\n');

  // Helper function to call local API routes directly
  const origin = 'http://localhost:3000';

  // ─────────────────────────────────────────────────────────────
  // TEST 1: Confirmed booking generates and displays a valid QR code
  // ─────────────────────────────────────────────────────────────
  console.log('--- TEST 1: Confirmed booking displays a valid QR code ---');
  const booking1Id = 'bk_test_1';
  const booking1Code = 'BK-99001';
  const { token: qrToken1, hash: qrHash1 } = generateBookingQrToken(booking1Id, booking1Code);
  const qrPayload1 = buildQrPayload(booking1Code, qrToken1);

  const booking1 = await db.booking.create({
    data: {
      id: booking1Id,
      bookingCode: booking1Code,
      parkingAreaId: areaA.id,
      slotId: slotA1.id,
      vehicleType: '4W',
      vehiclePlate: 'DL 01 AB 1234',
      estimatedArrival: new Date(Date.now() + 10 * 60 * 1000),
      estimatedDuration: 2,
      checkInDeadline: new Date(Date.now() + 30 * 60 * 1000),
      parkingFee: 40.0,
      totalAmount: 40.0,
      paymentMethod: 'PAY_AT_PARKING',
      paymentStatus: 'PENDING',
      status: 'CONFIRMED',
      qrTokenHash: qrHash1,
    },
  });
  await db.parkingSlot.update({ where: { id: slotA1.id }, data: { status: 'RESERVED' } });

  const isTokenValid = verifyQrToken(qrToken1, booking1.qrTokenHash!);
  if (isTokenValid && qrPayload1.includes(booking1Code) && qrPayload1.includes(qrToken1)) {
    console.log('✔ PASS: QR token generated, hashed, verified timing-safe, and embedded in payload.');
    passed++;
  } else {
    console.error('❌ FAIL: QR token or payload verification failed.');
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 2: Valid entry scan changes booking to Checked In and slot to Occupied
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 2: Valid entry scan changes booking to Checked In and slot to Occupied ---');
  const validateEntryRes = await fetch(`${origin}/api/staff/gate/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `parksmart_session=${staffTokenA}` },
    body: JSON.stringify({ input: qrPayload1, gateType: 'ENTRY' }),
  });
  const validateEntryJson = await validateEntryRes.json();

  if (!validateEntryJson.success || !validateEntryJson.approved) {
    console.error('❌ FAIL: Entry validate failed:', validateEntryJson);
  } else {
    const confirmEntryRes = await fetch(`${origin}/api/staff/gate/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `parksmart_session=${staffTokenA}` },
      body: JSON.stringify({ bookingId: booking1.id, gateType: 'ENTRY' }),
    });
    const confirmEntryJson = await confirmEntryRes.json();

    const updatedBooking1 = await db.booking.findUnique({ where: { id: booking1.id } });
    const updatedSlotA1 = await db.parkingSlot.findUnique({ where: { id: slotA1.id } });

    if (
      confirmEntryJson.success &&
      updatedBooking1?.status === 'CHECKED_IN' &&
      updatedBooking1?.entryAt !== null &&
      updatedSlotA1?.status === 'OCCUPIED'
    ) {
      console.log('✔ PASS: Entry scan transitioned booking to CHECKED_IN, recorded entryAt, and slot is OCCUPIED.');
      passed++;
    } else {
      console.error('❌ FAIL: Booking or slot state mismatch after entry scan.', { updatedBooking1, updatedSlotA1 });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 3: Repeating the entry scan does not check the vehicle in twice
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 3: Repeating entry scan does not check vehicle in twice ---');
  const repeatEntryRes = await fetch(`${origin}/api/staff/gate/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `parksmart_session=${staffTokenA}` },
    body: JSON.stringify({ input: qrPayload1, gateType: 'ENTRY' }),
  });
  const repeatEntryJson = await repeatEntryRes.json();

  const repeatConfirmRes = await fetch(`${origin}/api/staff/gate/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `parksmart_session=${staffTokenA}` },
    body: JSON.stringify({ bookingId: booking1.id, gateType: 'ENTRY' }),
  });
  const repeatConfirmJson = await repeatConfirmRes.json();

  if (
    !repeatEntryJson.success &&
    repeatEntryJson.reason === 'Already checked in' &&
    !repeatConfirmJson.success
  ) {
    console.log('✔ PASS: Repeated entry scan was rejected with "Already checked in". Scan count not duplicated.');
    passed++;
  } else {
    console.error('❌ FAIL: Repeated entry scan was not rejected properly:', { repeatEntryJson, repeatConfirmJson });
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 4: Exit scan changes booking to Completed and releases slot to Available
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 4: Exit scan changes booking to Completed and releases slot ---');
  const validateExitRes = await fetch(`${origin}/api/staff/gate/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `parksmart_session=${staffTokenA}` },
    body: JSON.stringify({ input: qrPayload1, gateType: 'EXIT' }),
  });
  const validateExitJson = await validateExitRes.json();

  if (!validateExitJson.success || !validateExitJson.approved) {
    console.error('❌ FAIL: Exit validate failed:', validateExitJson);
  } else {
    const confirmExitRes = await fetch(`${origin}/api/staff/gate/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `parksmart_session=${staffTokenA}` },
      body: JSON.stringify({ bookingId: booking1.id, gateType: 'EXIT' }),
    });
    const confirmExitJson = await confirmExitRes.json();

    const completedBooking1 = await db.booking.findUnique({ where: { id: booking1.id } });
    const releasedSlotA1 = await db.parkingSlot.findUnique({ where: { id: slotA1.id } });

    if (
      confirmExitJson.success &&
      completedBooking1?.status === 'COMPLETED' &&
      completedBooking1?.exitAt !== null &&
      releasedSlotA1?.status === 'FREE'
    ) {
      console.log('✔ PASS: Exit scan marked booking COMPLETED, recorded exitAt, and released slot to FREE.');
      passed++;
    } else {
      console.error('❌ FAIL: Completed booking or released slot state mismatch:', { completedBooking1, releasedSlotA1 });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 5: Repeating the exit scan does not release the slot twice
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 5: Repeating exit scan does not release slot twice ---');
  const repeatExitRes = await fetch(`${origin}/api/staff/gate/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `parksmart_session=${staffTokenA}` },
    body: JSON.stringify({ input: qrPayload1, gateType: 'EXIT' }),
  });
  const repeatExitJson = await repeatExitRes.json();

  const repeatExitConfirmRes = await fetch(`${origin}/api/staff/gate/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `parksmart_session=${staffTokenA}` },
    body: JSON.stringify({ bookingId: booking1.id, gateType: 'EXIT' }),
  });
  const repeatExitConfirmJson = await repeatExitConfirmRes.json();

  if (
    !repeatExitJson.success &&
    repeatExitJson.reason === 'Booking already completed' &&
    !repeatExitConfirmJson.success
  ) {
    console.log('✔ PASS: Repeated exit scan rejected with "Booking already completed". No duplicate release.');
    passed++;
  } else {
    console.error('❌ FAIL: Repeated exit scan was not rejected properly:', { repeatExitJson, repeatExitConfirmJson });
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 6: Wrong parking area is rejected
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 6: Wrong parking area is rejected ---');
  // Staff B (assigned to Area B) attempts to scan booking belonging to Area A
  const wrongAreaRes = await fetch(`${origin}/api/staff/gate/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `parksmart_session=${staffTokenB}` },
    body: JSON.stringify({ input: qrPayload1, gateType: 'ENTRY' }),
  });
  const wrongAreaJson = await wrongAreaRes.json();

  if (wrongAreaRes.status === 403 && wrongAreaJson.reason === 'Wrong parking area') {
    console.log('✔ PASS: Staff scanning another facility booking was rejected with HTTP 403 "Wrong parking area".');
    passed++;
  } else {
    console.error('❌ FAIL: Cross-facility scan was not rejected with 403:', wrongAreaJson);
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 7: Invalid QR code is rejected
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 7: Invalid QR code is rejected ---');
  const tamperedPayload = JSON.stringify({
    schema: 'PARKSMART_PASS_V1',
    ref: booking1Code,
    token: 'pks_tampered_fake_unauthorized_token_xyz123',
  });
  const invalidQrRes = await fetch(`${origin}/api/staff/gate/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `parksmart_session=${staffTokenA}` },
    body: JSON.stringify({ input: tamperedPayload, gateType: 'ENTRY' }),
  });
  const invalidQrJson = await invalidQrRes.json();

  if (!invalidQrJson.success && invalidQrJson.reason === 'Invalid QR code') {
    console.log('✔ PASS: Tampered QR token rejected with "Invalid QR code".');
    passed++;
  } else {
    console.error('❌ FAIL: Tampered token not rejected:', invalidQrJson);
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 8: Cancelled and expired bookings are rejected at entry
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 8: Cancelled and expired bookings are rejected at entry ---');
  // Create cancelled booking
  const bkCancelled = await db.booking.create({
    data: {
      bookingCode: 'BK-CANCELLED-1',
      parkingAreaId: areaA.id,
      slotId: slotA2.id,
      vehiclePlate: 'DL 02 CANCEL',
      estimatedArrival: new Date(),
      checkInDeadline: new Date(Date.now() + 20 * 60 * 1000),
      status: 'CANCELLED',
      qrTokenHash: hashQrToken('pks_token_cancelled'),
    },
  });

  // Create expired booking (grace window passed)
  const bkExpired = await db.booking.create({
    data: {
      bookingCode: 'BK-EXPIRED-1',
      parkingAreaId: areaA.id,
      slotId: slotA2.id,
      vehiclePlate: 'DL 03 EXPIRE',
      estimatedArrival: new Date(Date.now() - 40 * 60 * 1000),
      checkInDeadline: new Date(Date.now() - 20 * 60 * 1000), // deadline 20 mins ago
      status: 'CONFIRMED',
      qrTokenHash: hashQrToken('pks_token_expired'),
    },
  });

  const resCancelled = await fetch(`${origin}/api/staff/gate/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `parksmart_session=${staffTokenA}` },
    body: JSON.stringify({ input: 'BK-CANCELLED-1', gateType: 'ENTRY' }),
  });
  const jsonCancelled = await resCancelled.json();

  const resExpired = await fetch(`${origin}/api/staff/gate/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `parksmart_session=${staffTokenA}` },
    body: JSON.stringify({ input: 'BK-EXPIRED-1', gateType: 'ENTRY' }),
  });
  const jsonExpired = await resExpired.json();

  if (
    !jsonCancelled.success && jsonCancelled.reason === 'Booking cancelled' &&
    !jsonExpired.success && jsonExpired.reason === 'Booking expired'
  ) {
    console.log('✔ PASS: Both cancelled and expired bookings safely rejected at entry gate.');
    passed++;
  } else {
    console.error('❌ FAIL: Cancelled or expired bookings were not rejected properly:', { jsonCancelled, jsonExpired });
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 9: A completed booking cannot be reused
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 9: A completed booking cannot be reused ---');
  const resReuse = await fetch(`${origin}/api/staff/gate/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `parksmart_session=${staffTokenA}` },
    body: JSON.stringify({ input: booking1Code, gateType: 'ENTRY' }),
  });
  const jsonReuse = await resReuse.json();

  if (!jsonReuse.success && jsonReuse.reason === 'Booking already completed') {
    console.log('✔ PASS: Completed booking cannot be reused for new entry.');
    passed++;
  } else {
    console.error('❌ FAIL: Completed booking reuse not rejected:', jsonReuse);
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 10: A wrong-gate scan does not advance the booking
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 10: Wrong-gate scan does not advance booking lifecycle ---');
  // Create fresh confirmed booking
  const bkFresh = await db.booking.create({
    data: {
      bookingCode: 'BK-FRESH-10',
      parkingAreaId: areaA.id,
      slotId: slotA2.id,
      vehiclePlate: 'DL 10 FRESH',
      estimatedArrival: new Date(Date.now() + 10 * 60 * 1000),
      checkInDeadline: new Date(Date.now() + 30 * 60 * 1000),
      status: 'CONFIRMED',
      qrTokenHash: hashQrToken('pks_token_fresh'),
    },
  });

  // Attempt EXIT scan on CONFIRMED booking before entry
  const resWrongGate = await fetch(`${origin}/api/staff/gate/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `parksmart_session=${staffTokenA}` },
    body: JSON.stringify({ input: 'BK-FRESH-10', gateType: 'EXIT' }),
  });
  const jsonWrongGate = await resWrongGate.json();

  const freshAfterWrongGate = await db.booking.findUnique({ where: { id: bkFresh.id } });

  if (
    !jsonWrongGate.success &&
    jsonWrongGate.reason === 'Vehicle has not entered' &&
    freshAfterWrongGate?.status === 'CONFIRMED'
  ) {
    console.log('✔ PASS: Exit scan rejected on pre-entry booking; status remains CONFIRMED.');
    passed++;
  } else {
    console.error('❌ FAIL: Wrong-gate scan was not rejected:', jsonWrongGate);
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 11: Concurrent scans cannot cause duplicate state transitions
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 11: Concurrent scans cannot cause duplicate state transitions ---');
  // Fire 5 concurrent confirm entry requests simultaneously
  const concurrentPromises = [1, 2, 3, 4, 5].map(() =>
    fetch(`${origin}/api/staff/gate/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `parksmart_session=${staffTokenA}` },
      body: JSON.stringify({ bookingId: bkFresh.id, gateType: 'ENTRY' }),
    }).then((r) => r.json())
  );

  const concurrentResults = await Promise.all(concurrentPromises);
  const successCount = concurrentResults.filter((r) => r.success).length;
  const failureCount = concurrentResults.filter((r) => !r.success).length;

  const finalFreshBooking = await db.booking.findUnique({ where: { id: bkFresh.id } });

  if (successCount === 1 && failureCount === 4 && finalFreshBooking?.scanCount === 1) {
    console.log('✔ PASS: Out of 5 concurrent entry requests, exactly 1 succeeded and 4 were rejected. No race condition.');
    passed++;
  } else {
    console.error('❌ FAIL: Concurrency issue detected:', { successCount, failureCount, scanCount: finalFreshBooking?.scanCount });
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 12: Unauthorized staff cannot process another parking area's booking
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- TEST 12: Unauthorized staff cannot process another parking area's booking ---");
  const unauthRes = await fetch(`${origin}/api/staff/gate/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `parksmart_session=${staffTokenB}` },
    body: JSON.stringify({ bookingId: bkFresh.id, gateType: 'EXIT' }),
  });
  const unauthJson = await unauthRes.json();

  if (unauthRes.status === 404 && unauthJson.reason === 'BOOKING_NOT_FOUND') {
    console.log("✔ PASS: Staff B prevented from confirming Area A's booking (scoped query rejected).");
    passed++;
  } else {
    console.error('❌ FAIL: Scoped multi-tenant check failed:', unauthJson);
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 13: EV charging resources are updated consistently
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 13: EV charging resources are updated consistently ---');
  const slotEv = await db.parkingSlot.create({
    data: { parkingAreaId: areaA.id, zoneId: zoneA.id, slotNumber: 'A-EV', vehicleType: 'EV', status: 'FREE' },
  });

  const bkEvId = 'bk_ev_test_13';
  const bkEvCode = 'BK-EV-TEST';
  const { token: evToken, hash: evHash } = generateBookingQrToken(bkEvId, bkEvCode);

  const bkEv = await db.booking.create({
    data: {
      id: bkEvId,
      bookingCode: bkEvCode,
      parkingAreaId: areaA.id,
      slotId: slotEv.id,
      vehiclePlate: 'DL 99 EV',
      estimatedArrival: new Date(Date.now() + 10 * 60 * 1000),
      checkInDeadline: new Date(Date.now() + 30 * 60 * 1000),
      status: 'CONFIRMED',
      evChargingRequested: true,
      evChargingPointId: evPointA.id,
      qrTokenHash: evHash,
    },
  });

  // Confirm Entry -> EV point should become IN_USE
  const resEvEntry = await fetch(`${origin}/api/staff/gate/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `parksmart_session=${staffTokenA}` },
    body: JSON.stringify({ bookingId: bkEv.id, gateType: 'ENTRY' }),
  });
  const jsonEvEntry = await resEvEntry.json();
  const evAfterEntry = await db.evChargingPoint.findUnique({ where: { id: evPointA.id } });

  // Confirm Exit -> EV point should become AVAILABLE
  const resEvExit = await fetch(`${origin}/api/staff/gate/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `parksmart_session=${staffTokenA}` },
    body: JSON.stringify({ bookingId: bkEv.id, gateType: 'EXIT' }),
  });
  const jsonEvExit = await resEvExit.json();
  const evAfterExit = await db.evChargingPoint.findUnique({ where: { id: evPointA.id } });

  if (jsonEvEntry.success && jsonEvExit.success && evAfterEntry?.status === 'IN_USE' && evAfterExit?.status === 'AVAILABLE') {
    console.log('✔ PASS: EV charging resource updated to IN_USE at Entry and released to AVAILABLE at Exit.');
    passed++;
  } else {
    console.error('❌ FAIL: EV resource states:', { jsonEvEntry, jsonEvExit, evAfterEntry, evAfterExit });
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 14: Availability counts update without exceeding actual capacity
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 14: Availability counts update without exceeding capacity ---');
  const availBefore = await getParkingAvailability(areaA.id);
  
  // Occupy a slot manually and test availability count
  const slotTest = await db.parkingSlot.create({
    data: { parkingAreaId: areaA.id, zoneId: zoneA.id, slotNumber: 'A-99', vehicleType: '4W', status: 'FREE' },
  });
  const availWithNewSlot = await getParkingAvailability(areaA.id);

  await db.parkingSlot.update({ where: { id: slotTest.id }, data: { status: 'OCCUPIED' } });
  const availOccupied = await getParkingAvailability(areaA.id);

  await db.parkingSlot.update({ where: { id: slotTest.id }, data: { status: 'FREE' } });
  const availFreed = await getParkingAvailability(areaA.id);

  // Clean up test slot
  await db.parkingSlot.delete({ where: { id: slotTest.id } });

  if (
    availWithNewSlot.available === availBefore.available + 1 &&
    availOccupied.available === availWithNewSlot.available - 1 &&
    availFreed.available === availWithNewSlot.available &&
    availOccupied.occupied === availBefore.occupied + 1
  ) {
    console.log('✔ PASS: Centralized availability correctly tracks slot states and never exceeds real slot count.');
    passed++;
  } else {
    console.error('❌ FAIL: Availability calculation mismatch:', { availBefore, availWithNewSlot, availOccupied, availFreed });
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 15: The QR flow works after refreshing the page and logging in again
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 15: QR flow works after refreshing page and re-logging in ---');
  const slotReload = await db.parkingSlot.create({
    data: { parkingAreaId: areaA.id, zoneId: zoneA.id, slotNumber: 'A-RELOAD', vehicleType: '4W', status: 'FREE' },
  });

  const bkReloadId = 'bk_reload_15';
  const bkReloadCode = 'BK-RELOAD-15';
  const { token: reloadToken, hash: reloadHash } = generateBookingQrToken(bkReloadId, bkReloadCode);

  const bkReload = await db.booking.create({
    data: {
      id: bkReloadId,
      bookingCode: bkReloadCode,
      parkingAreaId: areaA.id,
      slotId: slotReload.id,
      vehiclePlate: 'DL 15 RELOAD',
      estimatedArrival: new Date(Date.now() + 10 * 60 * 1000),
      checkInDeadline: new Date(Date.now() + 30 * 60 * 1000),
      status: 'CONFIRMED',
      qrTokenHash: reloadHash,
    },
  });

  // 1. Fetch public booking pass view (as user reloads /booking/BK-RELOAD-15)
  const userViewRes = await fetch(`${origin}/api/booking/BK-RELOAD-15`);
  const userViewJson = await userViewRes.json();

  // 2. Staff re-authenticates with fresh session token
  const freshStaffToken = await signToken({
    userId: 'staff_user_a_new_session',
    role: 'STAFF',
    parkingAreaId: areaA.id,
    name: 'Gate Attendant Alice Relogged',
  });

  // 3. Scan user's fresh QR payload
  const validateReloadRes = await fetch(`${origin}/api/staff/gate/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `parksmart_session=${freshStaffToken}` },
    body: JSON.stringify({ input: userViewJson.data.qrPayload, gateType: 'ENTRY' }),
  });
  const validateReloadJson = await validateReloadRes.json();

  if (
    userViewJson.success &&
    userViewJson.data.qrPayload &&
    validateReloadJson.success &&
    validateReloadJson.approved
  ) {
    console.log('✔ PASS: End-to-end QR pass generation, client page reload, fresh staff login, and gate entry validated.');
    passed++;
  } else {
    console.error('❌ FAIL: Reload flow failed:', { userViewJson, validateReloadJson });
  }

  // ── Clean up test fixtures ──
  await db.gateScanLog.deleteMany({ where: { parkingAreaId: { in: [areaA.id, areaB.id] } } });
  await db.booking.deleteMany({ where: { parkingAreaId: { in: [areaA.id, areaB.id] } } });
  await db.parkingSlot.deleteMany({ where: { parkingAreaId: { in: [areaA.id, areaB.id] } } });
  await db.evChargingPoint.deleteMany({ where: { parkingAreaId: { in: [areaA.id, areaB.id] } } });
  await db.zone.deleteMany({ where: { parkingAreaId: { in: [areaA.id, areaB.id] } } });
  await db.level.deleteMany({ where: { parkingAreaId: { in: [areaA.id, areaB.id] } } });
  await db.parkingArea.deleteMany({ where: { id: { in: [areaA.id, areaB.id] } } });

  console.log('\n====================================================');
  console.log(`TEST RUN FINISHED: ${passed}/${total} SCENARIOS PASSED`);
  console.log('====================================================\n');

  if (passed === total) {
    console.log('ALL 15 SCENARIOS VERIFIED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error(`ONLY ${passed}/${total} SCENARIOS PASSED.`);
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
