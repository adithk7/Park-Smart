import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, logAuditEvent } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';

const createStaffSchema = z.object({
  name: z.string().min(2, 'Staff name must be at least 2 characters'),
  phone: z.string().optional().nullable(),
  assignedZone: z.string().optional().nullable(),
});

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'Unauthorized. Admin access required.' }, { status: 401 });
    }

    // Scoped strictly by the admin's parkingAreaId
    const [staffList, parkingArea, auditLogs] = await Promise.all([
      db.staff.findMany({
        where: { parkingAreaId: session.parkingAreaId },
        orderBy: { createdAt: 'desc' },
      }),
      db.parkingArea.findUnique({
        where: { id: session.parkingAreaId },
        select: { id: true, name: true, code: true, tier: true, city: true },
      }),
      db.auditLog.findMany({
        where: { parkingAreaId: session.parkingAreaId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        staff: staffList,
        parkingArea,
        auditLogs,
      },
    });
  } catch (error: any) {
    console.error('Error fetching staff list:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'Unauthorized. Admin access required.' }, { status: 401 });
    }

    const body = await req.json();
    const parseResult = createStaffSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: parseResult.error.issues[0]?.message || 'Validation error' },
        { status: 400 }
      );
    }

    const { name, phone, assignedZone } = parseResult.data;

    // Auto-generate next unique staff ID within this parking area (e.g. ST-001, ST-002)
    const existingStaff = await db.staff.findMany({
      where: { parkingAreaId: session.parkingAreaId },
      select: { staffCode: true },
    });

    let nextNumber = existingStaff.length + 1;
    let newStaffCode = `ST-${String(nextNumber).padStart(3, '0')}`;
    
    // Ensure uniqueness
    const usedCodes = new Set(existingStaff.map((s) => s.staffCode));
    while (usedCodes.has(newStaffCode)) {
      nextNumber++;
      newStaffCode = `ST-${String(nextNumber).padStart(3, '0')}`;
    }

    // Create staff member
    const newStaff = await db.staff.create({
      data: {
        parkingAreaId: session.parkingAreaId,
        staffCode: newStaffCode,
        name: name.trim(),
        phone: phone ? phone.trim() : null,
        assignedZone: assignedZone ? assignedZone.trim() : 'All Gates',
        active: true,
      },
    });

    // Write audit log
    await logAuditEvent({
      parkingAreaId: session.parkingAreaId,
      actorId: session.userId,
      actorRole: 'ADMIN',
      action: 'STAFF_CREATED',
      meta: { staffCode: newStaff.staffCode, name: newStaff.name, assignedZone: newStaff.assignedZone },
    });

    return NextResponse.json({
      success: true,
      message: `Staff member ${newStaff.name} created with ID ${newStaff.staffCode}`,
      data: newStaff,
    });
  } catch (error: any) {
    console.error('Error creating staff:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
