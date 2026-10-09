import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/session/[ticketCode]
 * Public endpoint — returns safe subset of session data for driver ticket page.
 * Never returns plateRaw or private fields.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticketCode: string }> }
) {
  const { ticketCode } = await params;
  if (!ticketCode) {
    return NextResponse.json({ success: false, message: 'Missing ticketCode' }, { status: 400 });
  }

  const session = await db.visitSession.findUnique({
    where: { ticketCode },
    select: {
      id: true,
      ticketCode: true,
      vehicleType: true,
      isEV: true,
      preference: true,
      status: true,
      visitModel: true,
      entryAt: true,
      parkedAt: true,
      paidAt: true,
      exitAt: true,
      feeAmount: true,
      paymentStatus: true,
      slot: {
        select: { slotNumber: true, zone: { select: { name: true, level: { select: { name: true } } } } },
      },
      parkingArea: {
        select: { name: true, code: true, address: true, city: true, hourlyRate: true, currency: true },
      },
      events: {
        select: { eventType: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
        take: 20,
      },
    },
  });

  if (!session) {
    return NextResponse.json({ success: false, message: 'Ticket not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: session });
}
