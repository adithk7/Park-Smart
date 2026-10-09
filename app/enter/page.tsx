'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Car, Bike, Zap, ArrowRight, Shield, CheckCircle2, Clock } from 'lucide-react';

function DriverEntryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const codeParam = searchParams.get('code') || searchParams.get('area') || '';
  const [parkingAreaCode, setParkingAreaCode] = useState(codeParam);
  const [plateRaw, setPlateRaw] = useState('');
  const [vehicleType, setVehicleType] = useState<'2W' | '4W'>('4W');
  const [isEV, setIsEV] = useState(false);
  const [preference, setPreference] = useState<'SELF' | 'VALET' | 'ACCESSIBLE'>('SELF');
  const [driverPhone, setDriverPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (codeParam) {
      setParkingAreaCode(codeParam.toUpperCase());
    }
  }, [codeParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parkingAreaCode: parkingAreaCode.toUpperCase(),
          plateRaw,
          vehicleType,
          isEV,
          preference,
          driverPhone: driverPhone || undefined,
          entryMethod: 'DRIVER_SELF',
        }),
      });

      const data = await res.json();
      setLoading(false);

      if (!data.success) {
        setError(data.message || 'Self-entry failed');
        return;
      }

      // Redirect directly to the driver PWA ticket page
      router.push(`/t/${data.data.ticketCode}`);
    } catch (err: any) {
      setLoading(false);
      setError('Network error during entry check-in');
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E13] text-[#F4F4F5] flex flex-col justify-between p-4 md:p-8">
      {/* Header */}
      <header className="max-w-md w-full mx-auto flex items-center justify-between border-b border-[#292E38] pb-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 bg-[#9EB08C] inline-block" />
          <span className="font-extrabold text-lg tracking-tighter uppercase font-mono-tech leading-none text-white">
            PARKSMART<span className="text-[#9EB08C]">.DRIVER</span>
          </span>
        </Link>
        <span className="text-xs font-mono-tech text-zinc-400 bg-[#171D27] px-2.5 py-1 border border-[#292E38]">
          GATE SELF ENTRY
        </span>
      </header>

      {/* Main Card */}
      <main className="max-w-md w-full mx-auto my-8 space-y-6">
        <div className="border border-[#292E38] bg-[#121720] p-6 space-y-6 font-mono-tech shadow-2xl">
          <div>
            <div className="flex items-center gap-2 text-[#9EB08C] text-xs font-bold mb-1">
              <span className="w-2 h-2 bg-[#9EB08C] rounded-full animate-ping inline-block" />
              DIGITAL ENTRY CHECK-IN
            </div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">
              Get Parking Ticket
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Enter your plate number to open gate session & get your live digital pass.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Venue Code */}
            <div>
              <label className="text-xs text-zinc-400 block uppercase mb-1">
                Parking Area Code <span className="text-[#F05A28]">*</span>
              </label>
              <input
                type="text"
                required
                value={parkingAreaCode}
                onChange={(e) => setParkingAreaCode(e.target.value.toUpperCase())}
                placeholder="e.g. TVM-MALL-3158"
                className="w-full bg-[#171D27] border border-[#292E38] text-white font-bold p-3 uppercase text-sm focus:outline-none focus:border-[#9EB08C]"
              />
            </div>

            {/* License Plate */}
            <div>
              <label className="text-xs text-zinc-400 block uppercase mb-1">
                Vehicle Plate Number <span className="text-[#F05A28]">*</span>
              </label>
              <input
                type="text"
                required
                value={plateRaw}
                onChange={(e) => setPlateRaw(e.target.value.toUpperCase())}
                placeholder="e.g. KA01AB1234"
                className="w-full bg-[#171D27] border border-[#292E38] text-white text-lg font-black tracking-widest p-3 uppercase focus:outline-none focus:border-[#9EB08C]"
              />
            </div>

            {/* Vehicle Type */}
            <div>
              <label className="text-xs text-zinc-400 block uppercase mb-1">Vehicle Category</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVehicleType('4W')}
                  className={`p-3 border flex items-center justify-center gap-2 text-xs font-bold uppercase transition ${
                    vehicleType === '4W'
                      ? 'border-[#9EB08C] bg-[#9EB08C]/20 text-white'
                      : 'border-[#292E38] bg-[#171D27] text-zinc-400'
                  }`}
                >
                  <Car className="w-4 h-4" /> 4-Wheeler
                </button>
                <button
                  type="button"
                  onClick={() => setVehicleType('2W')}
                  className={`p-3 border flex items-center justify-center gap-2 text-xs font-bold uppercase transition ${
                    vehicleType === '2W'
                      ? 'border-[#9EB08C] bg-[#9EB08C]/20 text-white'
                      : 'border-[#292E38] bg-[#171D27] text-zinc-400'
                  }`}
                >
                  <Bike className="w-4 h-4" /> 2-Wheeler
                </button>
              </div>
            </div>

            {/* EV Checkbox */}
            <label className="flex items-center gap-3 p-3 bg-[#171D27] border border-[#292E38] cursor-pointer">
              <input
                type="checkbox"
                checked={isEV}
                onChange={(e) => setIsEV(e.target.checked)}
                className="w-4 h-4 accent-[#9EB08C]"
              />
              <span className="text-xs font-bold text-white flex items-center gap-1">
                <Zap className="w-4 h-4 text-amber-400" /> Electric Vehicle (EV)
              </span>
            </label>

            {/* Preference */}
            <div>
              <label className="text-xs text-zinc-400 block uppercase mb-1">Parking Preference</label>
              <select
                value={preference}
                onChange={(e) => setPreference(e.target.value as any)}
                className="w-full bg-[#171D27] border border-[#292E38] text-white text-xs p-3 focus:outline-none focus:border-[#9EB08C]"
              >
                <option value="SELF">SELF-PARK (STANDARD)</option>
                <option value="VALET">VALET SERVICE</option>
                <option value="ACCESSIBLE">ACCESSIBLE / HANDICAP</option>
              </select>
            </div>

            {/* Optional Phone */}
            <div>
              <label className="text-xs text-zinc-400 block uppercase mb-1">Mobile Number (Optional)</label>
              <input
                type="tel"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full bg-[#171D27] border border-[#292E38] text-white text-xs p-3 focus:outline-none focus:border-[#9EB08C]"
              />
            </div>

            {error && (
              <div className="p-3 border border-rose-500/40 bg-rose-950/20 text-rose-300 text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#9EB08C] hover:bg-[#8ba078] text-black font-extrabold text-sm py-3.5 uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              {loading ? (
                'GENERATING TICKET...'
              ) : (
                <>
                  GET TICKET & ENTER <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      <footer className="max-w-md w-full mx-auto text-center py-4 text-xs font-mono-tech text-zinc-600 border-t border-[#292E38]">
        PARKSMART DRIVER SELF-SERVICE &bull; NO APP DOWNLOAD REQUIRED
      </footer>
    </div>
  );
}

export default function DriverEntryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0B0E13] text-[#F4F4F5] p-8 text-center font-mono">Loading entry portal...</div>}>
      <DriverEntryContent />
    </Suspense>
  );
}
