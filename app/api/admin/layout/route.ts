import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, logAuditEvent } from '@/lib/auth';
import { db } from '@/lib/db';

// GET /api/admin/layout  - fetch all levels, zones, slots for this parking area
export async function GET() {
  const session = await getServerSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const levels = await db.level.findMany({
    where: { parkingAreaId: session.parkingAreaId },
    orderBy: { displayOrder: 'asc' },
    include: {
      zones: {
        orderBy: { name: 'asc' },
        include: {
          slots: {
            orderBy: { slotNumber: 'asc' },
          },
        },
      },
    },
  });

  const summary = await db.parkingSlot.groupBy({
    by: ['status'],
    where: { parkingAreaId: session.parkingAreaId },
    _count: true,
  });

  return NextResponse.json({ success: true, data: { levels, summary } });
}

// POST /api/admin/layout  - create a level
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { action } = body;

  // ── Create Level ──────────────────────────────────────────────
  if (action === 'CREATE_LEVEL') {
    const { name, displayOrder } = body;
    if (!name?.trim()) {
      return NextResponse.json({ success: false, message: 'Level name is required' }, { status: 400 });
    }
    const existing = await db.level.findUnique({
      where: { parkingAreaId_name: { parkingAreaId: session.parkingAreaId, name: name.trim() } },
    });
    if (existing) {
      return NextResponse.json({ success: false, message: 'A level with this name already exists' }, { status: 409 });
    }
    const level = await db.level.create({
      data: {
        parkingAreaId: session.parkingAreaId,
        name: name.trim(),
        displayOrder: displayOrder ?? 0,
      },
    });
    await logAuditEvent({ parkingAreaId: session.parkingAreaId, actorId: session.userId, actorRole: 'ADMIN', action: 'LEVEL_CREATED', meta: { name } });
    return NextResponse.json({ success: true, data: level });
  }

  // ── Create Zone ───────────────────────────────────────────────
  if (action === 'CREATE_ZONE') {
    const { levelId, name, zoneType } = body;
    if (!levelId || !name?.trim()) {
      return NextResponse.json({ success: false, message: 'levelId and name are required' }, { status: 400 });
    }
    const level = await db.level.findFirst({ where: { id: levelId, parkingAreaId: session.parkingAreaId } });
    if (!level) return NextResponse.json({ success: false, message: 'Level not found' }, { status: 404 });

    const existing = await db.zone.findUnique({ where: { levelId_name: { levelId, name: name.trim() } } });
    if (existing) return NextResponse.json({ success: false, message: 'Zone already exists in this level' }, { status: 409 });

    const zone = await db.zone.create({
      data: {
        parkingAreaId: session.parkingAreaId,
        levelId,
        name: name.trim(),
        zoneType: zoneType ?? 'VISITOR_POOL',
      },
    });
    await logAuditEvent({ parkingAreaId: session.parkingAreaId, actorId: session.userId, actorRole: 'ADMIN', action: 'ZONE_CREATED', meta: { name, levelId } });
    return NextResponse.json({ success: true, data: zone });
  }

  // ── Bulk Generate Slots ───────────────────────────────────────
  if (action === 'BULK_GENERATE_SLOTS') {
    const { zoneId, levelName, zoneName, count, vehicleType } = body;
    if (!zoneId || !count || count < 1 || count > 200) {
      return NextResponse.json({ success: false, message: 'zoneId and count (1-200) are required' }, { status: 400 });
    }
    const zone = await db.zone.findFirst({ where: { id: zoneId, parkingAreaId: session.parkingAreaId } });
    if (!zone) return NextResponse.json({ success: false, message: 'Zone not found' }, { status: 404 });

    // Count existing slots in this zone to continue numbering
    const existingCount = await db.parkingSlot.count({ where: { zoneId } });

    // Build prefix: L{levelName}-{zoneName}  e.g. L1-A
    const lvlTag = (levelName || 'L').replace(/\s+/g, '').toUpperCase();
    const zoneTag = (zoneName || zone.name).replace(/\s+/g, '').toUpperCase();
    const prefix = `${lvlTag}-${zoneTag}`;

    const slotsData = Array.from({ length: count }, (_, i) => {
      const num = existingCount + i + 1;
      return {
        parkingAreaId: session.parkingAreaId,
        zoneId,
        slotNumber: `${prefix}-${String(num).padStart(2, '0')}`,
        vehicleType: vehicleType ?? '4W',
        status: 'FREE',
      };
    });

    // Pre-filter: fetch existing slot numbers to avoid unique constraint errors (SQLite doesn't support skipDuplicates)
    const existingSlots = await db.parkingSlot.findMany({
      where: { parkingAreaId: session.parkingAreaId },
      select: { slotNumber: true },
    });
    const existingNums = new Set(existingSlots.map((s) => s.slotNumber));
    const newSlots = slotsData.filter((s) => !existingNums.has(s.slotNumber));

    let createdCount = 0;
    if (newSlots.length > 0) {
      const result = await db.parkingSlot.createMany({ data: newSlots });
      createdCount = result.count;
    }

    // Update total capacity on ParkingArea
    await db.parkingArea.update({
      where: { id: session.parkingAreaId },
      data: { totalCapacity: { increment: createdCount } },
    });

    await logAuditEvent({ parkingAreaId: session.parkingAreaId, actorId: session.userId, actorRole: 'ADMIN', action: 'SLOTS_BULK_CREATED', meta: { zoneId, count: createdCount, prefix } });

    return NextResponse.json({ success: true, data: { created: createdCount, prefix } });
  }

  // ── Update Slot Status ────────────────────────────────────────
  if (action === 'UPDATE_SLOT') {
    const { slotId, status, vehicleType, ownerId, ownerLabel } = body;
    if (!slotId) return NextResponse.json({ success: false, message: 'slotId is required' }, { status: 400 });

    const slot = await db.parkingSlot.findFirst({ where: { id: slotId, parkingAreaId: session.parkingAreaId } });
    if (!slot) return NextResponse.json({ success: false, message: 'Slot not found' }, { status: 404 });

    const updated = await db.parkingSlot.update({
      where: { id: slotId },
      data: {
        ...(status && { status }),
        ...(vehicleType && { vehicleType }),
        ...(ownerId !== undefined && { ownerId }),
        ...(ownerLabel !== undefined && { ownerLabel }),
      },
    });
    return NextResponse.json({ success: true, data: updated });
  }

  return NextResponse.json({ success: false, message: 'Unknown action' }, { status: 400 });
}

// DELETE /api/admin/layout?type=level&id=xxx  or type=zone or type=slot
export async function DELETE(req: NextRequest) {
  const session = await getServerSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const id = searchParams.get('id');
  if (!type || !id) return NextResponse.json({ success: false, message: 'type and id are required' }, { status: 400 });

  if (type === 'level') {
    const level = await db.level.findFirst({ where: { id, parkingAreaId: session.parkingAreaId } });
    if (!level) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    await db.level.delete({ where: { id } });
    return NextResponse.json({ success: true });
  }
  if (type === 'zone') {
    const zone = await db.zone.findFirst({ where: { id, parkingAreaId: session.parkingAreaId } });
    if (!zone) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    await db.zone.delete({ where: { id } });
    return NextResponse.json({ success: true });
  }
  if (type === 'slot') {
    const slot = await db.parkingSlot.findFirst({ where: { id, parkingAreaId: session.parkingAreaId } });
    if (!slot) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    await db.parkingSlot.delete({ where: { id } });
    await db.parkingArea.update({ where: { id: session.parkingAreaId }, data: { totalCapacity: { decrement: 1 } } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, message: 'Invalid type' }, { status: 400 });
}
