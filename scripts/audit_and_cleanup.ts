import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  const allSlots = await db.parkingSlot.findMany();
  const seen = new Map<string, string>();
  const duplicates: any[] = [];
  
  for (const s of allSlots) {
    const key = `${s.parkingAreaId}:${s.slotNumber}`;
    if (seen.has(key)) {
      duplicates.push({ slot: s, originalId: seen.get(key) });
    } else {
      seen.set(key, s.id);
    }
  }

  console.log(`Audited ${allSlots.length} slots. Found ${duplicates.length} duplicate (parkingAreaId, slotNumber) pairs.`);
  if (duplicates.length > 0) {
    console.log('Duplicates:', JSON.stringify(duplicates, null, 2));
  }

  const bookings = await db.booking.findMany({
    select: { id: true, bookingCode: true, status: true, slotId: true, parkingAreaId: true }
  });
  console.log(`Total bookings: ${bookings.length}`);
}

main().catch(console.error).finally(() => db.$disconnect());
