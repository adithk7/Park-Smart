import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { getServerSession } from '@/lib/auth';
import { ensureDefaultSlots } from '@/lib/booking';

/**
 * PATCH /api/admin/staff-password
 * Sets or updates the common staff password for a parking area.
 * Admin-only.
 */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
  }

  const body = await req.json();
  const { staffPassword, confirmStaffPassword } = body;

  if (!staffPassword || typeof staffPassword !== 'string' || staffPassword.trim().length < 4) {
    return NextResponse.json(
      { success: false, message: 'Staff password must be at least 4 characters' },
      { status: 400 }
    );
  }

  if (staffPassword !== confirmStaffPassword) {
    return NextResponse.json(
      { success: false, message: 'Passwords do not match' },
      { status: 400 }
    );
  }

  const hash = await bcrypt.hash(staffPassword.trim(), 10);

  await db.parkingArea.update({
    where: { id: session.parkingAreaId },
    data: { staffPasswordHash: hash },
  });

  return NextResponse.json({
    success: true,
    message: 'Staff password updated successfully. Gate attendants can now log in with the new password.',
  });
}

/**
 * POST /api/admin/staff-password (reconcile slots)
 * Triggers slot reconciliation for the admin's parking area.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
  }

  try {
    await ensureDefaultSlots(session.parkingAreaId);

    const slotCount = await db.parkingSlot.count({ where: { parkingAreaId: session.parkingAreaId } });

    return NextResponse.json({
      success: true,
      message: `Slot reconciliation complete. ${slotCount} slots are now in the database.`,
      slotCount,
    });
  } catch (err) {
    console.error('Slot reconciliation error:', err);
    return NextResponse.json({ success: false, message: 'Reconciliation failed' }, { status: 500 });
  }
}
