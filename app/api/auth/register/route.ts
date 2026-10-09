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
        {
          success: false,
          message: 'Validation failed',
          errors: fieldErrors,
        },
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

    // 2. Check whether the email is already registered
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          message:
            'An account with this email already exists. Please log in instead.',
          errors: { email: 'Email address is already in use' },
        },
        { status: 409 }
      );
    }

    // 3. Hash passwords
    const passwordHash = await bcrypt.hash(password, 10);
    const staffPasswordHash = await bcrypt.hash(staffPassword, 10);

    // 4. Generate a unique parking area code
    let parkingCode = generateParkingCode(parkingAreaName, city);
    let codeExists = await db.parkingArea.findUnique({
      where: { code: parkingCode },
    });

    let attempts = 0;

    while (codeExists && attempts < 5) {
      parkingCode = generateParkingCode(parkingAreaName, city);

      codeExists = await db.parkingArea.findUnique({
        where: { code: parkingCode },
      });

      attempts++;
    }

    if (codeExists) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Could not generate a unique parking code. Please try again.',
        },
        { status: 500 }
      );
    }

    // 5. Create the facility and related records atomically.
    // Batch slot insertion reduces the number of database queries.
    const result = await db.$transaction(
      async (tx) => {
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
            isPublished: true,
          },
        });

        const adminUser = await tx.user.create({
          data: {
            parkingAreaId: parkingArea.id,
            name: name.trim(),
            email: normalizedEmail,
            passwordHash,
            role: 'ADMIN',
          },
        });

        // Create the default level and zone
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

        // Prepare two-wheeler, four-wheeler, and other slots
        const slotsToInsert: Array<{
          parkingAreaId: string;
          zoneId: string;
          slotNumber: string;
          vehicleType: string;
          status: string;
        }> = [];

        for (let i = 1; i <= twoWheelerCapacity; i++) {
          slotsToInsert.push({
            parkingAreaId: parkingArea.id,
            zoneId: zone.id,
            slotNumber: `B${String(i).padStart(3, '0')}`,
            vehicleType: '2W',
            status: 'FREE',
          });
        }

        for (let i = 1; i <= fourWheelerCapacity; i++) {
          slotsToInsert.push({
            parkingAreaId: parkingArea.id,
            zoneId: zone.id,
            slotNumber: `C${String(i).padStart(3, '0')}`,
            vehicleType: '4W',
            status: 'FREE',
          });
        }

        for (let i = 1; i <= otherCapacity; i++) {
          slotsToInsert.push({
            parkingAreaId: parkingArea.id,
            zoneId: zone.id,
            slotNumber: `O${String(i).padStart(3, '0')}`,
            vehicleType: 'OTHER',
            status: 'FREE',
          });
        }

        // Insert all slots in one batch
        if (slotsToInsert.length > 0) {
          await tx.parkingSlot.createMany({
            data: slotsToInsert,
          });
        }

        // Create EV charging points
        if (evChargingAvailable && evPointsCount > 0) {
          const evPoints = Array.from(
            { length: evPointsCount },
            (_, index) => ({
              parkingAreaId: parkingArea.id,
              code: `EV${String(index + 1).padStart(2, '0')}`,
              powerKw: 22.0,
              status: 'AVAILABLE',
            })
          );

          await tx.evChargingPoint.createMany({
            data: evPoints,
          });
        }

        // Initialize entry and exit barrier gates
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
      },
      {
        maxWait: 10000,
        timeout: 60000,
      }
    );

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
      {
        success: false,
        message: 'Server error during registration. Please try again.',
      },
      { status: 500 }
    );
  }
}