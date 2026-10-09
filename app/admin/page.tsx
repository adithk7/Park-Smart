import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogoutButton } from '@/components/logout-button';
import { PublishToggle } from '@/components/publish-toggle';
import { 
  Users, 
  Car, 
  ShieldCheck, 
  Settings, 
  ArrowRight, 
  Activity, 
  CreditCard,
  Building2,
  Lock,
  Layers,
  IndianRupee,
  QrCode,
  Grid3X3
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const session = await getServerSession();
  if (!session || session.role !== 'ADMIN') {
    redirect('/login?redirect=/admin');
  }

  // Scoped to the session's parkingAreaId
  const [parkingArea, staffCount, activeSessionsCount] = await Promise.all([
    db.parkingArea.findUnique({
      where: { id: session.parkingAreaId },
      include: { barrierGates: true },
    }),
    db.staff.count({
      where: { parkingAreaId: session.parkingAreaId, active: true },
    }),
    db.visitSession.count({
      where: { parkingAreaId: session.parkingAreaId, status: 'ACTIVE' },
    }),
  ]);

  if (!parkingArea) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-[#0B0E13] text-[#F4F4F5] flex flex-col justify-between p-4 md:p-8">
      
      {/* Top Navbar */}
      <header className="max-w-6xl w-full mx-auto flex flex-wrap items-center justify-between py-4 border-b border-[#292E38] gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 bg-[#F05A28] inline-block" />
            <span className="font-extrabold text-lg tracking-tighter uppercase font-mono-tech leading-none text-[#F4F4F5]">
              PARKSMART<span className="text-[#F05A28]">.SYS</span>
            </span>
          </Link>
          <span className="text-[#71717A] hidden sm:inline">|</span>
          <Badge variant="signal" size="sm">ADMIN COCKPIT</Badge>
        </div>

        <div className="flex items-center gap-3 font-mono-tech text-xs flex-wrap">
          <span className="text-[#A1A1AA] hidden md:inline">
            ADMIN: <strong className="text-white">{session.name}</strong>
          </span>
          <Link href="/admin/layout">
            <Button variant="secondary" size="sm">
              <Layers className="w-3.5 h-3.5 mr-1.5" /> LAYOUT
            </Button>
          </Link>
          <Link href="/admin/tariff">
            <Button variant="secondary" size="sm">
              <IndianRupee className="w-3.5 h-3.5 mr-1.5" /> TARIFF
            </Button>
          </Link>
          <Link href="/admin/qr">
            <Button variant="secondary" size="sm">
              <QrCode className="w-3.5 h-3.5 mr-1.5" /> QR SHEET
            </Button>
          </Link>
          <Link href="/admin/staff">
            <Button variant="secondary" size="sm">
              <Users className="w-3.5 h-3.5 mr-1.5" /> STAFF
            </Button>
          </Link>
          <LogoutButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl w-full mx-auto my-8 space-y-8">
        
        {/* Welcome Venue Banner */}
        <div className="border border-[#292E38] bg-[#121720] p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2 font-mono-tech text-xs">
                <span className="w-2 h-2 bg-[#F05A28] animate-live-dot inline-block" />
                <span className="text-[#F05A28] font-bold">OPERATIONAL SCOPE: {parkingArea.code}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase">
                {parkingArea.name}
              </h1>
              <p className="text-xs text-[#A1A1AA] mt-1 font-mono-tech">
                REGION: {parkingArea.city || 'DEFAULT'} &bull; SITE TIER: {parkingArea.tier} (ANPR VISION) &bull; VENUE MODEL: {parkingArea.venueType}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/admin/staff">
                <Button variant="primary" size="md">
                  <Users className="w-4 h-4 mr-2" /> MANAGE STAFF ROSTER <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Publish / Unpublish this parking area */}
        <PublishToggle isPublished={parkingArea.isPublished} areaName={parkingArea.name} />

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono-tech text-xs">
          
          <div className="border border-[#292E38] bg-[#171D27] p-5">
            <span className="text-[#A1A1AA] block mb-1">TOTAL CAPACITY</span>
            <p className="text-3xl font-extrabold text-white">{parkingArea.totalCapacity} <span className="text-sm font-normal text-[#A1A1AA]">BAYS</span></p>
            <span className="text-[11px] text-[#9EB08C] mt-2 block">✓ {parkingArea.levels} Deck Levels</span>
          </div>

          <div className="border border-[#292E38] bg-[#171D27] p-5">
            <span className="text-[#A1A1AA] block mb-1">ACTIVE VEHICLES</span>
            <p className="text-3xl font-extrabold text-[#F05A28]">{activeSessionsCount} <span className="text-sm font-normal text-[#A1A1AA]">ACTIVE</span></p>
            <span className="text-[11px] text-[#A1A1AA] mt-2 block">Live visit sessions</span>
          </div>

          <div className="border border-[#292E38] bg-[#171D27] p-5">
            <span className="text-[#A1A1AA] block mb-1">ACTIVE STAFF</span>
            <p className="text-3xl font-extrabold text-white">{staffCount} <span className="text-sm font-normal text-[#A1A1AA]">PERSONNEL</span></p>
            <Link href="/admin/staff" className="text-[11px] text-[#F05A28] hover:underline mt-2 inline-block">
              View roster &rarr;
            </Link>
          </div>

          <div className="border border-[#292E38] bg-[#171D27] p-5">
            <span className="text-[#A1A1AA] block mb-1">BASE TARIFF</span>
            <p className="text-3xl font-extrabold text-white">₹{parkingArea.hourlyRate}.00 <span className="text-sm font-normal text-[#A1A1AA]">/HR</span></p>
            <span className="text-[11px] text-[#9EB08C] mt-2 block">Dynamic UPI / FASTag</span>
          </div>

        </div>

        {/* Quick Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          <div className="border border-[#292E38] bg-[#121720] p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#F05A28]" />
              <h2 className="text-xl font-bold uppercase text-white">Staff Management Portal</h2>
            </div>
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              Add gate attendants, auto-generate unique staff codes (e.g. ST-001), rotate shared facility passwords, and copy ready-to-send onboarding credentials.
            </p>
            <Link href="/admin/staff">
              <Button variant="secondary" size="md" className="w-full">
                OPEN STAFF MANAGEMENT <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>

          <div className="border border-[#292E38] bg-[#121720] p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#9EB08C]" />
              <h2 className="text-xl font-bold uppercase text-white">Layout Builder</h2>
            </div>
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              Define levels, zones, and bulk-generate parking bays. Visualize occupancy with the color-coded slot grid.
            </p>
            <Link href="/admin/layout">
              <Button variant="secondary" size="md" className="w-full">
                OPEN LAYOUT BUILDER <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>

          <div className="border border-[#292E38] bg-[#121720] p-6 space-y-4">
            <div className="flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-[#F05A28]" />
              <h2 className="text-xl font-bold uppercase text-white">Tariff Engine</h2>
            </div>
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              Configure rate slabs (first 15 min free, ₹50/hr up to 3 hrs), grace window, daily cap, and validation rules.
            </p>
            <Link href="/admin/tariff">
              <Button variant="outline" size="md" className="w-full">
                OPEN TARIFF RULES <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>

          <div className="border border-[#292E38] bg-[#121720] p-6 space-y-4">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-blue-400]" />
              <h2 className="text-xl font-bold uppercase text-white">QR Sheet</h2>
            </div>
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              Generate printable PDF of slot pillar QRs, entry/exit gate QRs. Each QR is scoped to this parking area.
            </p>
            <Link href="/admin/qr">
              <Button variant="outline" size="md" className="w-full">
                GENERATE QR SHEET <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>

          <div className="border border-[#292E38] bg-[#121720] p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Car className="w-5 h-5 text-[#9EB08C]" />
              <h2 className="text-xl font-bold uppercase text-white">Staff Gate Terminal Preview</h2>
            </div>
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              Inspect how ground attendants view the gate terminal, manual tally counters, and real-time ANPR camera feeds.
            </p>
            <Link href="/staff">
              <Button variant="outline" size="md" className="w-full">
                VIEW GATE TERMINAL <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto text-center py-4 text-xs font-mono-tech text-[#71717A] border-t border-[#292E38]">
        PARKSMART // ADMIN CONTROL CONSOLE &bull; TENANT ID: {session.parkingAreaId}
      </footer>

    </div>
  );
}
