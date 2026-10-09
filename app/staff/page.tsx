import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogoutButton } from '@/components/logout-button';
import { StaffControls } from '@/components/staff-controls';
import { QrGateScanner } from '@/components/qr-gate-scanner';
import { getParkingAvailability } from '@/lib/availability';
import { 
  Car, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  ArrowRight, 
  Activity, 
  QrCode, 
  AlertTriangle,
  Lock,
  Layers
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function StaffDashboardPage() {
  const session = await getServerSession();
  if (!session || (session.role !== 'STAFF' && session.role !== 'ADMIN')) {
    redirect('/login?redirect=/staff');
  }

  // Multi-tenant query scoped strictly to session.parkingAreaId
  const [parkingArea, activeSessions, availability] = await Promise.all([
    db.parkingArea.findUnique({
      where: { id: session.parkingAreaId },
      include: { barrierGates: true },
    }),
    db.visitSession.findMany({
      where: { parkingAreaId: session.parkingAreaId, status: { in: ['OPEN', 'PARKED'] } },
      take: 5,
      orderBy: { entryAt: 'desc' },
    }),
    getParkingAvailability(session.parkingAreaId),
  ]);

  if (!parkingArea) {
    redirect('/login');
  }

  const totalSlots = availability.total || parkingArea.totalCapacity;
  const occupiedSlots = availability.occupied;
  const availableSlots = availability.available;
  const occupancyPercent = totalSlots > 0 ? Math.min(100, Math.round((occupiedSlots / totalSlots) * 100)) : 0;

  return (
    <div className="min-h-screen bg-[#0B0E13] text-[#F4F4F5] flex flex-col justify-between p-4 md:p-8">
      
      {/* Top Attendant Header */}
      <header className="max-w-5xl w-full mx-auto flex flex-wrap items-center justify-between py-4 border-b border-[#292E38] gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 bg-[#9EB08C] inline-block" />
            <span className="font-extrabold text-lg tracking-tighter uppercase font-mono-tech leading-none text-[#F4F4F5]">
              PARKSMART<span className="text-[#9EB08C]">.OPS</span>
            </span>
          </Link>
          <span className="text-[#71717A] hidden sm:inline">|</span>
          <Badge variant="olive" size="sm">
            {session.role === 'ADMIN' ? 'ADMIN (OPS VIEW)' : 'GATE ATTENDANT'}
          </Badge>
        </div>

        <div className="flex items-center gap-3 font-mono-tech text-xs">
          <div className="text-right hidden sm:block">
            <span className="text-[#A1A1AA] block text-[11px]">LOGGED IN AS:</span>
            <span className="font-bold text-white">
              {session.name}
            </span>
          </div>
          <LogoutButton />
        </div>
      </header>

      {/* Main Terminal Screen */}
      <main className="max-w-5xl w-full mx-auto my-8 space-y-6">
        
        {/* Terminal Header Banner */}
        <div className="border border-[#292E38] bg-[#121720] p-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1 font-mono-tech text-xs">
                <span className="w-2 h-2 bg-[#9EB08C] animate-pulse inline-block" />
                <span className="text-[#9EB08C] font-bold">LIVE GATE TERMINAL &bull; {parkingArea.code}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
                {parkingArea.name}
              </h1>
              <p className="text-xs text-[#A1A1AA] mt-1 font-mono-tech">
                ZONE: ALL ZONES &bull; SITE TIER {parkingArea.tier} &bull; TARIFF ₹{parkingArea.hourlyRate}/HR
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href="/staff/qr-scan">
                <Button variant="primary" size="sm" className="bg-[#F05A28] hover:bg-[#DC4C1C] text-white">
                  <QrCode className="w-3.5 h-3.5 mr-1" /> QR GATE SCANNER &rarr;
                </Button>
              </Link>
              <Link href="/staff/entry">
                <Button variant="outline" size="sm">
                  ENTRY CONSOLE &rarr;
                </Button>
              </Link>
              {session.role === 'ADMIN' && (
                <Link href="/admin">
                  <Button variant="outline" size="sm">
                    ADMIN &rarr;
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Live Bay Occupancy & Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono-tech">
          
          <div className="border border-[#292E38] bg-[#171D27] p-5">
            <span className="text-xs text-[#A1A1AA] block mb-1 uppercase tracking-wider">Available Bays</span>
            <p className="text-4xl font-extrabold text-[#9EB08C]">
              {availableSlots} <span className="text-sm font-normal text-[#A1A1AA]">/ {parkingArea.totalCapacity}</span>
            </p>
            <div className="w-full bg-[#292E38] h-1.5 mt-3">
              <div 
                className="bg-[#9EB08C] h-1.5 transition-all duration-500" 
                style={{ width: `${100 - occupancyPercent}%` }}
              />
            </div>
          </div>

          <div className="border border-[#292E38] bg-[#171D27] p-5">
            <span className="text-xs text-[#A1A1AA] block mb-1 uppercase tracking-wider">Active Parked</span>
            <p className="text-4xl font-extrabold text-white">
              {occupiedSlots} <span className="text-sm font-normal text-[#A1A1AA]">VEHICLES</span>
            </p>
            <span className="text-[11px] text-[#A1A1AA] mt-2 block">
              Occupancy: {occupancyPercent}%
            </span>
          </div>

          <div className="border border-[#292E38] bg-[#171D27] p-5">
            <span className="text-xs text-[#A1A1AA] block mb-1 uppercase tracking-wider">Gate Barrier State</span>
            <p className="text-2xl font-bold text-white flex items-center gap-2 mt-1">
              <span className="w-3 h-3 bg-emerald-500 rounded-full inline-block" />
              ONLINE [AUTO]
            </p>
            <span className="text-[11px] text-[#A1A1AA] mt-2 block">
              ANPR Vision Engine active
            </span>
          </div>

        </div>

        {/* Quick Gate Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Quick Ticket Issue / Entry Relay */}
          <div className="border border-[#292E38] bg-[#121720] p-6 space-y-4">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-[#F05A28]" />
              <h2 className="text-lg font-bold uppercase text-white font-mono-tech">
                Express Gate Entry Terminal
              </h2>
            </div>
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              Launch webcam ANPR plate recognition scanner or manual ticket dispenser for gate attendant.
            </p>
            <div className="p-3 bg-[#171D27] border border-[#292E38] flex items-center justify-between text-xs font-mono-tech">
              <span className="text-[#A1A1AA]">TERMINAL GATE: ENTRY-01</span>
              <span className="text-[#9EB08C] font-bold">READY</span>
            </div>
            <Link href="/staff/entry" className="block">
              <Button variant="primary" size="md" className="w-full">
                LAUNCH GATE ENTRY CONSOLE &rarr;
              </Button>
            </Link>
          </div>

          {/* Attendant Shift Information */}
          <div className="border border-[#292E38] bg-[#121720] p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#9EB08C]" />
              <h2 className="text-lg font-bold uppercase text-white font-mono-tech">
                Shift & Security Status
              </h2>
            </div>
            <div className="space-y-2 text-xs font-mono-tech">
              <div className="flex justify-between py-1.5 border-b border-[#292E38]">
                <span className="text-[#A1A1AA]">FACILITY CODE:</span>
                <span className="font-bold text-white">{parkingArea.code}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#292E38]">
                <span className="text-[#A1A1AA]">ATTENDANT ID:</span>
                <span className="font-bold text-white">{session.role}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#292E38]">
                <span className="text-[#A1A1AA]">ASSIGNED ZONE:</span>
                <span className="font-bold text-[#F05A28]">ALL LEVELS</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[#A1A1AA]">AUDIT TRAIL:</span>
                <span className="font-bold text-[#9EB08C]">ALL ACTIONS LOGGED</span>
              </div>
            </div>
          </div>

        </div>

        {/* QR Gate Scanner Section */}
        <section id="qr-gate-scanner">
          <QrGateScanner facilityCode={parkingArea.code} facilityName={parkingArea.name} />
        </section>

        {/* Staff Operations Console: Slots & EV Controls */}
        <StaffControls parkingAreaId={session.parkingAreaId} />

        {/* Security Notice for Staff */}
        <div className="border border-[#292E38] bg-[#171D27] p-4 flex items-start gap-3 text-xs text-[#A1A1AA] font-mono-tech">
          <Lock className="w-4 h-4 text-[#F05A28] shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-white">ACCESS RESTRICTIONS ACTIVE: </span>
            Staff credentials have restricted scope to this parking area ({parkingArea.code}). Access to admin control portals and administrative configuration is strictly restricted and audited.
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="max-w-5xl w-full mx-auto text-center py-4 text-xs font-mono-tech text-[#71717A] border-t border-[#292E38]">
        PARKSMART OPS TERMINAL &bull; TENANT ID: {session.parkingAreaId}
      </footer>

    </div>
  );
}
