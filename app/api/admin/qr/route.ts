import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { db } from '@/lib/db';
import QRCode from 'qrcode';

// GET /api/admin/qr  - generate QR data URLs for slot pillars + entry/exit gates
export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get('scope') ?? 'all'; // 'all' | 'gates' | 'slots'
  const zoneId = searchParams.get('zoneId');

  const origin =
    req.headers.get('origin') ||
    req.headers.get('x-forwarded-host') ||
    'http://localhost:3000';

  const parkingArea = await db.parkingArea.findUnique({
    where: { id: session.parkingAreaId },
    select: { id: true, name: true, code: true },
  });
  if (!parkingArea) return NextResponse.json({ success: false, message: 'Area not found' }, { status: 404 });

  const qrOptions: QRCode.QRCodeToDataURLOptions = {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 256,
    color: { dark: '#000000', light: '#ffffff' },
  };

  const result: {
    gates: { label: string; url: string; qr: string }[];
    slots: { slotNumber: string; zoneId: string; url: string; qr: string }[];
  } = { gates: [], slots: [] };

  // Gate QRs
  if (scope === 'all' || scope === 'gates') {
    const gateItems = [
      { label: 'ENTRY GATE', path: `/enter?area=${parkingArea.code}` },
      { label: 'EXIT GATE', path: `/exit?area=${parkingArea.code}` },
    ];
    for (const g of gateItems) {
      const url = `${origin}${g.path}`;
      const qr = await QRCode.toDataURL(url, qrOptions);
      result.gates.push({ label: g.label, url, qr });
    }
  }

  // Slot QRs
  if (scope === 'all' || scope === 'slots') {
    const whereClause = {
      parkingAreaId: session.parkingAreaId,
      ...(zoneId ? { zoneId } : {}),
    };

    const slots = await db.parkingSlot.findMany({
      where: whereClause,
      orderBy: { slotNumber: 'asc' },
      take: 150, // safety cap — caller should scope by zoneId for large layouts
      include: { zone: { select: { name: true, levelId: true } } },
    });

    for (const slot of slots) {
      const url = `${origin}/s/${slot.id}?area=${parkingArea.code}`;
      const qr = await QRCode.toDataURL(url, qrOptions);
      result.slots.push({ slotNumber: slot.slotNumber, zoneId: slot.zoneId, url, qr });
    }
  }

  return NextResponse.json({ success: true, data: result, parkingArea });
}
