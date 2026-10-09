import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, logAuditEvent } from '@/lib/auth';
import { db } from '@/lib/db';

// GET /api/admin/tariff  - fetch active tariff for this parking area
export async function GET() {
  const session = await getServerSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const tariff = await db.tariff.findFirst({
    where: { parkingAreaId: session.parkingAreaId, isActive: true },
    include: { slabs: { orderBy: { sortOrder: 'asc' } }, validationRules: true },
  });

  return NextResponse.json({ success: true, data: tariff });
}

// POST /api/admin/tariff  - upsert the active tariff
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const {
    name,
    freeMinutes,
    gracePeriodMin,
    dailyCap,
    reservationFee,
    slabs,        // TariffSlab[] without id/tariffId
    validationRules, // ValidationRule[] without id/tariffId
  } = body;

  // Deactivate old tariffs first
  await db.tariff.updateMany({
    where: { parkingAreaId: session.parkingAreaId },
    data: { isActive: false },
  });

  const tariff = await db.tariff.create({
    data: {
      parkingAreaId: session.parkingAreaId,
      name: name ?? 'Default Tariff',
      isActive: true,
      freeMinutes: freeMinutes ?? 15,
      gracePeriodMin: gracePeriodMin ?? 15,
      dailyCap: dailyCap ?? null,
      reservationFee: reservationFee ?? 0,
      slabs: {
        create: (slabs ?? []).map((s: any, idx: number) => ({
          vehicleType: s.vehicleType ?? '4W',
          upToHours: s.upToHours,
          ratePerHour: s.ratePerHour ?? 0,
          flatFee: s.flatFee ?? 0,
          sortOrder: idx,
        })),
      },
      validationRules: {
        create: (validationRules ?? []).map((r: any) => ({
          ruleType: r.ruleType,
          label: r.label,
          config: typeof r.config === 'string' ? r.config : JSON.stringify(r.config),
          isActive: r.isActive ?? true,
        })),
      },
    },
    include: { slabs: true, validationRules: true },
  });

  await logAuditEvent({
    parkingAreaId: session.parkingAreaId,
    actorId: session.userId,
    actorRole: 'ADMIN',
    action: 'TARIFF_UPDATED',
    meta: { tariffId: tariff.id, name: tariff.name },
  });

  return NextResponse.json({ success: true, data: tariff });
}
