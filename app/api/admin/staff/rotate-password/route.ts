import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getServerSession, logAuditEvent } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'Unauthorized. Admin access required.' }, { status: 401 });
    }

    const body = await req.json();
    const { newPassword } = body;

    if (!newPassword || newPassword.length < 4) {
      return NextResponse.json(
        { success: false, message: 'New password must be at least 4 characters long' },
        { status: 400 }
      );
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await db.parkingArea.update({
      where: { id: session.parkingAreaId },
      data: { staffPasswordHash: newHash },
    });

    await logAuditEvent({
      parkingAreaId: session.parkingAreaId,
      actorId: session.userId,
      actorRole: 'ADMIN',
      action: 'STAFF_PASSWORD_ROTATED',
      meta: { rotatedBy: session.name },
    });

    return NextResponse.json({
      success: true,
      message: 'Facility staff password rotated successfully for all staff terminals.',
    });
  } catch (error: any) {
    console.error('Error rotating staff password:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
