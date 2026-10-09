import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const db = new PrismaClient();

function hashPlate(plate: string): string {
  const secret = process.env.PLATE_HMAC_SECRET || 'parksmart-hmac-secret-change-in-prod';
  const normalized = plate.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return crypto.createHmac('sha256', secret).update(normalized).digest('hex');
}

async function main() {
  console.log('🌱 Seeding ParkSmart database...');

  // 1. Create Default Multi-tenant Parking Area (Tier 2 - ANPR Basic)
  const parkingArea = await db.parkingArea.upsert({
    where: { code: 'mall-north-gate' },
    update: {},
    create: {
      name: 'Phoenix Citadel - North Gate',
      code: 'mall-north-gate',
      tier: 2, // Tier 2 site (ANPR basic webcam + gate simulation)
      totalCapacity: 50,
      hourlyRate: 30.0,
      currency: 'INR',
      address: 'S.G. Highway, Sector 15, Tech Zone',
      contactPhone: '+919876543210',
    },
  });

  console.log(`✅ ParkingArea created: ${parkingArea.name} (ID: ${parkingArea.id})`);

  // 2. Create Admin & Staff Users
  await db.user.upsert({
    where: { email: 'admin@parksmart.io' },
    update: {},
    create: {
      parkingAreaId: parkingArea.id,
      email: 'admin@parksmart.io',
      name: 'Vikram Singh (Admin)',
      passwordHash: 'hashed_admin_pass', // Demo placeholder
      role: 'ADMIN',
    },
  });

  await db.user.upsert({
    where: { email: 'staff@parksmart.io' },
    update: {},
    create: {
      parkingAreaId: parkingArea.id,
      email: 'staff@parksmart.io',
      name: 'Ramesh Attendant (Staff)',
      passwordHash: 'hashed_staff_pass',
      role: 'STAFF',
    },
  });

  // 3. Seed Layout: Level → Zone → Slots
  // Create a demo level
  const level = await db.level.upsert({
    where: { parkingAreaId_name: { parkingAreaId: parkingArea.id, name: 'Ground Floor' } },
    update: {},
    create: {
      parkingAreaId: parkingArea.id,
      name: 'Ground Floor',
      displayOrder: 0,
    },
  });

  // Create two zones
  const zoneA = await db.zone.upsert({
    where: { levelId_name: { levelId: level.id, name: 'Zone A' } },
    update: {},
    create: {
      parkingAreaId: parkingArea.id,
      levelId: level.id,
      name: 'Zone A',
      zoneType: 'VISITOR_POOL',
    },
  });

  const zoneB = await db.zone.upsert({
    where: { levelId_name: { levelId: level.id, name: 'Zone B' } },
    update: {},
    create: {
      parkingAreaId: parkingArea.id,
      levelId: level.id,
      name: 'Zone B',
      zoneType: 'RESIDENT_ASSIGNED',
    },
  });

  // Seed ParkingSlots under the zones
  const slotsData = [
    { slotNumber: 'GF-A-01', zoneId: zoneA.id, vehicleType: '4W',        status: 'FREE' },
    { slotNumber: 'GF-A-02', zoneId: zoneA.id, vehicleType: '4W',        status: 'OCCUPIED' },
    { slotNumber: 'GF-A-03', zoneId: zoneA.id, vehicleType: 'EV',        status: 'FREE' },
    { slotNumber: 'GF-B-01', zoneId: zoneB.id, vehicleType: '4W',        status: 'RESERVED' },
    { slotNumber: 'GF-B-02', zoneId: zoneB.id, vehicleType: 'ACCESSIBLE', status: 'FREE' },
  ];

  for (const s of slotsData) {
    await db.parkingSlot.upsert({
      where: {
        parkingAreaId_slotNumber: {
          parkingAreaId: parkingArea.id,
          slotNumber: s.slotNumber,
        },
      },
      update: {},
      create: {
        parkingAreaId: parkingArea.id,
        ...s,
      },
    });
  }

  // 4. Seed Barrier Gates
  await db.barrierGate.createMany({
    data: [
      {
        parkingAreaId: parkingArea.id,
        name: 'Gate 1 - Entry ANPR Camera',
        type: 'ENTRY',
        status: 'CLOSED',
        anprCameraUrl: 'http://localhost:8000/anpr/stream',
      },
      {
        parkingAreaId: parkingArea.id,
        name: 'Gate 2 - Exit Barrier',
        type: 'EXIT',
        status: 'CLOSED',
      },
    ],
  });

  // 5. Seed a Recurring Profile (Resident/Employee)
  const residentPlate = 'KA01MH9999';
  await db.recurringProfile.create({
    data: {
      parkingAreaId: parkingArea.id,
      name: 'Ananya Sharma (Executive)',
      plateRaw: residentPlate,
      plateToken: hashPlate(residentPlate),
      phone: '+919988776655',
      type: 'RESIDENT',
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      isActive: true,
    },
  });

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
