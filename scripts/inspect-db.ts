import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  const areas = await db.parkingArea.findMany({
    include: {
      slots: { select: { id: true, vehicleType: true, status: true, slotNumber: true } }
    }
  });

  for (const a of areas) {
    const counts: Record<string, number> = {};
    a.slots.forEach(s => {
      counts[s.vehicleType] = (counts[s.vehicleType] || 0) + 1;
    });
    console.log(JSON.stringify({
      id: a.id,
      name: a.name,
      code: a.code,
      totalCapacity: a.totalCapacity,
      twoWheelerCapacity: a.twoWheelerCapacity,
      fourWheelerCapacity: a.fourWheelerCapacity,
      slotCount: a.slots.length,
      staffPasswordHash: a.staffPasswordHash ? 'SET' : 'NOT_SET',
      vehicleTypeCounts: counts,
      sampleSlots: a.slots.slice(0, 8).map(s => `${s.slotNumber}(${s.vehicleType})`),
    }, null, 2));
  }
}

main().finally(() => db.$disconnect());
