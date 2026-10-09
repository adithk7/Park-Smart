'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { QRCodeImage } from '@/components/qr-code';
import {
  Clock,
  MapPin,
  QrCode,
  ShieldCheck,
  CreditCard,
  AlertTriangle,
  Zap,
  Car,
  Bike,
  CheckCircle2,
  Navigation,
  RefreshCw,
  PhoneCall
} from 'lucide-react';

interface TicketData {
  id: string;
  ticketCode: string;
  vehicleType: string;
  isEV: boolean;
  preference: string;
  status: string;
  visitModel: string;
  entryAt: string;
  parkedAt?: string;
  paidAt?: string;
  exitAt?: string;
  feeAmount?: number;
  paymentStatus?: string;
  slot?: {
    slotNumber: string;
    zone?: {
      name: string;
      level?: {
        name: string;
      };
    };
  };
  parkingArea: {
    name: string;
    code: string;
    address?: string;
    city?: string;
    hourlyRate: number;
    currency: string;
  };
  events: Array<{
    eventType: string;
    createdAt: string;
  }>;
}

export default function TicketPage({ params }: { params: Promise<{ ticketCode: string }> }) {
  const { ticketCode } = use(params);

  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live timer calculation
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  const fetchTicket = async () => {
    try {
      const res = await fetch(`/api/session/${ticketCode}`);
      const data = await res.json();
      if (data.success && data.data) {
        setTicket(data.data);
      } else {
        setError(data.message || 'Ticket not found');
      }
    } catch (err) {
      setError('Error loading ticket');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicket();
    const interval = setInterval(fetchTicket, 10000); // refresh status every 10s
    return () => clearInterval(interval);
  }, [ticketCode]);

  // Update timer every minute
  useEffect(() => {
    if (!ticket?.entryAt) return;
    const calcTimer = () => {
      const entry = new Date(ticket.entryAt).getTime();
      const exit = ticket.exitAt ? new Date(ticket.exitAt).getTime() : Date.now();
      const diffMins = Math.max(0, Math.floor((exit - entry) / 60000));
      setElapsedMinutes(diffMins);
    };
    calcTimer();
    const timerInterval = setInterval(calcTimer, 30000);
    return () => clearInterval(timerInterval);
  }, [ticket?.entryAt, ticket?.exitAt]);

  // Estimated Fee calculation
  const hours = Math.ceil(elapsedMinutes / 60) || 1;
  const estimatedFee = ticket ? hours * ticket.parkingArea.hourlyRate : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0E13] text-[#F4F4F5] flex items-center justify-center font-mono">
        <div className="flex items-center gap-2 text-xs">
          <RefreshCw className="w-4 h-4 animate-spin text-[#9EB08C]" /> LOADING DIGITAL TICKET...
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-[#0B0E13] text-[#F4F4F5] flex flex-col items-center justify-center p-6 text-center font-mono space-y-4">
        <AlertTriangle className="w-12 h-12 text-rose-500" />
        <h1 className="text-xl font-bold uppercase text-white">Ticket Not Found</h1>
        <p className="text-xs text-zinc-400 max-w-sm">{error || 'Invalid or expired ticket code.'}</p>
        <Link
          href="/"
          className="bg-[#171D27] border border-[#292E38] text-white px-4 py-2 text-xs font-bold uppercase hover:bg-[#232936]"
        >
          Return to Homepage &rarr;
        </Link>
      </div>
    );
  }

  const currentUrl = typeof window !== 'undefined' ? window.location.href : `/t/${ticketCode}`;

  return (
    <div className="min-h-screen bg-[#0B0E13] text-[#F4F4F5] flex flex-col justify-between p-4 md:p-8">
      {/* Header */}
      <header className="max-w-md w-full mx-auto flex items-center justify-between border-b border-[#292E38] pb-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 bg-[#9EB08C] inline-block" />
          <span className="font-extrabold text-base tracking-tighter uppercase font-mono-tech leading-none text-white">
            PARKSMART<span className="text-[#9EB08C]">.PASS</span>
          </span>
        </Link>
        <div className="flex items-center gap-2 font-mono-tech text-xs">
          <span
            className={`px-2.5 py-0.5 font-bold uppercase border ${
              ticket.status === 'OPEN' || ticket.status === 'PARKED'
                ? 'border-emerald-500/50 bg-emerald-950/30 text-emerald-300'
                : ticket.status === 'PAID'
                ? 'border-blue-500/50 bg-blue-950/30 text-blue-300'
                : 'border-zinc-700 bg-zinc-900 text-zinc-400'
            }`}
          >
            ● {ticket.status}
          </span>
        </div>
      </header>

      {/* Ticket Pass Card */}
      <main className="max-w-md w-full mx-auto my-6 space-y-5">
        {/* Main Pass Container */}
        <div className="border border-[#292E38] bg-[#121720] p-6 space-y-6 font-mono-tech shadow-2xl relative overflow-hidden">
          {/* Top Banner */}
          <div>
            <span className="text-[10px] text-[#9EB08C] uppercase tracking-wider block font-bold">
              {ticket.parkingArea.name} ({ticket.parkingArea.code})
            </span>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight mt-0.5">
              Live Digital Pass
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              {ticket.parkingArea.address || ticket.parkingArea.city || 'Smart Parking Facility'}
            </p>
          </div>

          {/* QR Code section */}
          <div className="bg-white p-4 rounded flex flex-col items-center justify-center space-y-2">
            <QRCodeImage value={currentUrl} size={190} />
            <span className="text-black font-extrabold text-xs tracking-widest uppercase">
              TICKET #{ticket.ticketCode}
            </span>
            <span className="text-[10px] text-zinc-500">Show this QR code at exit gate scanner</span>
          </div>

          {/* Live Duration & Rate Breakdown */}
          <div className="grid grid-cols-2 gap-3 bg-[#171D27] p-4 border border-[#292E38]">
            <div>
              <span className="text-[10px] text-zinc-400 uppercase block">PARKED DURATION</span>
              <span className="text-xl font-extrabold text-white flex items-center gap-1.5 mt-0.5">
                <Clock className="w-4 h-4 text-[#9EB08C]" />
                {Math.floor(elapsedMinutes / 60)}h {elapsedMinutes % 60}m
              </span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 uppercase block">ESTIMATED TARIFF</span>
              <span className="text-xl font-extrabold text-[#9EB08C] mt-0.5 block">
                ₹{estimatedFee}{' '}
                <span className="text-[10px] text-zinc-500 font-normal">
                  (₹{ticket.parkingArea.hourlyRate}/hr)
                </span>
              </span>
            </div>
          </div>

          {/* Vehicle & Slot Info */}
          <div className="space-y-2 text-xs border-t border-[#292E38] pt-4">
            <div className="flex justify-between py-1 border-b border-[#292E38]/50">
              <span className="text-zinc-400">VEHICLE TYPE:</span>
              <span className="font-bold text-white flex items-center gap-1">
                {ticket.vehicleType === '2W' ? <Bike className="w-3.5 h-3.5" /> : <Car className="w-3.5 h-3.5" />}
                {ticket.vehicleType} {ticket.isEV && <Zap className="w-3.5 h-3.5 text-amber-400" />}
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-[#292E38]/50">
              <span className="text-zinc-400">ENTRY TIME:</span>
              <span className="font-bold text-white">
                {new Date(ticket.entryAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-[#292E38]/50">
              <span className="text-zinc-400">ASSIGNED SLOT:</span>
              <span className="font-bold text-[#9EB08C]">
                {ticket.slot
                  ? `${ticket.slot.zone?.level?.name || ''} - ${ticket.slot.zone?.name || ''} - Bay ${ticket.slot.slotNumber}`
                  : 'SELF-PARK / PENDING'}
              </span>
            </div>

            <div className="flex justify-between py-1">
              <span className="text-zinc-400">SERVICE MODEL:</span>
              <span className="font-bold text-white">{ticket.visitModel} ({ticket.preference})</span>
            </div>
          </div>

          {/* Quick Driver Action Buttons */}
          <div className="space-y-2 pt-2 font-mono-tech">
            <Link
              href={`/s/${ticket.ticketCode}`}
              className="w-full bg-[#9EB08C] hover:bg-[#8ba078] text-black font-extrabold text-xs py-3 uppercase tracking-wider flex items-center justify-center gap-2 shadow"
            >
              <CreditCard className="w-4 h-4" /> PAY & EXIT ONLINE &rarr;
            </Link>

            <div className="grid grid-cols-2 gap-2">
              <Link
                href={`/s/${ticket.ticketCode}?action=report`}
                className="bg-[#171D27] hover:bg-[#232936] border border-[#292E38] text-zinc-300 font-bold text-xs py-2.5 px-2 flex items-center justify-center gap-1.5 uppercase text-center"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> REPORT BLOCKED CAR
              </Link>
              <button
                type="button"
                onClick={fetchTicket}
                className="bg-[#171D27] hover:bg-[#232936] border border-[#292E38] text-zinc-300 font-bold text-xs py-2.5 px-2 flex items-center justify-center gap-1.5 uppercase"
              >
                <RefreshCw className="w-3.5 h-3.5 text-zinc-400" /> REFRESH STATUS
              </button>
            </div>
          </div>
        </div>

        {/* Timeline Events */}
        {ticket.events && ticket.events.length > 0 && (
          <div className="border border-[#292E38] bg-[#121720] p-4 space-y-3 font-mono-tech">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Session Event History
            </h3>
            <div className="space-y-2 text-[11px]">
              {ticket.events.map((evt, idx) => (
                <div key={idx} className="flex justify-between items-center text-zinc-300 border-b border-[#292E38]/40 pb-1.5">
                  <span className="font-bold text-white">● {evt.eventType}</span>
                  <span className="text-zinc-500 font-mono">
                    {new Date(evt.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-md w-full mx-auto text-center py-4 text-[11px] font-mono-tech text-zinc-600 border-t border-[#292E38]">
        PARKSMART LIVE PASS &bull; GRACE WINDOW: 15 MIN AFTER PAYMENT
      </footer>
    </div>
  );
}
