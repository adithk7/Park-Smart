'use client';

import React, { useState } from 'react';
import { AnimatedCounter } from '@/components/ui/animated-counter';

export interface SlotData {
  slotNumber: string;
  floor: string;
  zone: string;
  type: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'EV';
  dwell?: string;
  plateToken?: string;
}

interface ParkingMapProps {
  initialSlots?: SlotData[];
  venueName?: string;
  totalCapacity?: number;
}

export function ParkingMap({ initialSlots, venueName = 'PHOENIX-01', totalCapacity = 50 }: ParkingMapProps) {
  const defaultSlots: SlotData[] = [
    { slotNumber: 'A-01', floor: '1', zone: 'A', type: 'TRANSIENT', status: 'OCCUPIED', dwell: '42m', plateToken: 'ad66...8532' },
    { slotNumber: 'A-02', floor: '1', zone: 'A', type: 'TRANSIENT', status: 'AVAILABLE' },
    { slotNumber: 'A-03', floor: '1', zone: 'A', type: 'EV', status: 'EV', dwell: '18m', plateToken: 'bc71...9041' },
    { slotNumber: 'A-04', floor: '1', zone: 'A', type: 'TRANSIENT', status: 'AVAILABLE' },
    { slotNumber: 'A-05', floor: '1', zone: 'A', type: 'TRANSIENT', status: 'OCCUPIED', dwell: '1h 14m', plateToken: 'f391...1120' },
    { slotNumber: 'A-06', floor: '1', zone: 'A', type: 'TRANSIENT', status: 'AVAILABLE' },
    { slotNumber: 'B-01', floor: '2', zone: 'B', type: 'RECURRING', status: 'RESERVED', dwell: 'Resident', plateToken: 'KA01...9999' },
    { slotNumber: 'B-02', floor: '2', zone: 'B', type: 'TRANSIENT', status: 'AVAILABLE' },
    { slotNumber: 'B-03', floor: '2', zone: 'B', type: 'TRANSIENT', status: 'OCCUPIED', dwell: '25m', plateToken: '882a...5541' },
    { slotNumber: 'B-04', floor: '2', zone: 'B', type: 'TRANSIENT', status: 'AVAILABLE' },
    { slotNumber: 'B-05', floor: '2', zone: 'B', type: 'TRANSIENT', status: 'AVAILABLE' },
    { slotNumber: 'B-06', floor: '2', zone: 'B', type: 'RECURRING', status: 'RESERVED', dwell: 'Staff', plateToken: '901b...7721' },
  ];

  const slots = initialSlots && initialSlots.length > 0 ? initialSlots : defaultSlots;
  const [selectedSlot, setSelectedSlot] = useState<SlotData>(slots[0]);
  const [infoFade, setInfoFade] = useState(false);

  const handleSelectSlot = (slot: SlotData) => {
    if (slot.slotNumber === selectedSlot.slotNumber) return;
    setInfoFade(true);
    setTimeout(() => {
      setSelectedSlot(slot);
      setInfoFade(false);
    }, 120);
  };

  const getSlotStyle = (status: string, isSelected: boolean) => {
    switch (status) {
      case 'OCCUPIED':
        return {
          bg: isSelected ? 'bg-[#292E38]' : 'bg-[#171D27]',
          text: 'text-[#F4F4F5]',
          border: isSelected ? 'border-[#F05A28]' : 'border-[#292E38]',
          badge: 'text-[#A1A1AA]',
          tag: 'OCCUPIED',
        };
      case 'EV':
        return {
          bg: isSelected ? 'bg-[#F05A28]/25' : 'bg-[#F05A28]/15',
          text: 'text-[#F05A28]',
          border: isSelected ? 'border-[#F05A28]' : 'border-[#F05A28]/40',
          badge: 'text-[#F05A28]',
          tag: 'EV CHARGE',
        };
      case 'RESERVED':
        return {
          bg: isSelected ? 'bg-[#68715B]/35' : 'bg-[#68715B]/20',
          text: 'text-[#9EB08C]',
          border: isSelected ? 'border-[#F05A28]' : 'border-[#68715B]/40',
          badge: 'text-[#9EB08C]',
          tag: 'RESERVED',
        };
      case 'AVAILABLE':
      default:
        return {
          bg: isSelected ? 'bg-[#1E2532]' : 'bg-[#121720]',
          text: 'text-[#F4F4F5]',
          border: isSelected ? 'border-[#F05A28]' : 'border-[#292E38] hover:border-[#3E4552]',
          badge: 'text-[#68715B]',
          tag: 'OPEN',
        };
    }
  };

  const occupiedCount = slots.filter((s) => s.status === 'OCCUPIED' || s.status === 'EV').length;
  const availableCount = slots.filter((s) => s.status === 'AVAILABLE').length;

  return (
    <div className="bg-[#121720] border border-[#292E38] p-5 sm:p-6 text-[#F4F4F5] shadow-xl">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-4 border-b border-[#292E38]">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 bg-[#F05A28] animate-live-dot" />
          <span className="font-mono-tech text-xs font-bold uppercase tracking-wider text-[#F4F4F5]">
            SPATIAL MATRIX // {venueName}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono-tech">
          <span className="text-[#A1A1AA]">
            OCC: <strong className="text-[#F4F4F5]"><AnimatedCounter target={occupiedCount} /></strong>
          </span>
          <span className="text-[#A1A1AA]">
            AVL: <strong className="text-[#9EB08C]"><AnimatedCounter target={availableCount} /></strong>
          </span>
          <span className="text-[#F05A28] font-bold">₹30/H</span>
        </div>
      </div>

      {/* Interactive Architectural Grid Map */}
      <div className="relative border border-[#292E38] bg-[#0B0E13] p-4">
        
        {/* Drive Aisle Direction Labels */}
        <div className="flex justify-between items-center text-[10px] font-mono-tech text-[#71717A] pb-2 border-b border-dashed border-[#292E38]">
          <span>GATE 01 ENTRANCE ↑</span>
          <span>← MAIN AISLE WAYFINDING →</span>
          <span>GATE 02 EXIT ↓</span>
        </div>

        {/* Zone A */}
        <div className="my-3">
          <div className="text-[10px] font-mono-tech font-bold uppercase text-[#A1A1AA] mb-1.5 flex justify-between">
            <span>ZONE A // LEVEL 01 (GROUND)</span>
            <span>CLEARANCE: 2.8M</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2" role="grid" aria-label="Zone A bays">
            {slots.slice(0, 6).map((slot) => {
              const isSelected = selectedSlot.slotNumber === slot.slotNumber;
              const sStyle = getSlotStyle(slot.status, isSelected);

              return (
                <button
                  key={slot.slotNumber}
                  type="button"
                  role="gridcell"
                  aria-selected={isSelected}
                  tabIndex={0}
                  onClick={() => handleSelectSlot(slot)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectSlot(slot);
                    }
                  }}
                  className={`h-16 flex flex-col justify-between p-2 text-left border rounded-none transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F05A28] active:scale-[0.97] ${sStyle.bg} ${sStyle.border}`}
                >
                  <div className="flex justify-between items-start font-mono-tech text-[10px] font-bold text-[#F4F4F5]">
                    <span>{slot.slotNumber}</span>
                    <span className={`text-[8px] ${sStyle.badge}`}>{slot.type.slice(0, 3)}</span>
                  </div>
                  <span className="font-mono-tech text-[9px] uppercase font-bold tracking-tight text-[#A1A1AA]">
                    {sStyle.tag}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lane separator */}
        <div className="h-4 my-1 flex items-center justify-center border-y border-dashed border-[#292E38]">
          <span className="text-[9px] font-mono-tech text-[#71717A] tracking-widest">
            ━━━ TWO-WAY FLOW SPEED LIMIT 10 KM/H ━━━
          </span>
        </div>

        {/* Zone B */}
        <div className="my-3">
          <div className="text-[10px] font-mono-tech font-bold uppercase text-[#A1A1AA] mb-1.5 flex justify-between">
            <span>ZONE B // LEVEL 02 (UPPER DECK)</span>
            <span>CLEARANCE: 2.4M</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2" role="grid" aria-label="Zone B bays">
            {slots.slice(6, 12).map((slot) => {
              const isSelected = selectedSlot.slotNumber === slot.slotNumber;
              const sStyle = getSlotStyle(slot.status, isSelected);

              return (
                <button
                  key={slot.slotNumber}
                  type="button"
                  role="gridcell"
                  aria-selected={isSelected}
                  tabIndex={0}
                  onClick={() => handleSelectSlot(slot)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectSlot(slot);
                    }
                  }}
                  className={`h-16 flex flex-col justify-between p-2 text-left border rounded-none transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F05A28] active:scale-[0.97] ${sStyle.bg} ${sStyle.border}`}
                >
                  <div className="flex justify-between items-start font-mono-tech text-[10px] font-bold text-[#F4F4F5]">
                    <span>{slot.slotNumber}</span>
                    <span className={`text-[8px] ${sStyle.badge}`}>{slot.type.slice(0, 3)}</span>
                  </div>
                  <span className="font-mono-tech text-[9px] uppercase font-bold tracking-tight text-[#A1A1AA]">
                    {sStyle.tag}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* Restrained Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-3 border-t border-[#292E38] text-xs font-mono-tech text-[#A1A1AA]">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 border border-[#292E38] bg-[#121720]" />
            <span>AVAILABLE</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-[#171D27] border border-[#292E38]" />
            <span>OCCUPIED</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-[#F05A28]" />
            <span>EV ACTIVE</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-[#68715B]" />
            <span>RESERVED</span>
          </div>
        </div>
      </div>

      {/* Selected Slot Telemetry Readout with smooth crossfade */}
      <div
        className="mt-4 p-3 bg-[#171D27] border border-[#292E38] text-[#F4F4F5] font-mono-tech text-xs flex flex-wrap items-center justify-between gap-3 transition-opacity duration-150"
        style={{ opacity: infoFade ? 0.4 : 1 }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[#F05A28] font-bold">BAY [{selectedSlot.slotNumber}]</span>
          <span className="text-[#A1A1AA]">STATUS: {selectedSlot.status}</span>
        </div>
        <div className="flex items-center gap-4 text-[#A1A1AA] text-[11px]">
          {selectedSlot.dwell && (
            <span>DWELL: <strong className="text-white">{selectedSlot.dwell}</strong></span>
          )}
          {selectedSlot.plateToken && (
            <span>HASH: <strong className="text-[#F05A28]">{selectedSlot.plateToken}</strong></span>
          )}
          <span>ZONE: <strong>{selectedSlot.zone}</strong></span>
        </div>
      </div>
    </div>
  );
}
