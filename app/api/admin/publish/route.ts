import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, logAuditEvent } from '@/lib/auth';
import { db } from '@/lib/db';

// PATCH /api/admin/publish  — toggle isPublished for the admin's own parking area
export async function PATCH(req: NextRequest) {
  const session = await getServerSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { isPublished } = body;
  if (typeof isPublished !== 'boolean') {
    return NextResponse.json({ success: false, message: 'isPublished (boolean) is required' }, { status: 400 });
  }

  const area = await db.parkingArea.update({
    where: { id: session.parkingAreaId },
    data: { isPublished },
    select: { id: true, name: true, code: true, isPublished: true },
  });

  await logAuditEvent({
    parkingAreaId: session.parkingAreaId,
    actorId: session.userId,
    actorRole: 'ADMIN',
    action: isPublished ? 'AREA_PUBLISHED' : 'AREA_UNPUBLISHED',
    meta: { code: area.code },
  });

  return NextResponse.json({ success: true, data: area });
}
