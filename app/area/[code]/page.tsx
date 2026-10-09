'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { QRCodeImage } from '@/components/qr-code';
import {
  MapPin,
  Clock,
  Car,
  Bike,
  Zap,
  Sparkles,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  ShieldCheck,
  RefreshCw,
  Info,
  Check,
  Sliders,
  Filter
} from 'lucide-react';

interface SlotData {
  id: string;
  slotNumber: string;
  vehicleType: string;
  status: string; // FREE, OCCUPIED, RESERVED, BLOCKED
  zoneId: string;
}

interface CategoryStats {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  maintenance: number;
}

interface ParkingDetails {
  id: string;
  name: string;
  code: string;
  city: string | null;
  address: string | null;
  hourlyRate: number;
  hourlyRate2W?: number;
  hourlyRate4W?: number;
  evHourlyRate?: number;
  currency: string;
  openingTime: string;
  closingTime: string;
  carWashAvailable: boolean;
  carWashRate: number;
  evChargingAvailable: boolean;
  evRatePerKw: number;
  totalSlots: number;
  freeSlots: number;
  occupiedSlots: number;
  reservedSlots: number;
  maintenanceSlots: number;
  stats2W?: CategoryStats;
  stats4W?: CategoryStats;
  freeEvPoints: number;
  totalEvPoints: number;
  slots: SlotData[];
}

