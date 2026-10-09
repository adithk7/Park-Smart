'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Save, Sparkles, Zap, Clock, MapPin, CheckCircle2, RefreshCw } from 'lucide-react';

interface Props {
  initialArea: any;
}

export function AdminFacilitySettings({ initialArea }: Props) {
  const [name, setName] = useState(initialArea.name || '');
  const [address, setAddress] = useState(initialArea.address || '');
  const [city, setCity] = useState(initialArea.city || '');
  const [contactPhone, setContactPhone] = useState(initialArea.contactPhone || '');
  const [openingTime, setOpeningTime] = useState(initialArea.openingTime || '00:00');
  const [closingTime, setClosingTime] = useState(initialArea.closingTime || '23:59');
  const [hourlyRate, setHourlyRate] = useState(initialArea.hourlyRate || 20);
  const [carWashAvailable, setCarWashAvailable] = useState(initialArea.carWashAvailable || false);
  const [carWashRate, setCarWashRate] = useState(initialArea.carWashRate || 150);
  const [evChargingAvailable, setEvChargingAvailable] = useState(initialArea.evChargingAvailable || false);
  const [evRatePerKw, setEvRatePerKw] = useState(initialArea.evRatePerKw || 15);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/facility', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          address,
          city,
          contactPhone,
          openingTime,
          closingTime,
          hourlyRate,
          carWashAvailable,
          carWashRate,
          evChargingAvailable,
          evRatePerKw,
        }),
      });

      const json = await res.json();
      setSaving(false);

      if (json.success) {
        setMessage('Facility configuration saved successfully');
      } else {
        setMessage(json.message || 'Error saving settings');
      }
    } catch (err) {
      setSaving(false);
      setMessage('Network error');
    }
  };

  return (
    <div className="border border-[#292E38] bg-[#121720] p-6 space-y-6 font-mono-tech shadow-xl">
      <div className="flex items-center justify-between border-b border-[#292E38] pb-3">
        <h2 className="text-base font-bold text-white uppercase flex items-center gap-2">
          <Settings className="w-5 h-5 text-[#F05A28]" /> Facility Configuration & Operating Settings
        </h2>
        <span className="text-xs text-zinc-400">FACILITY CODE: {initialArea.code}</span>
      </div>

      {message && (
        <div className="p-3 border border-emerald-500/40 bg-emerald-950/20 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {message}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4 text-xs">
        {/* Name & Location */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-zinc-400 uppercase block mb-1">Facility Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#171D27] border border-[#292E38] text-white p-2.5 font-bold focus:outline-none focus:border-[#F05A28]"
            />
          </div>

          <div>
            <label className="text-zinc-400 uppercase block mb-1">City / Region</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full bg-[#171D27] border border-[#292E38] text-white p-2.5 font-bold focus:outline-none focus:border-[#F05A28]"
            />
          </div>

          <div>
            <label className="text-zinc-400 uppercase block mb-1">Contact Phone</label>
            <input
              type="text"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full bg-[#171D27] border border-[#292E38] text-white p-2.5 font-bold focus:outline-none focus:border-[#F05A28]"
            />
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="text-zinc-400 uppercase block mb-1">Street Address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full bg-[#171D27] border border-[#292E38] text-white p-2.5 focus:outline-none focus:border-[#F05A28]"
          />
        </div>

        {/* Hours & Base Rate */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-[#292E38] pt-4">
          <div>
            <label className="text-zinc-400 uppercase block mb-1">Opening Time</label>
            <input
              type="time"
              value={openingTime}
              onChange={(e) => setOpeningTime(e.target.value)}
              className="w-full bg-[#171D27] border border-[#292E38] text-white p-2.5 focus:outline-none focus:border-[#F05A28]"
            />
          </div>

          <div>
            <label className="text-zinc-400 uppercase block mb-1">Closing Time</label>
            <input
              type="time"
              value={closingTime}
              onChange={(e) => setClosingTime(e.target.value)}
              className="w-full bg-[#171D27] border border-[#292E38] text-white p-2.5 focus:outline-none focus:border-[#F05A28]"
            />
          </div>

          <div>
            <label className="text-zinc-400 uppercase block mb-1">Base Hourly Rate (₹)</label>
            <input
              type="number"
              min="0"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(Number(e.target.value))}
              className="w-full bg-[#171D27] border border-[#292E38] text-white p-2.5 font-bold text-sm focus:outline-none focus:border-[#F05A28]"
            />
          </div>
        </div>

        {/* EV & Car Wash Config */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[#292E38] pt-4">
          {/* EV Settings */}
          <div className="bg-[#171D27] p-4 border border-[#292E38] space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="font-bold text-amber-400 uppercase flex items-center gap-1.5">
                <Zap className="w-4 h-4" /> EV Charging Station
              </span>
              <input
                type="checkbox"
                checked={evChargingAvailable}
                onChange={(e) => setEvChargingAvailable(e.target.checked)}
                className="accent-amber-400 w-4 h-4"
              />
            </label>
            <div>
              <label className="text-[11px] text-zinc-400 uppercase block mb-1">EV Rate Per kW (₹)</label>
              <input
                type="number"
                min="0"
                value={evRatePerKw}
                onChange={(e) => setEvRatePerKw(Number(e.target.value))}
                className="w-full bg-[#121720] border border-[#292E38] text-white p-2 text-xs font-bold"
              />
            </div>
          </div>

          {/* Car Wash Settings */}
          <div className="bg-[#171D27] p-4 border border-[#292E38] space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="font-bold text-blue-400 uppercase flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Car Wash Service
              </span>
              <input
                type="checkbox"
                checked={carWashAvailable}
                onChange={(e) => setCarWashAvailable(e.target.checked)}
                className="accent-blue-400 w-4 h-4"
              />
            </label>
            <div>
              <label className="text-[11px] text-zinc-400 uppercase block mb-1">Car Wash Price (₹)</label>
              <input
                type="number"
                min="0"
                value={carWashRate}
                onChange={(e) => setCarWashRate(Number(e.target.value))}
                className="w-full bg-[#121720] border border-[#292E38] text-white p-2 text-xs font-bold"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-[#F05A28] hover:bg-[#d0461b] text-white font-extrabold py-3 uppercase tracking-wider flex items-center justify-center gap-2 shadow"
        >
          {saving ? 'SAVING SETTINGS...' : 'SAVE FACILITY SETTINGS'}
        </button>
      </form>
    </div>
  );
}
