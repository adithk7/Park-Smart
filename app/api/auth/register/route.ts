import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { registerAdminSchema } from '@/lib/validation/auth';
import { generateParkingCode } from '@/lib/code-generator';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Validate input with Zod
    const parseResult = registerAdminSchema.safeParse(body);
    if (!parseResult.success) {
      const fieldErrors: Record<string, string> = {};
      parseResult.error.issues.forEach((err) => {
        const field = err.path.join('.');
        fieldErrors[field] = err.message;
      });
      return NextResponse.json(
        { success: false, message: 'Validation failed', errors: fieldErrors },
        { status: 400 }
      );
    }

    const {
      name,
      email,
      password,
      parkingAreaName,
      city,
      address,
      venueType,
      siteTier,
      levels,
      totalSlots,
      twoWheelerCapacity,
      fourWheelerCapacity,
      otherCapacity,
      hourlyRate2W,
      hourlyRate4W,
      evChargingAvailable,
      evPointsCount,
      evHourlyRate,
      carWashAvailable,
      carWashRate,
      openingTime,
      closingTime,
      staffPassword,
    } = parseResult.data;

    // 2. Check if email is already registered
    const existingUser = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          message: 'An account with this email already exists. Please log in instead.',
          errors: { email: 'Email address is already in use' },
        },
        { status: 409 }
      );
    }

    // 3. Hash passwords with bcrypt
    const passwordHash = await bcrypt.hash(password, 10);
    const staffPasswordHash = await bcrypt.hash(staffPassword, 10);

    // 4. Generate unique Parking Area Code
    let parkingCode = generateParkingCode(parkingAreaName, city);
    let codeExists = await db.parkingArea.findUnique({ where: { code: parkingCode } });
    let attempts = 0;
    while (codeExists && attempts < 5) {
      parkingCode = generateParkingCode(parkingAreaName, city);
      codeExists = await db.parkingArea.findUnique({ where: { code: parkingCode } });
      attempts++;
    }

    // 5. Create ParkingArea, Admin User, Level, Zone, Slots, EV Points in ONE atomic transaction
    const result = await db.$transaction(async (tx) => {
      const parkingArea = await tx.parkingArea.create({
        data: {
          name: parkingAreaName.trim(),
          code: parkingCode,
          city: city.trim(),
          address: address.trim(),
          venueType,
          tier: siteTier,
          levels,
          totalCapacity: totalSlots,
          twoWheelerCapacity,
          fourWheelerCapacity,
          otherCapacity,
          hourlyRate2W,
          hourlyRate4W,
          hourlyRate: hourlyRate4W,
          currency: 'INR',
          carWashAvailable,
          carWashRate,
          evChargingAvailable,
          evHourlyRate,
          evRatePerKw: evHourlyRate,
          evPointsCount,
          openingTime,
          closingTime,
          staffPasswordHash,
          isPublished: true, // Make published immediately upon creation
        },
      });

      const adminUser = await tx.user.create({
        data: {
          parkingAreaId: parkingArea.id,
          name: name.trim(),
          email: email.toLowerCase().trim(),
          passwordHash,
          role: 'ADMIN',
        },
      });

      // Create Level 1 and Zone A for individual slot placement
      const level = await tx.level.create({
        data: {
          parkingAreaId: parkingArea.id,
          name: 'Level 1',
          displayOrder: 1,
        },
      });

      const zone = await tx.zone.create({
        data: {
          parkingAreaId: parkingArea.id,
          levelId: level.id,
          name: 'Zone A',
          zoneType: 'VISITOR_POOL',
        },
      });

      // Generate Two-Wheeler Slots: B001, B002... B060
      const slotsToInsert = [];
      for (let i = 1; i <= twoWheelerCapacity; i++) {
        const slotNumber = `B${String(i).padStart(3, '0')}`;
        slotsToInsert.push({
          parkingAreaId: parkingArea.id,
          zoneId: zone.id,
          slotNumber,
          vehicleType: '2W',
          status: 'FREE',
        });
      }

      // Generate Four-Wheeler Slots: C001, C002... C040
      for (let i = 1; i <= fourWheelerCapacity; i++) {
        const slotNumber = `C${String(i).padStart(3, '0')}`;
        slotsToInsert.push({
          parkingAreaId: parkingArea.id,
          zoneId: zone.id,
          slotNumber,
          vehicleType: '4W',
          status: 'FREE',
        });
      }

      // Generate Other Slots: O001, O002...
      for (let i = 1; i <= otherCapacity; i++) {
        const slotNumber = `O${String(i).padStart(3, '0')}`;
        slotsToInsert.push({
          parkingAreaId: parkingArea.id,
          zoneId: zone.id,
          slotNumber,
          vehicleType: 'OTHER',
          status: 'FREE',
        });
      }

      for (const slot of slotsToInsert) {
        await tx.parkingSlot.create({ data: slot });
      }

      // Generate EV Charging Points: EV01, EV02...
      if (evChargingAvailable && evPointsCount > 0) {
        for (let i = 1; i <= evPointsCount; i++) {
          const evCode = `EV${String(i).padStart(2, '0')}`;
          await tx.evChargingPoint.create({
            data: {
              parkingAreaId: parkingArea.id,
              code: evCode,
              powerKw: 22.0,
              status: 'AVAILABLE',
            },
          });
        }
      }

      // Initialize default entry & exit barrier gates
      await tx.barrierGate.createMany({
        data: [
          {
            parkingAreaId: parkingArea.id,
            name: 'Main Gate 1 (Entry)',
            type: 'ENTRY',
            status: 'CLOSED',
          },
          {
            parkingAreaId: parkingArea.id,
            name: 'Main Gate 2 (Exit)',
            type: 'EXIT',
            status: 'CLOSED',
          },
        ],
      });

      return { parkingArea, adminUser };
    });

    return NextResponse.json({
      success: true,
      message: 'Admin account and parking space created successfully!',
      data: {
        user: {
          id: result.adminUser.id,
          name: result.adminUser.name,
          email: result.adminUser.email,
          role: result.adminUser.role,
        },
        parkingArea: {
          id: result.parkingArea.id,
          name: result.parkingArea.name,
          code: result.parkingArea.code,
          city: result.parkingArea.city,
          tier: result.parkingArea.tier,
          venueType: result.parkingArea.venueType,
          totalCapacity: result.parkingArea.totalCapacity,
          twoWheelerCapacity: result.parkingArea.twoWheelerCapacity,
          fourWheelerCapacity: result.parkingArea.fourWheelerCapacity,
          levels: result.parkingArea.levels,
        },
      },
    });
  } catch (error: unknown) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, message: 'Server error during registration. Please try again.' },
      { status: 500 }
    );
  }
}