export default function ParkingAreaDetailsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);

  const [details, setDetails] = useState<ParkingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [vehicleType, setVehicleType] = useState<string>('4W');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [estimatedArrival, setEstimatedArrival] = useState(() => {
    const d = new Date(Date.now() + 10 * 60000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [estimatedDuration, setEstimatedDuration] = useState(2);
  const [carWashRequested, setCarWashRequested] = useState(false);
  const [evChargingRequested, setEvChargingRequested] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'PAY_AT_PARKING' | 'PREPAY_ONLINE'>('PAY_AT_PARKING');
  const [driverPhone, setDriverPhone] = useState('');

  // Slot Filter Tab state
  const [slotCategoryTab, setSlotCategoryTab] = useState<'ALL' | '2W' | '4W'>('ALL');

  // EV Check & Booking submission state
  const [evWarning, setEvWarning] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Modal / Pre-booking countdown state
  const [createdBooking, setCreatedBooking] = useState<any | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Fetch parking area details by code
  const fetchDetails = async () => {
    try {
      const resArea = await fetch(`/api/parking?q=${code}`);
      const jsonArea = await resArea.json();
      if (jsonArea.success && jsonArea.data.length > 0) {
        const areaId = jsonArea.data[0].id;
        const resDetails = await fetch(`/api/parking/${areaId}/details`);
        const jsonDetails = await resDetails.json();
        if (jsonDetails.success) {
          setDetails(jsonDetails.data);
        } else {
          setError(jsonDetails.message || 'Error loading details');
        }
      } else {
        setError('Parking facility not found');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
    const interval = setInterval(fetchDetails, 15000);
    return () => clearInterval(interval);
  }, [code]);

  // Handle EV Charging checkbox toggle & period check
  const handleEvToggle = async (checked: boolean) => {
    setEvChargingRequested(checked);
    setEvWarning(null);

    if (checked && details) {
      if (!details.evChargingAvailable || details.totalEvPoints === 0) {
        setEvWarning('EV charging is not configured at this location.');
        return;
      }
      if (details.freeEvPoints === 0) {
        setEvWarning('EV charging unavailable for your selected time.');
      }
    }
  };

  // Pricing calculations
  const hourlyParkingRate = details
    ? vehicleType === '2W'
      ? details.hourlyRate2W || 15
      : details.hourlyRate4W || details.hourlyRate || 30
    : 30;

  const evRatePerHour = details?.evHourlyRate || details?.evRatePerKw || 50;

  const parkingFee = details ? estimatedDuration * hourlyParkingRate : 0;
  const carWashFee = carWashRequested && details?.carWashAvailable ? details.carWashRate : 0;
  const evChargingFee = evChargingRequested && details?.evChargingAvailable ? estimatedDuration * evRatePerHour : 0;
  const serviceCharge = 10.0;
  const totalAmount = parkingFee + carWashFee + evChargingFee + serviceCharge;

  // Handle booking form submission
  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError(null);
    setSubmitting(true);

    if (!details) return;

    try {
      const res = await fetch('/api/booking/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parkingAreaId: details.id,
          slotId: selectedSlotId || undefined,
          vehicleType,
          vehiclePlate,
          estimatedArrival,
          estimatedDuration,
          carWashRequested,
          evChargingRequested,
          paymentMethod,
          driverPhone: driverPhone || undefined,
        }),
      });

      const json = await res.json();
      setSubmitting(false);

      if (!json.success) {
        setBookingError(json.message || 'Booking failed');
        return;
      }

      setCreatedBooking(json.data);

      if (paymentMethod === 'PREPAY_ONLINE') {
        setShowPaymentModal(true);
      } else {
        // Pay at parking confirmed! Redirect to booking ticket view
        window.location.href = `/booking/${json.data.bookingCode}`;
      }
    } catch (err) {
      setSubmitting(false);
      setBookingError('Network error completing booking');
    }
  };

  // Execute Simulated Online Payment
  const handleCompleteSimulatedPayment = async () => {
    if (!createdBooking) return;
    setSubmitting(true);
    setBookingError(null);

    try {
      const res = await fetch('/api/booking/pay-simulated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingCode: createdBooking.bookingCode }),
      });
      const json = await res.json();
      setSubmitting(false);

      if (!json.success) {
        setBookingError(json.message || 'Payment simulation failed');
        return;
      }

      window.location.href = `/booking/${createdBooking.bookingCode}`;
    } catch (err) {
      setSubmitting(false);
      setBookingError('Payment proxy error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0E13] text-[#F4F4F5] flex items-center justify-center font-mono text-xs">
        <RefreshCw className="w-4 h-4 animate-spin text-[#F05A28] mr-2" /> LOADING FACILITY BREAKDOWN...
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="min-h-screen bg-[#0B0E13] text-[#F4F4F5] flex flex-col items-center justify-center p-6 text-center font-mono space-y-4">
        <AlertTriangle className="w-12 h-12 text-[#F05A28]" />
        <h1 className="text-xl font-bold uppercase text-white">Facility Not Found</h1>
        <p className="text-xs text-zinc-400">{error || 'The requested parking area does not exist.'}</p>
        <Link href="/parking" className="bg-[#171D27] border border-[#292E38] text-white px-4 py-2 text-xs font-bold uppercase hover:bg-[#232936]">
          &larr; Back to Parking Directory
        </Link>
      </div>
    );
  }

  // Filter slots for interactive map tab
  const filteredSlots = details.slots.filter((slot) => {
    if (slotCategoryTab === '2W') return slot.vehicleType === '2W' || slot.slotNumber.startsWith('B');
    if (slotCategoryTab === '4W') return slot.vehicleType === '4W' || slot.slotNumber.startsWith('C') || slot.vehicleType === 'EV' || slot.vehicleType === 'SUV';
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0B0E13] text-[#F4F4F5]">
      {/* Navbar */}
      <header className="border-b border-[#292E38] bg-[#0B0E13]/95 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/parking" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4 text-zinc-400" />
            <span className="font-extrabold text-sm tracking-tighter uppercase font-mono-tech text-white">
              PARKSMART<span className="text-[#F05A28]">.SLOTS</span>
            </span>
          </Link>
          <span className="font-mono-tech text-xs text-zinc-400 bg-[#171D27] px-2.5 py-1 border border-[#292E38]">
            FACILITY ID: {details.code}
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Top Venue Header */}
        <div className="border border-[#292E38] bg-[#121720] p-6 space-y-4 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono-tech text-[#9EB08C] mb-1">
                <span className="w-2 h-2 bg-[#9EB08C] rounded-full animate-pulse inline-block" />
                LIVE FACILITY DIRECTORY &bull; {details.openingTime} - {details.closingTime} OPERATING HOURS
              </div>
              <h1 className="text-3xl font-black text-white uppercase tracking-tight">{details.name}</h1>
              <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5 font-mono-tech">
                <MapPin className="w-3.5 h-3.5 text-[#F05A28]" />
                {details.address ? `${details.address}, ${details.city || ''}` : details.city || 'Smart Facility'}
              </p>
            </div>

            <div className="flex items-center gap-3 font-mono-tech text-xs bg-[#171D27] border border-[#292E38] p-3">
              <div>
                <span className="text-zinc-400 block text-[10px]">2W TARIFF</span>
                <span className="text-lg font-black text-[#9EB08C]">₹{details.hourlyRate2W || 15}/HR</span>
              </div>
              <div className="h-8 w-px bg-[#292E38]" />
              <div>
                <span className="text-zinc-400 block text-[10px]">4W TARIFF</span>
                <span className="text-lg font-black text-white">₹{details.hourlyRate4W || details.hourlyRate || 30}/HR</span>
              </div>
              <div className="h-8 w-px bg-[#292E38]" />
              <div>
                <span className="text-zinc-400 block text-[10px]">EV CHARGING</span>
                <span className="text-lg font-black text-amber-400">₹{evRatePerHour}/HR</span>
              </div>
            </div>
          </div>

          {/* Amenities Badges */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-[#292E38] text-xs font-mono-tech">
            <span
              className={`px-3 py-1 border flex items-center gap-1.5 ${
                details.evChargingAvailable
                  ? 'border-amber-500/40 bg-amber-950/20 text-amber-300'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-600'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              {details.evChargingAvailable
                ? `EV Charging — ₹${evRatePerHour}/hour (${details.freeEvPoints}/${details.totalEvPoints} POINTS AVAILABLE)`
                : 'NO EV CHARGING'}
            </span>

            <span
              className={`px-3 py-1 border flex items-center gap-1.5 ${
                details.carWashAvailable
                  ? 'border-blue-500/40 bg-blue-950/20 text-blue-300'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-600'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {details.carWashAvailable ? `Car Wash Service (+₹${details.carWashRate})` : 'NO CAR WASH'}
            </span>
          </div>
        </div>

        {/* Breakdown Stats Cards: 2W vs 4W Category Split */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono-tech">
          {/* Two-Wheeler Breakdown */}
          <div className="border border-[#292E38] bg-[#121720] p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#292E38] pb-2">
              <span className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
                <Bike className="w-4 h-4 text-[#9EB08C]" /> Two-Wheeler Parking (2W)
              </span>
              <span className="text-xs font-extrabold text-[#9EB08C]">₹{details.hourlyRate2W || 15}/HR</span>
            </div>

            <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
              <div className="bg-[#171D27] p-2 border border-[#292E38]">
                <span className="text-[9px] text-zinc-400 block uppercase">Total</span>
                <span className="font-extrabold text-white text-base">{details.stats2W?.total ?? 0}</span>
              </div>
              <div className="bg-emerald-950/30 p-2 border border-emerald-500/40">
                <span className="text-[9px] text-emerald-400 block uppercase">Available</span>
                <span className="font-extrabold text-emerald-400 text-base">{details.stats2W?.available ?? 0}</span>
              </div>
              <div className="bg-rose-950/30 p-2 border border-rose-500/40">
                <span className="text-[9px] text-rose-400 block uppercase">Occupied</span>
                <span className="font-extrabold text-rose-400 text-base">{details.stats2W?.occupied ?? 0}</span>
              </div>
              <div className="bg-amber-950/30 p-2 border border-amber-500/40">
                <span className="text-[9px] text-amber-300 block uppercase">Reserved</span>
                <span className="font-extrabold text-amber-300 text-base">{details.stats2W?.reserved ?? 0}</span>
              </div>
              <div className="bg-zinc-900 p-2 border border-zinc-700">
                <span className="text-[9px] text-zinc-400 block uppercase">Maint</span>
                <span className="font-extrabold text-zinc-400 text-base">{details.stats2W?.maintenance ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Four-Wheeler Breakdown */}
          <div className="border border-[#292E38] bg-[#121720] p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#292E38] pb-2">
              <span className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
                <Car className="w-4 h-4 text-[#F05A28]" /> Four-Wheeler Parking (4W)
              </span>
              <span className="text-xs font-extrabold text-white">₹{details.hourlyRate4W || details.hourlyRate || 30}/HR</span>
            </div>

            <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
              <div className="bg-[#171D27] p-2 border border-[#292E38]">
                <span className="text-[9px] text-zinc-400 block uppercase">Total</span>
                <span className="font-extrabold text-white text-base">{details.stats4W?.total ?? 0}</span>
              </div>
              <div className="bg-emerald-950/30 p-2 border border-emerald-500/40">
                <span className="text-[9px] text-emerald-400 block uppercase">Available</span>
                <span className="font-extrabold text-emerald-400 text-base">{details.stats4W?.available ?? 0}</span>
              </div>
              <div className="bg-rose-950/30 p-2 border border-rose-500/40">
                <span className="text-[9px] text-rose-400 block uppercase">Occupied</span>
                <span className="font-extrabold text-rose-400 text-base">{details.stats4W?.occupied ?? 0}</span>
              </div>
              <div className="bg-amber-950/30 p-2 border border-amber-500/40">
                <span className="text-[9px] text-amber-300 block uppercase">Reserved</span>
                <span className="font-extrabold text-amber-300 text-base">{details.stats4W?.reserved ?? 0}</span>
              </div>
              <div className="bg-zinc-900 p-2 border border-zinc-700">
                <span className="text-[9px] text-zinc-400 block uppercase">Maint</span>
                <span className="font-extrabold text-zinc-400 text-base">{details.stats4W?.maintenance ?? 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main 2-Column Section: Interactive Slot Map (7 cols) + Booking Form (5 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Interactive Slot Grid (7 cols) */}
          <div className="lg:col-span-7 space-y-4 font-mono-tech">
            <div className="border border-[#292E38] bg-[#121720] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#292E38] pb-3">
                <h2 className="text-sm font-bold text-white uppercase flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#F05A28]" /> INTERACTIVE SLOT SELECTION
                </h2>
                <span className="text-[11px] text-zinc-400">
                  {selectedSlotId ? `SELECTED: ${details.slots.find((s) => s.id === selectedSlotId)?.slotNumber}` : 'CLICK A FREE SLOT BELOW'}
                </span>
              </div>

              {/* Category Filter Tabs: All, 2-Wheeler (2W), 4-Wheeler (4W) */}
              <div className="flex border border-[#292E38] bg-[#171D27] p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setSlotCategoryTab('ALL')}
                  className={`flex-1 py-2 font-bold uppercase transition text-center ${
                    slotCategoryTab === 'ALL' ? 'bg-[#F05A28] text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  ALL SLOTS ({details.slots.length})
                </button>
                <button
                  type="button"
                  onClick={() => { setSlotCategoryTab('2W'); setVehicleType('2W'); }}
                  className={`flex-1 py-2 font-bold uppercase transition text-center ${
                    slotCategoryTab === '2W' ? 'bg-[#9EB08C] text-black' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  2-WHEELERS ({details.stats2W?.total ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => { setSlotCategoryTab('4W'); setVehicleType('4W'); }}
                  className={`flex-1 py-2 font-bold uppercase transition text-center ${
                    slotCategoryTab === '4W' ? 'bg-[#F05A28] text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  4-WHEELERS ({details.stats4W?.total ?? 0})
                </button>
              </div>

              {/* Status Color Legend */}
              <div className="flex flex-wrap items-center gap-4 text-xs bg-[#171D27] p-3 border border-[#292E38]">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-[#9EB08C] rounded-sm inline-block" />
                  <span className="text-zinc-300">Available</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-[#F05A28] rounded-sm inline-block" />
                  <span className="text-zinc-300">Occupied</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-amber-400 rounded-sm inline-block" />
                  <span className="text-zinc-300">Reserved</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-zinc-600 rounded-sm inline-block" />
                  <span className="text-zinc-300">Maintenance</span>
                </div>
              </div>

              {/* Slots Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5 max-h-[420px] overflow-y-auto pr-1">
                {filteredSlots.map((slot) => {
                  const isFree = slot.status === 'FREE';
                  const isSelected = selectedSlotId === slot.id;

                  let bgColor = 'bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed';
                  if (slot.status === 'FREE') bgColor = 'bg-emerald-950/40 text-emerald-300 border-emerald-500/50 hover:border-emerald-400 cursor-pointer';
                  if (slot.status === 'OCCUPIED') bgColor = 'bg-rose-950/40 text-rose-400 border-rose-500/40 cursor-not-allowed';
                  if (slot.status === 'RESERVED') bgColor = 'bg-amber-950/40 text-amber-300 border-amber-500/40 cursor-not-allowed';
                  if (slot.status === 'BLOCKED') bgColor = 'bg-zinc-900 text-zinc-500 border-zinc-800 cursor-not-allowed';

                  if (isSelected) {
                    bgColor = 'bg-[#F05A28] text-white border-white ring-2 ring-[#F05A28] cursor-pointer';
                  }

                  return (
                    <button
                      key={slot.id}
                      type="button"
                      disabled={!isFree}
                      onClick={() => {
                        setSelectedSlotId(isSelected ? null : slot.id);
                        if (slot.vehicleType === '2W') setVehicleType('2W');
                        if (slot.vehicleType === '4W') setVehicleType('4W');
                      }}
                      className={`p-3 border text-center transition flex flex-col items-center justify-between min-h-[72px] ${bgColor}`}
                    >
                      <span className="text-xs font-black tracking-wider block">{slot.slotNumber}</span>
                      <span className="text-[9px] uppercase tracking-tighter opacity-80 mt-1">
                        {slot.vehicleType} &bull; {slot.status}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="text-[11px] text-zinc-500 border-t border-[#292E38] pt-2">
                Tip: Click any free slot to select your preferred parking bay.
              </div>
            </div>
          </div>

          {/* Booking Form (5 cols) */}
          <div className="lg:col-span-5">
            <form onSubmit={handleBookingSubmit} className="border border-[#292E38] bg-[#121720] p-6 space-y-4 font-mono-tech shadow-2xl">
              <h2 className="text-base font-bold text-white uppercase border-b border-[#292E38] pb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#F05A28]" /> BOOK PARKING SPACE
              </h2>

              {/* Selected slot info indicator */}
              <div className="bg-[#171D27] p-3 border border-[#292E38] flex items-center justify-between text-xs">
                <span className="text-zinc-400">SELECTED BAY:</span>
                <span className="text-[#9EB08C] font-bold">
                  {selectedSlotId
                    ? details.slots.find((s) => s.id === selectedSlotId)?.slotNumber
                    : 'AUTO-ASSIGN BEST BAY'}
                </span>
              </div>

              {/* Vehicle Type */}
              <div>
                <label className="text-xs text-zinc-400 block uppercase mb-1">Vehicle Category</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => { setVehicleType('4W'); setSlotCategoryTab('4W'); }}
                    className={`p-2.5 border flex items-center justify-center gap-1.5 font-bold uppercase ${
                      vehicleType === '4W' ? 'border-[#F05A28] bg-[#F05A28]/20 text-white' : 'border-[#292E38] bg-[#171D27] text-zinc-400'
                    }`}
                  >
                    <Car className="w-3.5 h-3.5" /> 4-Wheeler (₹{details.hourlyRate4W || details.hourlyRate || 30}/hr)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setVehicleType('2W'); setSlotCategoryTab('2W'); }}
                    className={`p-2.5 border flex items-center justify-center gap-1.5 font-bold uppercase ${
                      vehicleType === '2W' ? 'border-[#9EB08C] bg-[#9EB08C]/20 text-white' : 'border-[#292E38] bg-[#171D27] text-zinc-400'
                    }`}
                  >
                    <Bike className="w-3.5 h-3.5" /> 2-Wheeler (₹{details.hourlyRate2W || 15}/hr)
                  </button>
                </div>
              </div>

              {/* Registration Number */}
              <div>
                <label className="text-xs text-zinc-400 block uppercase mb-1">
                  License Plate Number <span className="text-[#F05A28]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                  placeholder="e.g. KA01AB1234"
                  className="w-full bg-[#171D27] border border-[#292E38] text-white text-base font-black tracking-widest p-2.5 uppercase focus:outline-none focus:border-[#F05A28]"
                />
              </div>

              {/* Arrival Date & Time */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-zinc-400 block uppercase mb-1">Estimated Arrival</label>
                  <input
                    type="datetime-local"
                    required
                    value={estimatedArrival}
                    onChange={(e) => setEstimatedArrival(e.target.value)}
                    className="w-full bg-[#171D27] border border-[#292E38] text-white text-xs p-2.5 focus:outline-none focus:border-[#F05A28]"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 block uppercase mb-1">Duration (Hours)</label>
                  <input
                    type="number"
                    min="1"
                    max="48"
                    required
                    value={estimatedDuration}
                    onChange={(e) => setEstimatedDuration(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-[#171D27] border border-[#292E38] text-white text-xs p-2.5 focus:outline-none focus:border-[#F05A28]"
                  />
                </div>
              </div>

              {/* Additional Services Options */}
              <div className="space-y-2 border-t border-[#292E38] pt-3">
                <span className="text-[10px] text-zinc-400 uppercase font-bold block">ADD-ON SERVICES</span>

                {/* EV Charging Checkbox (Formula: duration * ₹50/hr) */}
                <label
                  className={`flex items-center justify-between p-2.5 border cursor-pointer ${
                    details.evChargingAvailable
                      ? 'bg-[#171D27] border-[#292E38]'
                      : 'bg-zinc-900 border-zinc-800 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      disabled={!details.evChargingAvailable}
                      checked={evChargingRequested}
                      onChange={(e) => handleEvToggle(e.target.checked)}
                      className="accent-amber-400"
                    />
                    <span className="text-white flex items-center gap-1 font-bold">
                      <Zap className="w-3.5 h-3.5 text-amber-400" /> Need EV Charging — ₹{evRatePerHour}/hour
                    </span>
                  </div>
                  <span className="text-amber-400 text-xs font-bold">
                    {details.evChargingAvailable ? `+₹${estimatedDuration * evRatePerHour}` : 'N/A'}
                  </span>
                </label>

                {evWarning && (
                  <div className="p-2 border border-amber-500/40 bg-amber-950/20 text-amber-300 text-[11px]">
                    {evWarning}
                  </div>
                )}

                {/* Car Wash Checkbox */}
                <label
                  className={`flex items-center justify-between p-2.5 border cursor-pointer ${
                    details.carWashAvailable
                      ? 'bg-[#171D27] border-[#292E38]'
                      : 'bg-zinc-900 border-zinc-800 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      disabled={!details.carWashAvailable}
                      checked={carWashRequested}
                      onChange={(e) => setCarWashRequested(e.target.checked)}
                      className="accent-blue-400"
                    />
                    <span className="text-white flex items-center gap-1 font-bold">
                      <Sparkles className="w-3.5 h-3.5 text-blue-400" /> Need Car Wash
                    </span>
                  </div>
                  <span className="text-blue-400 text-xs font-bold">
                    {details.carWashAvailable ? `+₹${details.carWashRate}` : 'N/A'}
                  </span>
                </label>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="text-xs text-zinc-400 block uppercase mb-1">Payment Method</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('PAY_AT_PARKING')}
                    className={`p-2.5 border text-center font-bold uppercase ${
                      paymentMethod === 'PAY_AT_PARKING'
                        ? 'border-[#9EB08C] bg-[#9EB08C]/20 text-white'
                        : 'border-[#292E38] bg-[#171D27] text-zinc-400'
                    }`}
                  >
                    Pay at Parking
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('PREPAY_ONLINE')}
                    className={`p-2.5 border text-center font-bold uppercase ${
                      paymentMethod === 'PREPAY_ONLINE'
                        ? 'border-[#F05A28] bg-[#F05A28]/20 text-white'
                        : 'border-[#292E38] bg-[#171D27] text-zinc-400'
                    }`}
                  >
                    Prepay Online
                  </button>
                </div>
              </div>

              {/* Price Summary Breakdown */}
              <div className="bg-[#171D27] p-3 border border-[#292E38] space-y-1.5 text-xs text-zinc-300">
                <div className="flex justify-between">
                  <span>PARKING ({vehicleType} &bull; {estimatedDuration} HRS @ ₹{hourlyParkingRate}/hr):</span>
                  <span>₹{parkingFee}</span>
                </div>
                {evChargingRequested && (
                  <div className="flex justify-between text-amber-400 font-bold">
                    <span>EV CHARGING ({estimatedDuration} HRS @ ₹{evRatePerHour}/hr):</span>
                    <span>+₹{evChargingFee}</span>
                  </div>
                )}
                {carWashRequested && (
                  <div className="flex justify-between text-blue-400">
                    <span>CAR WASH SERVICE:</span>
                    <span>+₹{carWashFee}</span>
                  </div>
                )}
                <div className="flex justify-between text-zinc-500">
                  <span>SERVICE CHARGE:</span>
                  <span>+₹{serviceCharge}</span>
                </div>
                <div className="flex justify-between text-base font-black text-white border-t border-[#292E38] pt-2 mt-1">
                  <span>TOTAL ESTIMATED COST:</span>
                  <span className="text-[#9EB08C]">₹{totalAmount}</span>
                </div>
              </div>

              {bookingError && (
                <div className="p-3 border border-rose-500/40 bg-rose-950/20 text-rose-300 text-xs">
                  {bookingError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#F05A28] hover:bg-[#d0461b] text-white font-extrabold text-sm py-3.5 uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
              >
                {submitting ? (
                  'PROCESSING BOOKING...'
                ) : (
                  <>
                    CONFIRM BOOKING (₹{totalAmount}) &rarr;
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Simulated Payment & Pre-Booking Window Modal */}
      {showPaymentModal && createdBooking && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-mono-tech">
          <div className="border border-[#292E38] bg-[#121720] max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#292E38] pb-3">
              <h3 className="text-base font-bold text-white uppercase flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#F05A28]" /> PREPAY ONLINE — TEST MODE
              </h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-zinc-500 hover:text-white font-bold text-lg"
              >
                ×
              </button>
            </div>

            {!createdBooking.windowOpen ? (
              <div className="space-y-4 text-center py-4">
                <Clock className="w-10 h-10 text-amber-400 mx-auto animate-pulse" />
                <h4 className="text-sm font-bold text-white uppercase">PRE-BOOKING WINDOW NOT YET OPEN</h4>
                <p className="text-xs text-zinc-300 bg-amber-950/30 border border-amber-500/40 p-3">
                  Pre-booking opens 15 minutes before your estimated arrival time.
                </p>
                <div className="text-xs text-zinc-400 font-mono">
                  WINDOW OPENS IN: <span className="text-amber-400 font-bold">{createdBooking.minutesUntilWindow} MINUTES</span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Your slot is tentatively held. Return to this page 15 minutes prior to arrival to verify availability and complete test payment.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 text-xs">
                  <span className="font-bold block">● PRE-BOOKING WINDOW OPEN</span>
                  Arrival availability re-verified. Complete simulated payment to lock your space.
                </div>

                <div className="bg-[#171D27] p-3 border border-[#292E38] text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">BOOKING REF:</span>
                    <span className="font-bold text-white">{createdBooking.bookingCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">ALLOCATED SLOT:</span>
                    <span className="font-bold text-[#9EB08C]">{createdBooking.slotNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">TOTAL AMOUNT:</span>
                    <span className="font-bold text-white">₹{createdBooking.totalAmount}</span>
                  </div>
                </div>

                <div className="p-3 border border-zinc-700 bg-zinc-900/60 text-[11px] text-zinc-400 space-y-1">
                  <span className="font-bold text-white block">DEMO PAYMENT GATEWAY INTEGRATION</span>
                  <p>This is a simulated hackathon payment test environment. No real funds will be deducted from your account.</p>
                </div>

                <button
                  onClick={handleCompleteSimulatedPayment}
                  disabled={submitting}
                  className="w-full bg-[#F05A28] hover:bg-[#d0461b] text-white font-extrabold text-sm py-3.5 uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  {submitting ? 'PROCESSING SIMULATION...' : `PAY ₹${createdBooking.totalAmount} (SIMULATED TEST)`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
