'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { QRCodeImage } from '@/components/qr-code';
import {
  CheckCircle2,
  Clock,
  MapPin,
  QrCode,
  Zap,
  Sparkles,
  Car,
  AlertTriangle,
  RefreshCw,
  Printer,
  XCircle,
  ArrowLeft
} from 'lucide-react';

interface BookingDetailData {
  id: string;
  bookingCode: string;
  vehicleType: string;
  vehiclePlate: string;
  estimatedArrival: string;
  estimatedDuration: number;
  checkInDeadline: string;
  carWashRequested: boolean;
  carWashFee: number;
  evChargingRequested: boolean;
  evChargingFee: number;
  evChargingPointId?: string;
  parkingFee: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  qrPayload?: string;
  qrToken?: string;
  entryAt?: string;
  exitAt?: string;
  isWindowOpen: boolean;
  minutesUntilWindow: number;
  parkingArea: {
    name: string;
    code: string;
    address?: string;
    city?: string;
    hourlyRate: number;
    currency: string;
    contactPhone?: string;
  };
  slot?: {
    slotNumber: string;
    vehicleType: string;
    zone?: {
      name: string;
      level?: {
        name: string;
      };
    };
  };
  evChargingPoint?: {
    code: string;
    powerKw: number;
  };
}

export default function BookingConfirmationPage({ params }: { params: Promise<{ bookingCode: string }> }) {
  const { bookingCode } = use(params);

  const [booking, setBooking] = useState<BookingDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);

  // Expiration countdown
  const [minutesRemaining, setMinutesRemaining] = useState<number>(0);

  const fetchBooking = async () => {
    try {
      const res = await fetch(`/api/booking/${bookingCode}`);
      const json = await res.json();
      if (json.success && json.data) {
        setBooking(json.data);
      } else {
        setError(json.message || 'Booking not found');
      }
    } catch (err) {
      setError('Error loading booking');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooking();
    const interval = setInterval(fetchBooking, 10000);
    return () => clearInterval(interval);
  }, [bookingCode]);

  useEffect(() => {
    if (!booking?.checkInDeadline) return;
    const calc = () => {
      const deadline = new Date(booking.checkInDeadline).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((deadline - now) / 60000));
      setMinutesRemaining(diff);
    };
    calc();
    const timer = setInterval(calc, 20000);
    return () => clearInterval(timer);
  }, [booking?.checkInDeadline]);

  const handleCancelBooking = async () => {
    if (!confirm('Are you sure you want to cancel this booking reservation?')) return;
    setCancelling(true);
    setCancelMessage(null);

    try {
      const res = await fetch('/api/booking/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingCode }),
      });
      const json = await res.json();
      setCancelling(false);

      if (json.success) {
        setCancelMessage('Reservation cancelled. Slot and EV charging resources released.');
        fetchBooking();
      } else {
        setCancelMessage(json.message || 'Failed to cancel');
      }
    } catch (err) {
      setCancelling(false);
      setCancelMessage('Network error cancelling booking');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0E13] text-[#F4F4F5] flex items-center justify-center font-mono text-xs">
        <RefreshCw className="w-4 h-4 animate-spin text-[#F05A28] mr-2" /> LOADING BOOKING CONFIRMATION...
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-[#0B0E13] text-[#F4F4F5] flex flex-col items-center justify-center p-6 text-center font-mono space-y-4">
        <AlertTriangle className="w-12 h-12 text-[#F05A28]" />
        <h1 className="text-xl font-bold uppercase text-white">Booking Not Found</h1>
        <p className="text-xs text-zinc-400">{error || 'Invalid booking reference code.'}</p>
        <Link href="/parking" className="bg-[#171D27] border border-[#292E38] text-white px-4 py-2 text-xs font-bold uppercase hover:bg-[#232936]">
          &larr; Back to Parking Directory
        </Link>
      </div>
    );
  }

  const currentUrl = typeof window !== 'undefined' ? window.location.href : `/booking/${bookingCode}`;

  return (
    <div className="min-h-screen bg-[#0B0E13] text-[#F4F4F5] flex flex-col justify-between p-4 md:p-8">
      {/* Header */}
      <header className="max-w-md w-full mx-auto flex items-center justify-between border-b border-[#292E38] pb-4 font-mono-tech">
        <Link href="/parking" className="flex items-center gap-2">
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
          <span className="font-extrabold text-base tracking-tighter uppercase leading-none text-white">
            PARKSMART<span className="text-[#F05A28]">.PASS</span>
          </span>
        </Link>
        <span
          className={`px-2.5 py-0.5 font-bold text-xs uppercase border ${
            booking.status === 'CONFIRMED'
              ? 'border-emerald-500/50 bg-emerald-950/30 text-emerald-300'
              : booking.status === 'CHECKED_IN'
              ? 'border-blue-500/50 bg-blue-950/30 text-blue-300'
              : booking.status === 'CANCELLED' || booking.status === 'EXPIRED'
              ? 'border-rose-500/50 bg-rose-950/30 text-rose-300'
              : 'border-amber-500/50 bg-amber-950/30 text-amber-300'
          }`}
        >
          ● {booking.status}
        </span>
      </header>

      {/* Booking Ticket Card */}
      <main className="max-w-md w-full mx-auto my-6 space-y-5">
        <div className="border border-[#292E38] bg-[#121720] p-6 space-y-6 font-mono-tech shadow-2xl relative overflow-hidden">
          {/* Header */}
          <div className="border-b border-[#292E38] pb-4">
            <span className="text-[10px] text-[#F05A28] uppercase tracking-wider block font-bold">
              {booking.parkingArea.name} ({booking.parkingArea.code})
            </span>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight mt-0.5">
              Booking Confirmed
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              REF: <span className="text-white font-bold">{booking.bookingCode}</span>
            </p>
          </div>

          {/* QR Code */}
          <div className="bg-white p-5 rounded-lg flex flex-col items-center justify-center space-y-2 text-center shadow-lg">
            <QRCodeImage value={booking.qrPayload || currentUrl} size={190} />
            <span className="text-black font-black text-sm tracking-widest uppercase font-mono-tech mt-1">
              {booking.bookingCode}
            </span>
            <span className="text-[11px] font-semibold text-zinc-600 max-w-[260px] leading-tight">
              Present this pass at Entry Gate &amp; Exit Gate scanners for automated verification.
            </span>
            {booking.status === 'CHECKED_IN' && booking.entryAt && (
              <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded uppercase font-mono-tech">
                ENTERED: {new Date(booking.entryAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {booking.status === 'COMPLETED' && booking.exitAt && (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded uppercase font-mono-tech">
                EXITED: {new Date(booking.exitAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {/* Slot Allocation Box */}
          <div className="bg-[#171D27] p-4 border border-[#292E38] flex items-center justify-between">
            <div>
              <span className="text-[10px] text-zinc-400 uppercase block">ALLOCATED SLOT NUMBER</span>
              <span className="text-2xl font-black text-[#9EB08C] mt-0.5 block">
                {booking.slot ? booking.slot.slotNumber : 'AUTO-ALLOCATING'}
              </span>
              <span className="text-[10px] text-zinc-500">
                {booking.slot?.zone?.level?.name ? `${booking.slot.zone.level.name} - ${booking.slot.zone.name}` : 'Reserved Parking Bay'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-zinc-400 uppercase block">VEHICLE PLATE</span>
              <span className="text-sm font-black text-white tracking-widest mt-1 block">
                {booking.vehiclePlate}
              </span>
            </div>
          </div>

          {/* 20-Minute Check-In Expiration Timer Banner */}
          {booking.status === 'CONFIRMED' && (
            <div className="p-3 border border-amber-500/40 bg-amber-950/20 text-amber-300 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Clock className="w-4 h-4 text-amber-400 animate-pulse" /> 20-MIN ARRIVAL GRACE WINDOW
              </div>
              <p className="text-[11px] text-amber-200/90 leading-tight">
                Arrive and check in before <span className="font-bold">{new Date(booking.checkInDeadline).toLocaleTimeString()}</span>. Un-checked reservations automatically expire and release the slot.
              </p>
              <div className="text-[11px] font-bold text-white pt-1">
                CHECK-IN DEADLINE COUNTDOWN: {minutesRemaining} MINS REMAINING
              </div>
            </div>
          )}

          {/* Key Details Breakdown */}
          <div className="space-y-2 text-xs border-t border-[#292E38] pt-4">
            <div className="flex justify-between py-1 border-b border-[#292E38]/50">
              <span className="text-zinc-400">ESTIMATED ARRIVAL:</span>
              <span className="font-bold text-white">
                {new Date(booking.estimatedArrival).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-[#292E38]/50">
              <span className="text-zinc-400">RESERVED DURATION:</span>
              <span className="font-bold text-white">{booking.estimatedDuration} Hours</span>
            </div>

            {booking.evChargingRequested && (
              <div className="flex justify-between py-1 border-b border-[#292E38]/50 text-amber-400">
                <span className="flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" /> EV CHARGING POINT:
                </span>
                <span className="font-bold">
                  {booking.evChargingPoint ? booking.evChargingPoint.code : 'EV POINT ASSIGNED'}
                </span>
              </div>
            )}

            {booking.carWashRequested && (
              <div className="flex justify-between py-1 border-b border-[#292E38]/50 text-blue-400">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> CAR WASH SERVICE:
                </span>
                <span className="font-bold">REQUESTED (+₹{booking.carWashFee})</span>
              </div>
            )}

            <div className="flex justify-between py-1 border-b border-[#292E38]/50">
              <span className="text-zinc-400">PAYMENT METHOD:</span>
              <span className="font-bold text-white">
                {booking.paymentMethod === 'PAY_AT_PARKING' ? 'PAY AT PARKING' : 'PREPAY ONLINE'}
              </span>
            </div>

            <div className="flex justify-between py-1">
              <span className="text-zinc-400">PAYMENT STATUS:</span>
              <span
                className={`font-bold ${
                  booking.paymentStatus === 'PAID' ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {booking.paymentStatus}
              </span>
            </div>
          </div>

          {cancelMessage && (
            <div className="p-3 border border-zinc-700 bg-zinc-900 text-xs text-white">
              {cancelMessage}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              onClick={() => window.print()}
              className="w-full bg-[#171D27] hover:bg-[#232936] text-white border border-[#292E38] font-bold text-xs py-3 uppercase flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" /> PRINT BOOKING PASS
            </button>

            {booking.status === 'CONFIRMED' || booking.status === 'PENDING' ? (
              <button
                onClick={handleCancelBooking}
                disabled={cancelling}
                className="w-full bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40 font-bold text-xs py-2.5 uppercase flex items-center justify-center gap-1.5"
              >
                <XCircle className="w-4 h-4" /> CANCEL RESERVATION
              </button>
            ) : null}
          </div>
        </div>
      </main>

      <footer className="max-w-md w-full mx-auto text-center py-4 text-[11px] font-mono-tech text-zinc-600 border-t border-[#292E38]">
        PARKSMART BOOKING ENGINE &bull; AUTOMATIC 20-MIN EXPIRATION ENFORCED
      </footer>
    </div>
  );
}
