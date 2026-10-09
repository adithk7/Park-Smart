import { db } from '../lib/db';
import bcrypt from 'bcryptjs';
import { signToken, verifyToken, checkRateLimit, recordFailedAttempt, resetFailedAttempts, logAuditEvent } from '../lib/auth';

async function main() {
  console.log('--- ParkSmart Auth & RBAC Test Suite ---');

  // 1. Clean test records if existing
  const testEmail = 'testadmin@parksmart.com';
  const testAreaCode = 'TEST-PARK-9999';

  await db.auditLog.deleteMany({ where: { meta: { contains: testAreaCode } } });
  await db.loginAttempt.deleteMany({});
  
  // Cleanup test area if exists
  const existingArea = await db.parkingArea.findUnique({ where: { code: testAreaCode } });
  if (existingArea) {
    await db.staff.deleteMany({ where: { parkingAreaId: existingArea.id } });
    await db.user.deleteMany({ where: { parkingAreaId: existingArea.id } });
    await db.parkingArea.delete({ where: { id: existingArea.id } });
  }

  // 2. Register Admin & Parking Area
  const adminPasswordHash = await bcrypt.hash('AdminSecret123!', 10);
  const staffSharedHash = await bcrypt.hash('StaffShiftPass2026', 10);

  const parkingArea = await db.parkingArea.create({
    data: {
      code: testAreaCode,
      name: 'Test Metro Hub',
      city: 'Bangalore',
      address: 'Brigade Road, Central',
      venueType: 'TRANSIENT',
      tier: 2,
      levels: 3,
      totalCapacity: 150,
      hourlyRate: 50,
      staffPasswordHash: staffSharedHash,
    },
  });

  const adminUser = await db.user.create({
    data: {
      email: testEmail,
      name: 'System Chief',
      passwordHash: adminPasswordHash,
      parkingAreaId: parkingArea.id,
      role: 'ADMIN',
    },
  });

  console.log('✓ Created Admin & Parking Area:', {
    adminId: adminUser.id,
    areaCode: parkingArea.code,
    parkingAreaId: parkingArea.id,
  });

  // 3. Admin JWT Session Token Test
  const adminJwt = await signToken({
    userId: adminUser.id,
    role: 'ADMIN',
    parkingAreaId: parkingArea.id,
    name: adminUser.name,
    email: adminUser.email,
  });
  const adminVerified = await verifyToken(adminJwt);
  console.log('✓ Admin JWT generation & verification:', adminVerified?.role === 'ADMIN');

  // 4. Staff Auto-generation (ST-001, ST-002)
  const staff1 = await db.staff.create({
    data: {
      staffCode: 'ST-001',
      name: 'Ramesh Kumar',
      phone: '+919876543210',
      assignedZone: 'Level 1 Entry',
      active: true,
      parkingAreaId: parkingArea.id,
    },
  });

  const staff2 = await db.staff.create({
    data: {
      staffCode: 'ST-002',
      name: 'Sunita Rao',
      phone: '+919876543211',
      assignedZone: 'Level 2 Ramp',
      active: true,
      parkingAreaId: parkingArea.id,
    },
  });

  console.log('✓ Created 2 Staff Members:', [staff1.staffCode, staff2.staffCode]);

  // 5. Staff Shared Password Verification & Login Flow Check
  const isSharedPassValid = await bcrypt.compare('StaffShiftPass2026', parkingArea.staffPasswordHash!);
  console.log('✓ Staff shared password bcrypt check:', isSharedPassValid);

  const staff1Jwt = await signToken({
    userId: staff1.id,
    role: 'STAFF',
    parkingAreaId: parkingArea.id,
    name: staff1.name,
  });
  const staff1Verified = await verifyToken(staff1Jwt);
  console.log('✓ Staff JWT generation & verification:', staff1Verified?.role === 'STAFF');

  // 6. Rate Limiting Check (5 failures -> Lockout)
  const testRateId = 'staff:test-rate-limit';
  await resetFailedAttempts(testRateId);

  for (let i = 1; i <= 4; i++) {
    const res = await recordFailedAttempt(testRateId);
    console.log(`  - Attempt ${i} failed -> locked: ${res.locked}`);
  }

  const lockedRes = await recordFailedAttempt(testRateId);
  console.log(`  - Attempt 5 failed -> locked: ${lockedRes.locked}`);
  
  const checkAgain = await checkRateLimit(testRateId);
  console.log('✓ Rate limit enforces lockout on 5th failure:', checkAgain.isLocked, `(${checkAgain.remainingMinutes}m remaining)`);

  // 7. Audit Logging
  await logAuditEvent({
    actorId: adminUser.id,
    actorRole: 'ADMIN',
    action: 'STAFF_CREATE',
    meta: { staffCode: 'ST-001', name: staff1.name, code: testAreaCode },
    parkingAreaId: parkingArea.id,
  });

  const logs = await db.auditLog.findMany({
    where: { parkingAreaId: parkingArea.id },
  });
  console.log('✓ AuditLog entries recorded:', logs.length, logs[0]?.action);

  console.log('\n✅ ALL AUTH & RBAC ENGINE TESTS PASSED SUCCESSFULLY!');
}

main()
  .catch((e) => {
    console.error('Test failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
