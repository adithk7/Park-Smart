'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Search,
  MapPin,
  Car,
  Zap,
  ArrowRight,
  RefreshCw,
  Building2,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PublicParkingArea {
  id: string;
  name: string;
  code: string;
  city: string | null;
  address: string | null;
  venueType: string;
  tier: number;
  totalCapacity: number;
  availableSlots?: number;
  occupiedCount?: number;
  reservedSlots?: number;
  maintenanceSlots?: number;
  hourlyRate: number;
  hourlyRate2W?: number;
  hourlyRate4W?: number;
  evChargingAvailable?: boolean;
  evHourlyRate?: number;
  currency: string;
}

const VENUE_TYPE_LABELS: Record<string, string> = {
  TRANSIENT: 'Transient',
  RECURRING: 'Recurring',
  BOTH: 'Mixed Use',
};

const TIER_LABELS: Record<number, string> = {
  0: 'Manual Tally',
  1: 'Gate Counters',
  2: 'CCTV / ANPR',
  3: 'Slot Sensors',
};

function availabilityDisplay(area: PublicParkingArea): {
  label: string;
  color: string;
  estimated: boolean;
} {
  const avail = area.availableSlots !== undefined ? area.availableSlots : Math.max(0, area.totalCapacity - (area.occupiedCount ?? 0));
  const pct = area.totalCapacity > 0 ? avail / area.totalCapacity : 0;

  // Tier 0 = manual tally only; flag as estimated
  const estimated = area.tier === 0;

  if (area.totalCapacity === 0) {
    return { label: 'Availability not reported', color: 'text-[#71717A]', estimated: true };
  }
  if (pct >= 0.4) return { label: `${avail} spaces free`, color: 'text-[#9EB08C]', estimated };
  if (pct >= 0.1) return { label: `${avail} spaces (limited)`, color: 'text-yellow-500', estimated };
  return { label: `${avail} spaces free (nearly full)`, color: 'text-[#F05A28]', estimated };
}

