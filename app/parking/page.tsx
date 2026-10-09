import React from 'react';
import Link from 'next/link';
import { ParkingDiscovery } from '@/components/parking-discovery';
import { db } from '@/lib/db';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Find Parking — ParkSmart',
  description: 'Search available parking areas near you. Check live availability, rates and book your space.',
};

export default async function ParkingDirectoryPage() {
  // Fetch initial set of published areas server-side for fast first paint
  const areas = await db.parkingArea.findMany({
    where: { isPublished: true },
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
    },
    orderBy: { name: 'asc' },
    take: 30,
  });

  return (
    <div className="min-h-screen bg-[#0B0E13] text-[#F4F4F5]">
      {/* Minimal nav */}
      <header className="border-b border-[#292E38] bg-[#0B0E13]/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="w-3 h-3 bg-[#F05A28] inline-block" />
            <span className="font-extrabold text-base tracking-tighter uppercase font-mono-tech text-[#F4F4F5]">
              PARKSMART<span className="text-[#F05A28]">.SYS</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-1.5 font-mono-tech text-xs text-[#A1A1AA] hover:text-white transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> HOME
            </Link>
            <Link href="/login" className="font-mono-tech text-xs text-[#A1A1AA] hover:text-white transition-colors border border-[#292E38] px-3 py-1.5">
              LOGIN
            </Link>
            <Link href="/register" className="font-mono-tech text-xs bg-[#F05A28] hover:bg-[#DC4C1C] text-white px-3 py-1.5 font-bold transition-colors">
              ADD YOUR AREA
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div>
          <span className="font-mono-tech text-xs text-[#F05A28] font-bold uppercase tracking-widest block mb-2">
            PARKING DIRECTORY
          </span>
          <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white">
            Find a Space. Skip the Queue.
          </h1>
          <p className="text-sm text-[#A1A1AA] mt-2">
            {areas.length > 0
              ? `${areas.length} published parking area${areas.length !== 1 ? 's' : ''} — check availability and plan your arrival.`
              : 'No published parking areas yet. Are you an operator?'}
          </p>
        </div>

        <ParkingDiscovery initialAreas={areas} />
      </main>

      <footer className="border-t border-[#292E38] py-6 text-center font-mono-tech text-[10px] text-[#71717A]">
        PARKSMART.SYS — URBAN MOBILITY INTELLIGENCE
      </footer>
    </div>
  );
}
