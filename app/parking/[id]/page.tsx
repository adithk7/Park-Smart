import { redirect } from 'next/navigation';
import { db } from '@/lib/db';

export default async function ParkingIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) redirect('/parking');

  const area = await db.parkingArea.findFirst({
    where: {
      OR: [{ id }, { code: id }],
    },
    select: { code: true },
  });

  if (!area) redirect('/parking');
  redirect(`/area/${area.code}`);
}