function ParkingCard({ area }: { area: PublicParkingArea }) {
  const avail = availabilityDisplay(area);
  return (
    <div
      className="group border border-[#292E38] bg-[#121720] hover:border-[#F05A28]/50 hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between"
      style={{ willChange: 'transform' }}
    >
      {/* Card Header */}
      <div className="p-5 flex-1 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm text-[#F4F4F5] leading-tight truncate">{area.name}</h3>
            {(area.city || area.address) && (
              <p className="text-[11px] text-[#A1A1AA] mt-0.5 flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 shrink-0" />
                {area.city && area.address
                  ? `${area.address}, ${area.city}`
                  : area.city || area.address}
              </p>
            )}
          </div>
          <span className="font-mono-tech text-[10px] bg-[#171D27] border border-[#292E38] px-1.5 py-0.5 text-[#A1A1AA] shrink-0">
            {TIER_LABELS[area.tier] ?? `TIER ${area.tier}`}
          </span>
        </div>

        {/* Availability */}
        <div className="flex items-center gap-2">
          <span className={`font-mono-tech text-xs font-bold ${avail.color}`}>
            ● {avail.label}
          </span>
          {avail.estimated && (
            <span className="font-mono-tech text-[9px] text-[#71717A] border border-[#292E38] px-1 py-0.5">
              EST
            </span>
          )}
        </div>

        {/* Rates & Amenities row */}
        <div className="flex flex-wrap gap-1.5 font-mono-tech text-[10px]">
          <span className="border border-[#292E38] px-1.5 py-0.5 text-[#A1A1AA]">
            {area.totalCapacity} BAYS
          </span>
          <span className="border border-[#292E38] px-1.5 py-0.5 text-[#9EB08C]">
            2W: ₹{area.hourlyRate2W || 15}/HR &bull; 4W: ₹{area.hourlyRate4W || area.hourlyRate || 30}/HR
          </span>
          {area.evChargingAvailable && (
            <span className="border border-amber-500/40 bg-amber-950/20 text-amber-300 px-1.5 py-0.5 flex items-center gap-1 font-bold">
              <Zap className="w-3 h-3 text-amber-400" /> EV Charging — ₹{area.evHourlyRate || 50}/hour
            </span>
          )}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="border-t border-[#292E38] px-5 py-3 flex items-center justify-between bg-[#171D27]/50">
        <span className="font-mono-tech text-[10px] text-[#71717A]">{area.code}</span>
        <Link
          href={`/area/${area.code}`}
          className="text-white bg-[#F05A28] hover:bg-[#d0461b] font-mono-tech text-[11px] font-extrabold px-3 py-1.5 flex items-center gap-1 transition-all shadow"
        >
          VIEW DETAILS <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

interface Props {
  initialAreas: PublicParkingArea[];
}

export function ParkingDiscovery({ initialAreas }: Props) {
  const [areas, setAreas] = useState<PublicParkingArea[]>(initialAreas);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      const res = await fetch(`/api/parking?${params}`);
      const json = await res.json();
      if (json.success) setAreas(json.data);
      else setError('Search failed. Please try again.');
    } catch {
      setError('Could not connect. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 350);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    search(query);
  };

  // Focus shortcut: / key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex gap-0">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A] pointer-events-none" />
            <input
              ref={inputRef}
              id="parking-search"
              type="text"
              value={query}
              onChange={handleChange}
              placeholder="Search by name, city or area code…"
              aria-label="Search parking areas"
              className="w-full bg-[#121720] border border-[#292E38] border-r-0 text-[#F4F4F5] pl-11 pr-4 py-4 text-sm font-mono-tech placeholder:text-[#71717A] focus:outline-none focus:border-[#F05A28] transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); search(''); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#F4F4F5] transition-colors text-sm font-mono-tech"
              >
                ×
              </button>
            )}
          </div>
          <button
            type="submit"
            id="find-parking-btn"
            className="bg-[#F05A28] hover:bg-[#DC4C1C] active:scale-[0.98] text-white font-bold font-mono-tech text-sm px-6 py-4 transition-colors shrink-0 flex items-center gap-2"
          >
            {loading
              ? <RefreshCw className="w-4 h-4 animate-spin" />
              : <><Search className="w-4 h-4" /> FIND PARKING</>}
          </button>
        </div>

        {/* Keyboard hint */}
        <div className="absolute right-[calc(6rem+1px)] top-1/2 -translate-y-1/2 pointer-events-none hidden md:flex items-center gap-1">
          <kbd className="bg-[#171D27] border border-[#292E38] text-[#71717A] text-[9px] font-mono-tech px-1.5 py-0.5">/</kbd>
        </div>
      </form>

      {/* Active Booking QR Pass Lookup Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-[#121720] border border-[#292E38] text-xs font-mono-tech shadow-md">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-[#F05A28] inline-block animate-pulse" />
          <span className="text-zinc-300 font-bold uppercase">ALREADY BOOKED?</span>
          <span className="text-zinc-400 text-[11px] hidden sm:inline">Access your live gate QR pass &amp; reservation details:</span>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <input
            type="text"
            id="user-pass-lookup"
            placeholder="REF CODE (e.g. BK-1001)"
            className="bg-[#171D27] border border-[#292E38] px-3 py-1.5 text-xs text-white uppercase font-bold placeholder-zinc-500 focus:outline-none focus:border-[#F05A28] w-full sm:w-48"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const val = (e.currentTarget.value || '').trim();
                if (val) window.location.href = `/booking/${val}`;
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('user-pass-lookup') as HTMLInputElement;
              if (el?.value?.trim()) window.location.href = `/booking/${el.value.trim()}`;
            }}
            className="bg-[#171D27] hover:bg-[#232936] text-[#F05A28] border border-[#F05A28]/50 px-3 py-1.5 text-xs font-bold uppercase shrink-0"
          >
            VIEW PASS &rarr;
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-[#F05A28] font-mono-tech text-xs border border-[#F05A28]/30 bg-[#F05A28]/10 px-3 py-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Results Grid */}
      {areas.length === 0 && !loading ? (
        <div className="border border-dashed border-[#292E38] text-center py-16 text-[#71717A]">
          <Building2 className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="font-mono-tech text-xs">
            {query
              ? `No published parking areas match "${query}"`
              : 'No published parking areas yet.'}
          </p>
          {!query && (
            <p className="font-mono-tech text-[11px] text-[#71717A] mt-2">
              Are you an operator?{' '}
              <Link href="/register" className="text-[#F05A28] hover:underline">
                Register your parking area →
              </Link>
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {areas.map((area) => (
            <ParkingCard key={area.id} area={area} />
          ))}
        </div>
      )}

      {areas.length > 0 && (
        <div className="flex items-center justify-between font-mono-tech text-xs text-[#71717A] border-t border-[#292E38] pt-4">
          <span>{areas.length} area{areas.length !== 1 ? 's' : ''} shown{query ? ` for "${query}"` : ''}</span>
          <Link href="/parking" className="text-[#F05A28] hover:underline flex items-center gap-1">
            VIEW ALL <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
