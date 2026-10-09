'use client';

import React, { useState, useEffect } from 'react';
import {
  Car,
  Bike,
  Zap,
  Sparkles,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Plus,
  Sliders,
  SlidersHorizontal,
  CreditCard,
  LogOut,
  LogIn
} from 'lucide-react';

export function StaffControls() {
  const [activeTab, setActiveTab] = useState<'SLOTS' | 'BOOKINGS' | 'EV'>('SLOTS');

  // Slots state
  const [slots, setSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);

  // Bookings state
  const [bookings, setBookings] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingBookings, setLoadingBookings] = useState(true);

  // EV State
  const [evData, setEvData] = useState<{
    evChargingAvailable: boolean;
    evRatePerKw: number;
    points: any[];
    reservations: any[];
  } | null>(null);
  const [newEvCode, setNewEvCode] = useState('');
  const [loadingEv, setLoadingEv] = useState(true);

  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch Slots
  const fetchSlots = async () => {
    try {
      const res = await fetch('/api/staff/slots');
      const json = await res.json();
      if (json.success) setSlots(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSlots(false);
    }
  };

  // Fetch Bookings
  const fetchBookings = async (q = '') => {
    setLoadingBookings(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      const res = await fetch(`/api/staff/bookings?${params}`);
      const json = await res.json();
      if (json.success) setBookings(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBookings(false);
    }
  };

  // Fetch EV Data
  const fetchEvData = async () => {
    try {
      const res = await fetch('/api/staff/ev');
      const json = await res.json();
      if (json.success) setEvData(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEv(false);
    }
  };

  useEffect(() => {
    fetchSlots();
    fetchBookings();
    fetchEvData();
  }, []);

  // Update Slot Status
  const handleSlotStatusChange = async (slotId: string, status: string) => {
    setActionError(null);
    setActionMessage(null);
    try {
      const res = await fetch('/api/staff/slots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId, status }),
      });
      const json = await res.json();
      if (json.success) {
        setActionMessage(`Slot status updated to ${status}`);
        fetchSlots();
      } else {
        setActionError(json.message || 'Error updating slot status');
      }
    } catch (err) {
      setActionError('Network error updating slot');
    }
  };

  // Execute Booking Action (Check-in, departure, payment)
  const handleBookingAction = async (bookingId: string, action: string) => {
    setActionError(null);
    setActionMessage(null);
    try {
      const res = await fetch('/api/staff/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, action }),
      });
      const json = await res.json();
      if (json.success) {
        setActionMessage(json.message);
        fetchBookings(searchQuery);
        fetchSlots();
      } else {
        setActionError(json.message || 'Error executing booking action');
      }
    } catch (err) {
      setActionError('Network error');
    }
  };

  // Add EV Point
  const handleAddEvPoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvCode.trim()) return;
    setActionError(null);
    setActionMessage(null);
    try {
      const res = await fetch('/api/staff/ev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: newEvCode }),
      });
      const json = await res.json();
      if (json.success) {
        setNewEvCode('');
        setActionMessage(`Charging point ${json.data.code} added`);
        fetchEvData();
      } else {
        setActionError(json.message);
      }
    } catch (err) {
      setActionError('Network error');
    }
  };

  // Toggle EV Point Status
  const handleEvPointStatus = async (pointId: string, status: string) => {
    setActionError(null);
    setActionMessage(null);
    try {
      const res = await fetch('/api/staff/ev', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pointId, status }),
      });
      const json = await res.json();
      if (json.success) {
        setActionMessage(`EV Point status set to ${status}`);
        fetchEvData();
      } else {
        setActionError(json.message);
      }
    } catch (err) {
      setActionError('Network error');
    }
  };

  // Toggle Facility EV Availability
  const handleToggleGlobalEv = async (evChargingAvailable: boolean) => {
    setActionError(null);
    setActionMessage(null);
    try {
      const res = await fetch('/api/staff/ev', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evChargingAvailable }),
      });
      const json = await res.json();
      if (json.success) {
        setActionMessage(`EV Charging ${evChargingAvailable ? 'ENABLED' : 'DISABLED'} for facility`);
        fetchEvData();
      }
    } catch (err) {
      setActionError('Network error');
    }
  };

  // Group slots by 2W and 4W
  const twoWheelerSlots = slots.filter((s) => s.vehicleType === '2W' || s.slotNumber.startsWith('B'));
  const fourWheelerSlots = slots.filter((s) => s.vehicleType !== '2W' && !s.slotNumber.startsWith('B'));

  return (
    <div className="space-y-6 font-mono-tech">
      {/* Navigation Tabs */}
      <div className="flex border border-[#292E38] bg-[#121720] p-1 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('SLOTS')}
          className={`flex-1 py-3 font-bold uppercase transition flex items-center justify-center gap-2 ${
            activeTab === 'SLOTS' ? 'bg-[#F05A28] text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4" /> Parking Slot Management ({slots.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('BOOKINGS')}
          className={`flex-1 py-3 font-bold uppercase transition flex items-center justify-center gap-2 ${
            activeTab === 'BOOKINGS' ? 'bg-[#F05A28] text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Car className="w-4 h-4" /> Bookings & Arrivals ({bookings.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('EV')}
          className={`flex-1 py-3 font-bold uppercase transition flex items-center justify-center gap-2 ${
            activeTab === 'EV' ? 'bg-[#F05A28] text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Zap className="w-4 h-4" /> EV Charging Management ({evData?.points.length || 0})
        </button>
      </div>

      {actionMessage && (
        <div className="p-3 border border-emerald-500/40 bg-emerald-950/20 text-emerald-300 text-xs flex justify-between items-center">
          <span>● {actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="font-bold text-sm">
            ×
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-3 border border-rose-500/40 bg-rose-950/30 text-rose-300 text-xs flex justify-between items-center">
          <span>⚠ {actionError}</span>
          <button onClick={() => setActionError(null)} className="font-bold text-sm">
            ×
          </button>
        </div>
      )}

      {/* ── TAB 1: PARKING SLOT MANAGEMENT ─────────────────── */}
      {activeTab === 'SLOTS' && (
        <div className="border border-[#292E38] bg-[#121720] p-6 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#292E38] pb-3">
            <h2 className="text-base font-bold text-white uppercase">Parking Slot Management (Grouped by Category)</h2>
            <button
              onClick={fetchSlots}
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> REFRESH SLOTS
            </button>
          </div>

          {/* Two-Wheeler Group */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-[#9EB08C] uppercase flex items-center gap-1.5 border-b border-[#292E38] pb-1.5">
              <Bike className="w-4 h-4" /> Two-Wheeler Slots ({twoWheelerSlots.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto pr-1">
              {twoWheelerSlots.map((slot) => (
                <div key={slot.id} className="border border-[#292E38] bg-[#171D27] p-3 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-white text-sm">{slot.slotNumber}</span>
                    <span className="text-[10px] text-[#9EB08C] border border-[#292E38] px-1.5 py-0.5">
                      2W
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400">STATUS:</span>
                    <select
                      value={slot.status}
                      onChange={(e) => handleSlotStatusChange(slot.id, e.target.value)}
                      className={`font-bold border bg-[#121720] px-1.5 py-1 focus:outline-none ${
                        slot.status === 'FREE'
                          ? 'text-emerald-400 border-emerald-500/50'
                          : slot.status === 'OCCUPIED'
                          ? 'text-rose-400 border-rose-500/50'
                          : slot.status === 'RESERVED'
                          ? 'text-amber-400 border-amber-500/50'
                          : 'text-zinc-400 border-zinc-700'
                      }`}
                    >
                      <option value="FREE">AVAILABLE</option>
                      <option value="OCCUPIED">OCCUPIED</option>
                      <option value="RESERVED">RESERVED</option>
                      <option value="BLOCKED">MAINTENANCE</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Four-Wheeler Group */}
          <div className="space-y-3 pt-4 border-t border-[#292E38]">
            <h3 className="text-xs font-bold text-[#F05A28] uppercase flex items-center gap-1.5 border-b border-[#292E38] pb-1.5">
              <Car className="w-4 h-4" /> Four-Wheeler Slots ({fourWheelerSlots.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto pr-1">
              {fourWheelerSlots.map((slot) => (
                <div key={slot.id} className="border border-[#292E38] bg-[#171D27] p-3 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-white text-sm">{slot.slotNumber}</span>
                    <span className="text-[10px] text-[#F05A28] border border-[#292E38] px-1.5 py-0.5">
                      {slot.vehicleType}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400">STATUS:</span>
                    <select
                      value={slot.status}
                      onChange={(e) => handleSlotStatusChange(slot.id, e.target.value)}
                      className={`font-bold border bg-[#121720] px-1.5 py-1 focus:outline-none ${
                        slot.status === 'FREE'
                          ? 'text-emerald-400 border-emerald-500/50'
                          : slot.status === 'OCCUPIED'
                          ? 'text-rose-400 border-rose-500/50'
                          : slot.status === 'RESERVED'
                          ? 'text-amber-400 border-amber-500/50'
                          : 'text-zinc-400 border-zinc-700'
                      }`}
                    >
                      <option value="FREE">AVAILABLE</option>
                      <option value="OCCUPIED">OCCUPIED</option>
                      <option value="RESERVED">RESERVED</option>
                      <option value="BLOCKED">MAINTENANCE</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: BOOKINGS & ARRIVALS ───────────────────────── */}
      {activeTab === 'BOOKINGS' && (
        <div className="border border-[#292E38] bg-[#121720] p-6 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#292E38] pb-3">
            <h2 className="text-base font-bold text-white uppercase">Active Bookings & Expected Arrivals</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  fetchBookings(e.target.value);
                }}
                placeholder="Search by code, plate, or slot..."
                className="bg-[#171D27] border border-[#292E38] text-white text-xs px-3 py-1.5 w-64 focus:outline-none focus:border-[#F05A28]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-[#171D27] text-zinc-400 uppercase text-[10px] border-b border-[#292E38]">
                <tr>
                  <th className="p-3">Ref Code</th>
                  <th className="p-3">Plate & Type</th>
                  <th className="p-3">Slot</th>
                  <th className="p-3">Est Arrival</th>
                  <th className="p-3">Add-Ons</th>
                  <th className="p-3">Payment</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#292E38]">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-[#171D27]/50">
                    <td className="p-3 font-bold text-white font-mono">{b.bookingCode}</td>
                    <td className="p-3 font-bold tracking-wider">{b.vehiclePlate} ({b.vehicleType})</td>
                    <td className="p-3 font-bold text-[#9EB08C]">{b.slot?.slotNumber || 'UNASSIGNED'}</td>
                    <td className="p-3">{new Date(b.estimatedArrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="p-3 space-x-1">
                      {b.evChargingRequested && <span className="text-amber-400 font-bold">EV({b.evChargingPoint?.code || 'YES'})</span>}
                      {b.carWashRequested && <span className="text-blue-400 font-bold">WASH</span>}
                      {!b.evChargingRequested && !b.carWashRequested && <span className="text-zinc-600">-</span>}
                    </td>
                    <td className="p-3">
                      <span className={b.paymentStatus === 'PAID' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                        {b.paymentStatus} (₹{b.totalAmount})
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 border text-[10px] font-bold uppercase border-zinc-700 bg-zinc-900 text-zinc-300">
                        {b.status}
                      </span>
                    </td>
                    <td className="p-3 space-x-1">
                      {b.status === 'CONFIRMED' || b.status === 'PENDING' ? (
                        <button
                          onClick={() => handleBookingAction(b.id, 'CHECK_IN')}
                          className="bg-emerald-950/50 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 px-2 py-1 text-[10px] font-bold uppercase"
                        >
                          Check In
                        </button>
                      ) : null}

                      {b.status === 'CHECKED_IN' ? (
                        <button
                          onClick={() => handleBookingAction(b.id, 'DEPARTURE')}
                          className="bg-blue-950/50 hover:bg-blue-900 text-blue-300 border border-blue-500/40 px-2 py-1 text-[10px] font-bold uppercase"
                        >
                          Departure
                        </button>
                      ) : null}

                      {b.paymentStatus === 'PENDING' ? (
                        <button
                          onClick={() => handleBookingAction(b.id, 'RECORD_PAYMENT')}
                          className="bg-amber-950/50 hover:bg-amber-900 text-amber-300 border border-amber-500/40 px-2 py-1 text-[10px] font-bold uppercase"
                        >
                          Mark Paid
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: EV CHARGING MANAGEMENT ───────────────────── */}
      {activeTab === 'EV' && (
        <div className="border border-[#292E38] bg-[#121720] p-6 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#292E38] pb-4">
            <div>
              <h2 className="text-base font-bold text-white uppercase flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" /> EV Charging Facility Controls
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Manage EV charging points, toggles, equipment status, and active reservations.
              </p>
            </div>

            <button
              onClick={() => handleToggleGlobalEv(!evData?.evChargingAvailable)}
              className={`px-4 py-2 text-xs font-bold uppercase border transition ${
                evData?.evChargingAvailable
                  ? 'bg-amber-500 text-black border-amber-400'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}
            >
              {evData?.evChargingAvailable ? 'EV CHARGING ENABLED' : 'EV CHARGING DISABLED'}
            </button>
          </div>

          {/* Add EV Point Form */}
          <form onSubmit={handleAddEvPoint} className="flex gap-2 bg-[#171D27] p-3 border border-[#292E38]">
            <input
              type="text"
              value={newEvCode}
              onChange={(e) => setNewEvCode(e.target.value.toUpperCase())}
              placeholder="Charging Point Code (e.g. EV01, EV02)"
              className="bg-[#121720] border border-[#292E38] text-white text-xs px-3 py-2 flex-1 focus:outline-none focus:border-amber-400 uppercase font-mono"
            />
            <button
              type="submit"
              className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs px-4 py-2 uppercase flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> ADD EV POINT
            </button>
          </form>

          {/* EV Points Grid */}
          <div>
            <h3 className="text-xs font-bold text-zinc-400 uppercase mb-3">Configured Charging Points</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {evData?.points.map((pt) => (
                <div key={pt.id} className="border border-[#292E38] bg-[#171D27] p-3 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-amber-400 font-mono text-sm">{pt.code}</span>
                    <span className="text-[10px] text-zinc-400">{pt.powerKw} kW</span>
                  </div>

                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-zinc-400">STATUS:</span>
                    <select
                      value={pt.status}
                      onChange={(e) => handleEvPointStatus(pt.id, e.target.value)}
                      className="bg-[#121720] border border-[#292E38] text-white font-bold px-2 py-1 text-[11px]"
                    >
                      <option value="AVAILABLE">AVAILABLE</option>
                      <option value="IN_USE">IN USE</option>
                      <option value="MAINTENANCE">MAINTENANCE</option>
                      <option value="DISABLED">DISABLED</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
