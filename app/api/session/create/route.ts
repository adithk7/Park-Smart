import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from '@/lib/auth';
import { normalisePlate, validatePlate, hashPlate, isDuplicateEntry } from '@/lib/plate';

/**
 * POST /api/session/create
 * Body: {
 *   parkingAreaCode: string   (used for driver self-entry; ignored for staff who use JWT)
 *   plateRaw: string
 *   vehicleType?: "2W"|"4W"
 *   isEV?: boolean
 *   preference?: "SELF"|"VALET"|"ACCESSIBLE"
 *   driverPhone?: string
 *   entryMethod?: "ANPR"|"MANUAL"|"QR"|"DRIVER_SELF"
 *   entryGateId?: string
 *   anprConfidence?: number   (< 0.7 = low confidence, requires manual confirm)
 * }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    parkingAreaCode,
    plateRaw,
    vehicleType = '4W',
    isEV = false,
    preference = 'SELF',
    driverPhone,
    entryMethod = 'MANUAL',
    entryGateId,
  } = body;

  // ── Determine parkingAreaId ───────────────────────────────────────
  let parkingAreaId: string;
  let entryStaffId: string | undefined;

  // Staff/Admin use their JWT
  const staffSession = await getServerSession();
  if (staffSession && (staffSession.role === 'STAFF' || staffSession.role === 'ADMIN')) {
    parkingAreaId = staffSession.parkingAreaId;
    entryStaffId = staffSession.userId;
  } else {
    // Driver self-entry: must supply parkingAreaCode
    if (!parkingAreaCode) {
      return NextResponse.json({ success: false, message: 'parkingAreaCode is required for driver entry' }, { status: 400 });
    }
    const area = await db.parkingArea.findUnique({
      where: { code: parkingAreaCode },
      select: { id: true, isPublished: true },
    });
    if (!area || !area.isPublished) {
      return NextResponse.json({ success: false, message: 'Parking area not found or not published' }, { status: 404 });
    }
    parkingAreaId = area.id;
  }

  // ── Validate plate ────────────────────────────────────────────────
  if (!plateRaw?.trim()) {
    return NextResponse.json({ success: false, message: 'Plate number is required' }, { status: 400 });
  }
  const { valid, reason } = validatePlate(plateRaw);
  if (!valid) {
    return NextResponse.json({ success: false, message: reason || 'Invalid plate format' }, { status: 422 });
  }

  // ── 60-second dedup guard ─────────────────────────────────────────
  const isDup = await isDuplicateEntry(parkingAreaId, plateRaw);
  if (isDup) {
    return NextResponse.json(
      { success: false, message: 'A session for this plate was opened within the last 60 seconds. Check for duplicate entry.' },
      { status: 409 }
    );
  }

  // ── Create session ────────────────────────────────────────────────
  const normalised = normalisePlate(plateRaw);
  const plateToken = hashPlate(plateRaw);

  // Check for active recurring profile
  const profile = await db.recurringProfile.findFirst({
    where: { parkingAreaId, plateToken, isActive: true },
  });

  const session = await db.visitSession.create({
    data: {
      parkingAreaId,
      plateRaw: normalised,
      plateToken,
      vehicleType: vehicleType === '2W' ? '2W' : '4W',
      isEV: Boolean(isEV),
      preference: ['SELF', 'VALET', 'ACCESSIBLE'].includes(preference) ? preference : 'SELF',
      visitModel: profile ? 'RECURRING' : 'TRANSIENT',
      status: 'OPEN',
      entryMethod,
      entryStaffId: entryStaffId ?? null,
      entryGateId: entryGateId ?? null,
      driverPhone: driverPhone ?? null,
      profileId: profile?.id ?? null,
    },
    select: {
      id: true,
      ticketCode: true,
      plateRaw: true,
      vehicleType: true,
      isEV: true,
      preference: true,
      status: true,
      entryMethod: true,
      entryAt: true,
      visitModel: true,
      parkingAreaId: true,
    },
  });

  // Log entry event
  await db.sessionEvent.create({
    data: {
      parkingAreaId,
      sessionId: session.id,
      eventType: 'ENTRY_CREATED',
      payload: JSON.stringify({
        method: entryMethod,
        plate: normalised,
        staffId: entryStaffId,
        gateId: entryGateId,
      }),
    },
  });

  return NextResponse.json({ success: true, data: session });
}
