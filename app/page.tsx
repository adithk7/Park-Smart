import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ParkingMap } from '@/components/parking-map';
import { Reveal } from '@/components/ui/reveal';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { ParkingDiscovery } from '@/components/parking-discovery';
import {
  ArrowRight,
  ShieldCheck,
  PhoneForwarded,
  Layers,
  Cpu,
  Lock,
  Zap,
  SlidersHorizontal,
  ChevronRight,
  Radio,
  Clock,
  Search,
  MapPin,
  Building2,
} from 'lucide-react';
import { db } from '@/lib/db';
import { getParkingAvailability } from '@/lib/availability';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'ParkSmart — Smart Parking & Venue Operations',
  description: 'Find available parking spaces, check live occupancy, and skip the queue. ParkSmart connects drivers to parking operators with real-time intelligence.',
};

export default async function LandingPage() {
  // ── Server-side data fetches ───────────────────────────────────

  // 1. Fetch demo tenant for the hero map ticker (graceful fallback)
  let tenant = null;
  try {
    tenant = await db.parkingArea.findFirst({
      where: { code: 'mall-north-gate' },
    });
  } catch {
    // Graceful fallback — no crash if DB is empty
  }

  // 2. Fetch published areas for discovery section (public — no private fields)
  let publishedAreas: {
    id: string; name: string; code: string; city: string | null;
    address: string | null; venueType: string; tier: number;
    totalCapacity: number; occupiedCount?: number;
    hourlyRate: number; currency: string;
  }[] = [];
  let publishedCount = 0;
  let totalAvailable = 0;
  try {
    publishedAreas = await db.parkingArea.findMany({
      where: { isPublished: true },
      select: {
        id: true, name: true, code: true, city: true, address: true,
        venueType: true, tier: true, totalCapacity: true,
        hourlyRate: true, currency: true,
      },
      orderBy: { name: 'asc' },
      take: 6,
    });
    publishedCount = publishedAreas.length;
    totalAvailable = publishedAreas.reduce(
      (sum, a) => sum + a.totalCapacity,
      0
    );
  } catch {
    // Graceful fallback
  }

  // Ticker values for the live-telemetry bar derived from centralized availability helper
  let tenantAvailability = null;
  if (tenant) {
    try {
      tenantAvailability = await getParkingAvailability(tenant.id);
    } catch {}
  }
  const activeVenueName = tenant?.name || 'Phoenix Citadel - North Gate';
  const totalCapacity = tenantAvailability?.total || tenant?.totalCapacity || 50;
  const occupiedCount = tenantAvailability?.occupied ?? 12;
  const availableCount = tenantAvailability?.available ?? Math.max(0, totalCapacity - occupiedCount);
  const hourlyRate = tenant?.hourlyRate || 30;

  // Slot data for the hero map — static mock (real data flows from /admin/layout)
  const slotData: Array<{
    slotNumber: string; floor: string; zone: string;
    type: string; status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'EV';
  }> = [];

  return (
    <div className="min-h-screen bg-[#0B0E13] text-[#F4F4F5] flex flex-col justify-between selection:bg-[#F05A28] selection:text-white">

      {/* ── 1. NAVIGATION ── */}
      <header className="border-b border-[#292E38] bg-[#0B0E13]/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">

          {/* Wordmark */}
          <Link href="/" className="flex items-center gap-2.5 group" aria-label="ParkSmart home">
            <span className="w-3.5 h-3.5 bg-[#F05A28] inline-block transition-transform duration-200 group-hover:scale-110" />
            <div className="flex flex-col">
              <span className="font-extrabold text-xl tracking-tighter uppercase font-mono-tech leading-none text-[#F4F4F5]">
                PARKSMART<span className="text-[#F05A28]">.SYS</span>
              </span>
              <span className="text-[9px] font-mono-tech text-[#A1A1AA] tracking-widest uppercase">
                MOBILITY INTELLIGENCE
              </span>
            </div>
          </Link>

          {/* Nav links — scroll to sections or navigate */}
          <nav className="hidden lg:flex items-center gap-7 text-xs font-mono-tech uppercase font-bold text-[#A1A1AA]" aria-label="Main navigation">
            <a href="#features" className="hover:text-[#F4F4F5] transition-colors">Features</a>
            <a href="#relay" className="hover:text-[#F4F4F5] transition-colors">Blocked-Car Relay</a>
            <a href="#tiers" className="hover:text-[#F4F4F5] transition-colors">Site Tiers</a>
            <Link href="/admin" className="hover:text-[#F4F4F5] transition-colors">Ops Console</Link>
            <Link href="/login" className="hover:text-[#F4F4F5] transition-colors">Login</Link>
          </nav>

          {/* CTA Hub */}
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">LOGIN</Button>
            </Link>
            <Link href="/register">
              <Button variant="primary" size="md">
                ADD PARKING AREA <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>

        </div>
      </header>

      {/* ── 2. LIVE TELEMETRY TICKER (existing, unchanged) ── */}
      <div className="border-b border-[#292E38] bg-[#121720] text-[#F4F4F5] py-2 px-4 overflow-hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs font-mono-tech">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[#F05A28] inline-block animate-live-dot" />
              <span className="text-[#F05A28] font-bold">LIVE TELEMETRY</span>
            </div>
            <span className="text-[#71717A] hidden sm:inline">&bull;</span>
            <span className="hidden sm:inline">FACILITY: <strong className="text-white">{activeVenueName}</strong></span>
            <span className="text-[#71717A] hidden md:inline">&bull;</span>
            <span className="hidden md:inline">CAPACITY: <strong><AnimatedCounter target={totalCapacity} /> BAYS</strong></span>
            <span className="text-[#71717A] hidden md:inline">&bull;</span>
            <span className="hidden md:inline">OCCUPIED: <strong className="text-[#F05A28]"><AnimatedCounter target={occupiedCount} /> ({Math.round((occupiedCount / totalCapacity) * 100)}%)</strong></span>
            <span className="text-[#71717A] hidden lg:inline">&bull;</span>
            <span className="hidden lg:inline">AVAILABLE: <strong className="text-[#9EB08C]"><AnimatedCounter target={availableCount} /> SPACES</strong></span>
            <span className="text-[#71717A] hidden lg:inline">&bull;</span>
            <span className="hidden lg:inline">TARIFF: <strong>₹{hourlyRate}.00/HR</strong></span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[#A1A1AA]">
            <span className="bg-[#171D27] border border-[#292E38] px-2 py-0.5 text-[#9EB08C] font-bold">ANPR TIER 2</span>
            <span className="hidden sm:inline">14MS LATENCY</span>
          </div>
        </div>
      </div>

      {/* ── 3. DISCOVERY HERO — Parking Search First ── */}
      <section className="py-14 md:py-20 border-b border-[#292E38] relative overflow-hidden animate-hero-headline">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

            {/* Left: Discovery CTA */}
            <div className="lg:col-span-6 space-y-6">
              <div className="flex items-center gap-2 font-mono-tech text-xs text-[#A1A1AA] font-bold">
                <span className="border border-[#292E38] bg-[#121720] px-2 py-0.5 text-[#F4F4F5]">SPEC // 2026.10</span>
                <span>URBAN MOBILITY &amp; VENUE INFRASTRUCTURE</span>
              </div>

              <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-[#F4F4F5] tracking-tight leading-[0.95] uppercase font-sans">
                Find a space.<br />
                <span className="text-[#F05A28]">Skip the queue.</span>
              </h1>

              <p className="text-base sm:text-lg text-[#A1A1AA] max-w-xl leading-relaxed">
                Discover parking areas, check live availability and plan your arrival — no app needed.
              </p>

              {/* Inline search for driver */}
              <form
                action="/parking"
                method="get"
                className="flex gap-0 max-w-lg"
                id="hero-search-form"
              >
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A] pointer-events-none" />
                  <input
                    type="text"
                    name="q"
                    id="hero-search-input"
                    placeholder="City, area name or code…"
                    aria-label="Search parking areas"
                    className="w-full bg-[#121720] border border-[#292E38] border-r-0 text-[#F4F4F5] pl-10 pr-4 py-3.5 text-sm font-mono-tech placeholder:text-[#71717A] focus:outline-none focus:border-[#F05A28] transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  id="hero-find-parking-btn"
                  className="bg-[#F05A28] hover:bg-[#DC4C1C] active:scale-[0.98] text-white font-bold font-mono-tech text-sm px-6 py-3.5 transition-colors shrink-0 flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  <span className="hidden sm:inline">FIND PARKING</span>
                </button>
              </form>

              {/* Secondary CTA */}
              <div className="flex flex-wrap gap-3 pt-1">
                <Link href="/register">
                  <Button variant="secondary" size="md">
                    ADD YOUR PARKING AREA <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="ghost" size="md">OPERATOR LOGIN</Button>
                </Link>
              </div>

              {/* Availability summary chips */}
              <div className="flex flex-wrap gap-3 font-mono-tech text-xs pt-2 border-t border-[#292E38]">
                <div className="bg-[#121720] border border-[#292E38] px-3 py-2">
                  <span className="text-[#A1A1AA] block uppercase text-[10px]">Published Areas</span>
                  <span className="font-bold text-[#F4F4F5] text-lg">
                    {publishedCount > 0 ? publishedCount : '—'}
                  </span>
                </div>
                <div className="bg-[#121720] border border-[#292E38] px-3 py-2">
                  <span className="text-[#A1A1AA] block uppercase text-[10px]">Available Spaces</span>
                  <span className={`font-bold text-lg ${totalAvailable > 0 ? 'text-[#9EB08C]' : 'text-[#71717A]'}`}>
                    {publishedCount > 0 ? totalAvailable : '—'}
                  </span>
                </div>
                <div className="bg-[#121720] border border-[#292E38] px-3 py-2">
                  <span className="text-[#A1A1AA] block uppercase text-[10px]">No App Needed</span>
                  <span className="font-bold text-[#9EB08C] text-lg">QR</span>
                </div>
              </div>
              {publishedCount === 0 && (
                <p className="font-mono-tech text-[10px] text-[#71717A]">
                  Availability shown only for operators who have published their area.
                </p>
              )}
            </div>

            {/* Right: Interactive Parking Map (kept from original) */}
            <div id="matrix" className="lg:col-span-6 animate-hero-map">
              <ParkingMap initialSlots={slotData} venueName={activeVenueName} totalCapacity={totalCapacity} />
            </div>

          </div>
        </div>
      </section>

      {/* ── 4. PARKING DISCOVERY LISTINGS ── */}
      <section id="discover" className="py-14 md:py-20 border-b border-[#292E38] bg-[#0B0E13]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 pb-6 border-b border-[#292E38] gap-4">
              <div>
                <span className="font-mono-tech text-xs text-[#F05A28] font-bold tracking-widest block mb-1">
                  PARKING NEAR YOUR DESTINATION
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-[#F4F4F5]">
                  Explore Parking Areas
                </h2>
              </div>
              <div className="flex items-center gap-3 font-mono-tech text-xs">
                {publishedCount === 0 && (
                  <span className="text-[#71717A]">No published areas yet</span>
                )}
                <Link
                  href="/parking"
                  className="text-[#F05A28] hover:underline flex items-center gap-1 font-bold"
                  id="view-all-parking-link"
                >
                  VIEW ALL <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <ParkingDiscovery initialAreas={publishedAreas} />
          </Reveal>
        </div>
      </section>

      {/* ── 5. OPERATIONAL CAPABILITIES (existing, unchanged) ── */}
      <section id="features" className="py-16 md:py-24 border-b border-[#292E38] bg-[#0B0E13]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <Reveal>
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 pb-6 border-b border-[#292E38]">
              <div>
                <span className="font-mono-tech text-xs text-[#F05A28] font-bold tracking-widest block mb-1">
                  SYSTEM ARCHITECTURE &amp; MODULES
                </span>
                <h2 className="text-3xl sm:text-5xl font-extrabold uppercase tracking-tight text-[#F4F4F5]">
                  Operational Capabilities
                </h2>
              </div>
              <p className="text-sm text-[#A1A1AA] font-mono-tech max-w-md mt-4 md:mt-0">
                [PWA CLIENT + PRISMA CORE + FASTAPI VISION ENGINE + EXOTEL RELAY]
              </p>
            </div>
          </Reveal>

          <div className="space-y-16">

            {/* 01: Live Spatial Telemetry */}
            <Reveal delay={100}>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch border border-[#292E38] bg-[#121720]">
                <div className="lg:col-span-4 p-8 border-b lg:border-b-0 lg:border-r border-[#292E38] flex flex-col justify-between">
                  <div>
                    <span className="font-mono-tech text-4xl font-extrabold text-[#F05A28] block mb-2">01</span>
                    <h3 className="text-2xl font-bold uppercase tracking-tight text-[#F4F4F5] mb-3">
                      Live Spatial Telemetry
                    </h3>
                    <p className="text-sm text-[#A1A1AA] leading-relaxed">
                      Continuous real-time density tracking across multi-level decks. Drivers immediately see vacancy by zone and level before committing to drive aisles.
                    </p>
                  </div>
                  <div className="mt-8 pt-4 border-t border-[#292E38] font-mono-tech text-xs text-[#A1A1AA]">
                    <span>REF: SPEC_TELEMETRY_V2</span>
                  </div>
                </div>
                <div className="lg:col-span-8 p-6 sm:p-8 bg-[#171D27] flex flex-col justify-center">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono-tech text-xs">
                    <div className="p-4 border border-[#292E38] bg-[#121720]">
                      <div className="flex justify-between items-center text-[#A1A1AA] mb-1">
                        <span>LEVEL B1 (LOWER)</span>
                        <Badge variant="olive" size="sm">92% OCC</Badge>
                      </div>
                      <p className="text-2xl font-bold text-[#F4F4F5]">2 / 24 BAYS</p>
                      <p className="text-[10px] text-[#F05A28] mt-2">● HEAVY CONGESTION</p>
                    </div>
                    <div className="p-4 border border-[#292E38] bg-[#121720]">
                      <div className="flex justify-between items-center text-[#A1A1AA] mb-1">
                        <span>LEVEL 01 (GROUND)</span>
                        <Badge variant="signal" size="sm">45% OCC</Badge>
                      </div>
                      <p className="text-2xl font-bold text-[#F4F4F5]">14 / 26 BAYS</p>
                      <p className="text-[10px] text-[#9EB08C] mt-2">● FLUID CIRCULATION</p>
                    </div>
                    <div className="p-4 border border-[#292E38] bg-[#121720]">
                      <div className="flex justify-between items-center text-[#A1A1AA] mb-1">
                        <span>LEVEL 02 (ROOF)</span>
                        <Badge variant="neutral" size="sm">10% OCC</Badge>
                      </div>
                      <p className="text-2xl font-bold text-[#F4F4F5]">22 / 24 BAYS</p>
                      <p className="text-[10px] text-[#9EB08C] mt-2">● OPTIMAL FOR RECURRING</p>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* 02: Zero-App QR & ANPR Ingestion */}
            <Reveal delay={150}>
              <div id="workflow" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch border border-[#292E38] bg-[#121720]">
                <div className="lg:col-span-4 p-8 border-b lg:border-b-0 lg:border-r border-[#292E38] flex flex-col justify-between">
                  <div>
                    <span className="font-mono-tech text-4xl font-extrabold text-[#F05A28] block mb-2">02</span>
                    <h3 className="text-2xl font-bold uppercase tracking-tight text-[#F4F4F5] mb-3">
                      Zero-App QR &amp; ANPR Ingestion
                    </h3>
                    <p className="text-sm text-[#A1A1AA] leading-relaxed">
                      Contactless driver entry without native app installations. Optical camera trigger or dynamic kiosk QR instantly spawns an active PWA visit session.
                    </p>
                  </div>
                  <div className="mt-8 pt-4 border-t border-[#292E38] font-mono-tech text-xs text-[#A1A1AA]">
                    <span>REF: SPEC_INGESTION_PWA</span>
                  </div>
                </div>
                <div className="lg:col-span-8 p-6 sm:p-8 bg-[#171D27] flex flex-col justify-center font-mono-tech text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="border border-[#292E38] p-4 bg-[#121720]">
                      <span className="text-[#F05A28] font-bold block mb-1">STAGE 1 // APPROACH</span>
                      <p className="text-sm font-bold text-[#F4F4F5]">Camera / Gate Read</p>
                      <p className="text-[11px] text-[#A1A1AA] mt-2 font-sans">Webcam / CCTV ANPR detects license plate; tokenizes via HMAC-SHA256.</p>
                    </div>
                    <div className="border border-[#292E38] p-4 bg-[#121720]">
                      <span className="text-[#F05A28] font-bold block mb-1">STAGE 2 // SESSION</span>
                      <p className="text-sm font-bold text-[#F4F4F5]">PWA Token Created</p>
                      <p className="text-[11px] text-[#A1A1AA] mt-2 font-sans">Single VisitSession record generated; entry time and barrier gate logged.</p>
                    </div>
                    <div className="border border-[#292E38] p-4 bg-[#121720]">
                      <span className="text-[#F05A28] font-bold block mb-1">STAGE 3 // RELEASE</span>
                      <p className="text-sm font-bold text-[#F4F4F5]">Gate Lift Triggered</p>
                      <p className="text-[11px] text-[#A1A1AA] mt-2 font-sans">Barrier opens automatically; live parking timer dispatched to driver link.</p>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* 03: Blocked-Car Relay */}
            <Reveal delay={200}>
              <div id="relay" className="border border-[#292E38] bg-[#121720] p-6 sm:p-10 shadow-2xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-8 border-b border-[#292E38]">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono-tech text-xs bg-[#F05A28] text-white px-2 py-0.5 font-bold">MODULE 03</span>
                      <span className="font-mono-tech text-xs text-[#9EB08C] font-bold">PATENTED DRIVER INCIDENT RELAY</span>
                    </div>
                    <h3 className="text-3xl font-extrabold uppercase tracking-tight text-[#F4F4F5]">
                      Blocked-Car Relay // Incident Escalation
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 font-mono-tech text-xs">
                    <Badge variant="signal">EXOTEL PROXY ACTIVE</Badge>
                    <Badge variant="olive">ZERO PHONE LEAKAGE</Badge>
                  </div>
                </div>
                <p className="text-sm sm:text-base text-[#A1A1AA] max-w-3xl mb-8 leading-relaxed">
                  When a double-parked or blocking vehicle obstructs an aisle, drivers input the vehicle&apos;s license plate. ParkSmart initiates a masked phone relay or priority push alert without exposing private mobile numbers to either party.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono-tech text-xs">
                  {[
                    { n: '1', title: 'INCIDENT LOGGED', h: 'Plate Token Lookup', p: 'Blocked driver enters blocking plate. System hashes token and matches active session.' },
                    { n: '2', title: 'PROXY BRIDGED', h: 'Masked Exotel Call', p: 'Virtual proxy number dials vehicle owner with encrypted CLI. Zero phone exchange.' },
                    { n: '3', title: 'PUSH DISPATCH', h: 'Attendant Alert', p: 'If unacknowledged within 120s, ops console escalates to floor marshal with bay coordinates.' },
                    { n: '4', title: 'AUDIT CLEAR', h: 'Aisle Released', p: 'Owner moves vehicle; incident audit logged to VisitSession event timeline.' },
                  ].map((step, i) => (
                    <div key={i} className={`p-4 relative transition-colors hover:border-[#3E4552] ${i === 3 ? 'border border-[#F05A28] bg-[#171D27]' : 'border border-[#292E38] bg-[#171D27]'}`}>
                      <span className={`w-6 h-6 flex items-center justify-center font-bold mb-3 ${i === 3 ? 'bg-[#F05A28] text-white' : 'bg-[#0B0E13] border border-[#292E38] text-[#F4F4F5]'}`}>{step.n}</span>
                      <span className="text-[#F05A28] font-bold block mb-1">{step.title}</span>
                      <h4 className="font-bold text-sm text-[#F4F4F5] mb-2">{step.h}</h4>
                      <p className="text-[11px] text-[#A1A1AA] font-sans">{step.p}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* 04: Ops Console */}
            <Reveal delay={250}>
              <div id="console" className="border border-[#292E38] bg-[#121720] text-[#F4F4F5] p-6 sm:p-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-8 border-b border-[#292E38]">
                  <div>
                    <span className="font-mono-tech text-xs text-[#F05A28] font-bold tracking-widest block mb-1">
                      MODULE 04 // REAL PRODUCT COCKPIT
                    </span>
                    <h3 className="text-3xl font-extrabold uppercase tracking-tight text-white">
                      Operations Control Center
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="olive">ADMIN + STAFF ROLES</Badge>
                    <Badge variant="signal">REAL-TIME SSE STREAM</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-mono-tech text-xs">
                  <div className="lg:col-span-4 space-y-4">
                    {[
                      { label: 'BARRIER GATE 01 // ENTRY', status: 'CLOSED', statusColor: 'text-[#9EB08C] border-[#68715B] bg-[#68715B]/30', detail: 'ANPR CAMERA STREAM ACTIVE', sub: 'IP: 192.168.1.104 // PORT 8000' },
                      { label: 'BARRIER GATE 02 // EXIT', status: 'LOCKED', statusColor: 'text-[#F05A28] border-[#F05A28] bg-[#F05A28]/20', detail: 'FASTag READER READY', sub: 'AUTO DEBIT // EXIT TALLY ACTIVE' },
                    ].map((g, i) => (
                      <div key={i} className="border border-[#292E38] p-4 bg-[#171D27]">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[#A1A1AA]">{g.label}</span>
                          <span className={`border px-1.5 py-0.5 font-bold text-[10px] ${g.statusColor}`}>{g.status}</span>
                        </div>
                        <p className="text-base font-bold text-white">{g.detail}</p>
                        <p className="text-[10px] text-[#71717A] mt-1">{g.sub}</p>
                      </div>
                    ))}
                    <div className="border border-[#292E38] p-4 bg-[#171D27]">
                      <span className="text-[#A1A1AA] block mb-2">ATTENDANT OVERRIDE [SIMULATED]</span>
                      <div className="grid grid-cols-2 gap-2">
                        <button className="bg-[#F05A28] hover:bg-[#DC4C1C] text-white font-bold p-2 text-center transition-colors active:scale-[0.98]">PULSE GATE 01</button>
                        <button className="bg-[#292E38] hover:bg-[#3E4552] text-white font-bold p-2 text-center transition-colors active:scale-[0.98]">MANUAL TALLY +1</button>
                      </div>
                    </div>
                  </div>
                  <div className="lg:col-span-8 border border-[#292E38] p-4 bg-[#171D27] overflow-x-auto">
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#292E38]">
                      <span className="text-[#F05A28] font-bold">LIVE VISIT SESSIONS STREAM [SSE]</span>
                      <span className="text-[#71717A] text-[10px]">HMAC-SHA256 TOKENS</span>
                    </div>
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#292E38] text-[#A1A1AA]">
                          <th className="pb-2">SESSION ID</th>
                          <th className="pb-2">PLATE TOKEN (HMAC)</th>
                          <th className="pb-2">MODEL</th>
                          <th className="pb-2">DWELL</th>
                          <th className="pb-2 text-right">STATUS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#292E38]">
                        {[
                          { id: 'SES-8491', token: 'ad66ccf81e...2f49', model: 'TRANSIENT', dwell: '42m (₹30.00)', status: 'ACTIVE', sc: 'text-[#9EB08C]' },
                          { id: 'SES-8490', token: 'bc7144e901...18a2', model: 'RECURRING', dwell: 'Resident Bay A1', status: 'ACTIVE', sc: 'text-[#9EB08C]' },
                          { id: 'SES-8489', token: 'f391bb7042...8831', model: 'TRANSIENT', dwell: '1h 14m (₹60.00)', status: 'PAID (UPI)', sc: 'text-[#F05A28]' },
                          { id: 'SES-8488', token: '882a19ff41...0912', model: 'TRANSIENT', dwell: '2h 05m (₹90.00)', status: 'EXITED', sc: 'text-[#71717A]' },
                        ].map((r) => (
                          <tr key={r.id} className="hover:bg-[#121720] transition-colors">
                            <td className="py-2.5 text-[#F05A28]">{r.id}</td>
                            <td className="py-2.5 text-[#A1A1AA]">{r.token}</td>
                            <td className="py-2.5 text-white">{r.model}</td>
                            <td className="py-2.5 text-white">{r.dwell}</td>
                            <td className={`py-2.5 text-right font-bold ${r.sc}`}>{r.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </Reveal>

          </div>
        </div>
      </section>

      {/* ── 6. SITE TIERS (existing, unchanged) ── */}
      <section id="tiers" className="py-16 md:py-24 border-b border-[#292E38] bg-[#0B0E13]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="mb-12 pb-6 border-b border-[#292E38]">
              <span className="font-mono-tech text-xs text-[#F05A28] font-bold tracking-widest block mb-1">DEPLOYMENT FLEXIBILITY</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-[#F4F4F5]">
                Site Automation Tiers (0 to 3)
              </h2>
              <p className="text-sm text-[#A1A1AA] font-mono-tech mt-2">From manual attendant tallies to fully autonomous computer-vision boom gates.</p>
            </div>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { tier: '0', tag: 'MANUAL TALLY', title: 'Zero Sensors', desc: 'Staff attendant logs entries and exits via mobile buttons. Full cloud revenue accounting with zero hardware cost.', note: '✓ LOWEST OVERHEAD', highlight: false },
              { tier: '1', tag: 'BOOM GATES', title: 'Gate Counters', desc: 'Barrier loop sensors record gross occupancy in and out. QR kiosks dispense instantaneous entry links.', note: '✓ COMMERCIAL VENUES', highlight: false },
              { tier: '2', tag: 'RECOMMENDED', title: 'CCTV / ANPR', desc: 'Computer vision cameras read vehicle plates on approach, tokenizing tokens with zero friction or paper tickets.', note: '✓ AI VISION READY', highlight: true },
              { tier: '3', tag: 'IOT GRID', title: 'Slot Sensors', desc: 'Overhead optical/ultrasonic sensor grid per bay. Enables exact turn-by-turn find-my-car navigation.', note: '✓ PRECISION TELEMETRY', highlight: false },
            ].map(({ tier, tag, title, desc, note, highlight }) => (
              <Reveal key={tier} delay={parseInt(tier) * 50}>
                <div className={`p-6 flex flex-col justify-between h-full transition-colors ${highlight ? 'border-2 border-[#F05A28] bg-[#121720]' : 'border border-[#292E38] bg-[#121720] hover:border-[#3E4552]'}`}>
                  <div>
                    <div className="flex justify-between items-center pb-3 mb-4 border-b border-[#292E38] font-mono-tech text-xs font-bold">
                      <span className={highlight ? 'text-[#F05A28]' : 'text-[#F4F4F5]'}>TIER {tier}</span>
                      <span className={`px-1.5 py-0.5 ${highlight ? 'bg-[#F05A28] text-white' : 'bg-[#171D27] border border-[#292E38] text-[#A1A1AA]'}`}>{tag}</span>
                    </div>
                    <h3 className="text-lg font-bold text-[#F4F4F5] uppercase mb-2">{title}</h3>
                    <p className="text-xs text-[#A1A1AA] leading-relaxed mb-4">{desc}</p>
                  </div>
                  <div className={`pt-4 border-t border-[#292E38] font-mono-tech text-[11px] font-bold ${highlight ? 'text-[#F05A28]' : 'text-[#9EB08C]'}`}>{note}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. CTA BANNER (existing, unchanged) ── */}
      <section className="py-20 border-b border-[#292E38] bg-[#121720] text-[#F4F4F5]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <Reveal>
            <span className="font-mono-tech text-xs text-[#F05A28] font-bold uppercase tracking-widest block mb-3">
              DEPLOY IN UNDER 2 MINUTES
            </span>
            <h2 className="text-4xl sm:text-6xl font-black uppercase tracking-tight text-white leading-tight">
              Take Control of Your Parking Operations.
            </h2>
            <p className="text-[#A1A1AA] text-base sm:text-lg max-w-2xl mx-auto mt-4 mb-8 font-normal">
              Configure your venue, auto-generate your unique parking code, and give gate staff instant terminal access.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register" className="w-full sm:w-auto">
                <Button variant="primary" size="lg" className="w-full sm:w-auto text-base px-10 py-4">
                  REGISTER PARKING AREA <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="/login" className="w-full sm:w-auto">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto text-base px-8 py-4">
                  STAFF &amp; ADMIN LOGIN
                </Button>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 8. FOOTER (existing, unchanged) ── */}
      <footer className="py-12 bg-[#0B0E13] text-[#F4F4F5] font-mono-tech text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-[#292E38]">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-[#F05A28] inline-block" />
                <span className="font-bold text-sm tracking-tight text-white">PARKSMART.SYS</span>
              </div>
              <p className="text-[11px] text-[#A1A1AA]">Urban mobility intelligence, bay telemetry &amp; venue automation.</p>
            </div>
            <div>
              <span className="font-bold text-[#F4F4F5] block mb-2 uppercase">NAVIGATION</span>
              <ul className="space-y-1 text-[#A1A1AA]">
                <li><Link href="/" className="hover:text-[#F05A28] transition-colors">01/ HOME GRID</Link></li>
                <li><Link href="/parking" className="hover:text-[#F05A28] transition-colors">02/ FIND PARKING</Link></li>
                <li><Link href="/register" className="hover:text-[#F05A28] transition-colors">03/ REGISTER VENUE</Link></li>
                <li><Link href="/login" className="hover:text-[#F05A28] transition-colors">04/ LOGIN PORTAL</Link></li>
              </ul>
            </div>
            <div>
              <span className="font-bold text-[#F4F4F5] block mb-2 uppercase">CORE PROTOCOLS</span>
              <ul className="space-y-1 text-[#A1A1AA]">
                <li><span>HMAC-SHA256 TOKENIZER</span></li>
                <li><span>EXOTEL PROXY RELAY</span></li>
                <li><span>FASTAPI ANPR INGESTION</span></li>
              </ul>
            </div>
            <div>
              <span className="font-bold text-[#F4F4F5] block mb-2 uppercase">OPERATIONAL SPECS</span>
              <div className="p-3 bg-[#121720] border border-[#292E38] text-[11px] space-y-1">
                <p>BUILD: <strong className="text-white">2026.10-MVP</strong></p>
                <p>STATUS: <strong className="text-[#9EB08C]">ALL SYSTEMS NOMINAL</strong></p>
              </div>
            </div>
          </div>
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[#71717A] text-[11px]">
            <span>&copy; 2026 PARKSMART MOBILITY AUTHORITY. ALL RIGHTS RESERVED.</span>
            <span>SWISS EDITORIAL INFRASTRUCTURE ENGINE</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
