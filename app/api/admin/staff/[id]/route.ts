import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, logAuditEvent } from '@/lib/auth';
import { db } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'Unauthorized. Admin access required.' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    // Verify staff belongs to admin's parking area
    const staff = await db.staff.findFirst({
      where: { id, parkingAreaId: session.parkingAreaId },
    });

    if (!staff) {
      return NextResponse.json({ success: false, message: 'Staff member not found' }, { status: 404 });
    }

    const updated = await db.staff.update({
      where: { id },
      data: {
        active: body.active !== undefined ? Boolean(body.active) : staff.active,
        name: body.name ? String(body.name).trim() : staff.name,
        phone: body.phone !== undefined ? body.phone : staff.phone,
        assignedZone: body.assignedZone !== undefined ? body.assignedZone : staff.assignedZone,
      },
    });

    await logAuditEvent({
      parkingAreaId: session.parkingAreaId,
      actorId: session.userId,
      actorRole: 'ADMIN',
      action: 'STAFF_STATUS_CHANGED',
      meta: { staffCode: updated.staffCode, active: updated.active },
    });

    return NextResponse.json({
      success: true,
      message: `Staff member ${updated.name} updated`,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error updating staff:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'Unauthorized. Admin access required.' }, { status: 401 });
    }

    const { id } = await params;

    // Verify staff belongs to admin's parking area
    const staff = await db.staff.findFirst({
      where: { id, parkingAreaId: session.parkingAreaId },
    });

    if (!staff) {
      return NextResponse.json({ success: false, message: 'Staff member not found' }, { status: 404 });
    }

    await db.staff.delete({ where: { id } });

    await logAuditEvent({
      parkingAreaId: session.parkingAreaId,
      actorId: session.userId,
      actorRole: 'ADMIN',
      action: 'STAFF_DELETED',
      meta: { staffCode: staff.staffCode, name: staff.name },
    });

    return NextResponse.json({
      success: true,
      message: `Staff member ${staff.name} (${staff.staffCode}) removed`,
    });
  } catch (error: any) {
    console.error('Error deleting staff:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
