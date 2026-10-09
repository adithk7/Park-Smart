import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from '@/lib/auth';

/**
 * GET /api/staff/gate/history
 * Returns the recent gate scan audit logs for this parking facility.
 * Strictly scoped to session.parkingAreaId.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session || (session.role !== 'STAFF' && session.role !== 'ADMIN')) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const logs = await db.gateScanLog.findMany({
    where: { parkingAreaId: session.parkingAreaId },
    include: {
      booking: {
        select: {
          bookingCode: true,
          vehiclePlate: true,
          vehicleType: true,
          status: true,
          slot: { select: { slotNumber: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({ success: true, data: logs });
}
