import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { QrGateScanner } from '@/components/qr-gate-scanner';
import { LogoutButton } from '@/components/logout-button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ShieldCheck, QrCode } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function StaffQrScanPage() {
  const session = await getServerSession();
  if (!session || (session.role !== 'STAFF' && session.role !== 'ADMIN')) {
    redirect('/login?redirect=/staff/qr-scan');
  }

  const parkingArea = await db.parkingArea.findUnique({
    where: { id: session.parkingAreaId },
    select: { id: true, name: true, code: true, tier: true },
  });

  if (!parkingArea) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-[#0B0E13] text-[#F4F4F5] flex flex-col justify-between p-4 md:p-8">
      {/* Attendant Header */}
      <header className="max-w-5xl w-full mx-auto flex flex-wrap items-center justify-between py-4 border-b border-[#292E38] gap-4">
        <div className="flex items-center gap-3">
          <Link href="/staff" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4 text-zinc-400 hover:text-white" />
            <span className="font-extrabold text-base tracking-tighter uppercase font-mono-tech leading-none text-[#F4F4F5]">
              PARKSMART<span className="text-[#F05A28]">.GATE</span>
            </span>
          </Link>
          <span className="text-[#71717A] hidden sm:inline">|</span>
          <Badge variant="olive" size="sm">
            {parkingArea.code}
          </Badge>
        </div>

        <div className="flex items-center gap-3 font-mono-tech text-xs">
          <div className="text-right hidden sm:block">
            <span className="text-[#A1A1AA] block text-[11px]">GATE ATTENDANT:</span>
            <span className="font-bold text-white">{session.name}</span>
          </div>
          <LogoutButton />
        </div>
      </header>

      {/* Main Scanner Section */}
      <main className="max-w-5xl w-full mx-auto my-8 space-y-6">
        <QrGateScanner facilityCode={parkingArea.code} facilityName={parkingArea.name} />
      </main>

      {/* Footer */}
      <footer className="max-w-5xl w-full mx-auto text-center py-4 text-xs font-mono-tech text-[#71717A] border-t border-[#292E38]">
        PARKSMART GATE SCANNER &bull; AUTHORIZED FACILITY ID: {session.parkingAreaId}
      </footer>
    </div>
  );
}
