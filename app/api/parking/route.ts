import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/parking?q=search&city=Bangalore
// Public endpoint — returns published parking areas only.
// Never returns private fields like staffPasswordHash.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const city = searchParams.get('city')?.trim() ?? '';

  const areas = await db.parkingArea.findMany({
    where: {
      isPublished: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { city: { contains: q } },
              { address: { contains: q } },
              { code: { contains: q } },
            ],
          }
        : {}),
      ...(city ? { city: { contains: city } } : {}),
    },
    select: {
      id: true,
      name: true,
      code: true,
      city: true,
      address: true,
      venueType: true,
      tier: true,
      totalCapacity: true,
      occupiedCount: true,
      hourlyRate: true,
      currency: true,
      // NEVER expose: staffPasswordHash, user emails, private session data
    },
    orderBy: { name: 'asc' },
    take: 30,
  });

  return NextResponse.json({ success: true, data: areas });
}
