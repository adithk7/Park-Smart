'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogoutButton } from '@/components/logout-button';
import {
  ArrowLeft,
  Download,
  QrCode,
  RefreshCw,
  Printer,
  AlertCircle,
  CheckCircle2,
  Car,
  ArrowRightLeft,
} from 'lucide-react';

interface QRItem {
  slotNumber?: string;
  zoneId?: string;
  label?: string;
  url: string;
  qr: string; // base64 data URL
}

interface QRData {
  gates: QRItem[];
  slots: QRItem[];
}

interface ParkingAreaInfo {
  id: string;
  name: string;
  code: string;
}

interface ZoneOption {
  id: string;
  name: string;
  levelName: string;
}

export default function QRSheetPage() {
  const [qrData, setQrData] = useState<QRData | null>(null);
  const [parkingArea, setParkingArea] = useState<ParkingAreaInfo | null>(null);
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [scope, setScope] = useState<'all' | 'gates' | 'slots'>('all');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const flash = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  // Fetch zones list for the filter
  const fetchZones = useCallback(async () => {
    const res = await fetch('/api/admin/layout');
    const json = await res.json();
    if (json.success) {
      const z: ZoneOption[] = [];
      for (const level of json.data.levels) {
        for (const zone of level.zones) {
          z.push({ id: zone.id, name: zone.name, levelName: level.name });
        }
      }
      setZones(z);
    }
  }, []);

  const fetchQR = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ scope });
      if (selectedZone) params.set('zoneId', selectedZone);

      const res = await fetch(`/api/admin/qr?${params}`);
      const json = await res.json();
      if (json.success) {
        setQrData(json.data);
        setParkingArea(json.parkingArea);
        flash('ok', `Generated ${json.data.gates.length} gate QRs + ${json.data.slots.length} slot QRs`);
      } else {
        flash('err', json.message || 'Failed to generate QRs');
      }
    } finally {
      setLoading(false);
    }
  }, [scope, selectedZone]);

  useEffect(() => { fetchZones(); }, [fetchZones]);

  const handlePrint = () => {
    if (!printRef.current) return;
    const printContents = printRef.current.innerHTML;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html>
        <head>
          <title>ParkSmart QR Sheet — ${parkingArea?.code ?? ''}</title>
          <style>
            body { margin: 0; padding: 16px; font-family: monospace; background: white; color: black; }
            .qr-grid { display: flex; flex-wrap: wrap; gap: 16px; }
            .qr-card { border: 2px solid #000; padding: 12px; text-align: center; width: 160px; break-inside: avoid; }
            .qr-card img { width: 140px; height: 140px; display: block; margin: 0 auto 8px; }
            .qr-label { font-size: 11px; font-weight: bold; text-transform: uppercase; word-break: break-all; }
            .qr-url { font-size: 8px; color: #555; margin-top: 4px; word-break: break-all; }
            .section-title { font-size: 14px; font-weight: bold; margin: 20px 0 8px; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 4px; }
            .header { margin-bottom: 16px; }
            .header h1 { margin: 0; font-size: 20px; }
            .header p { margin: 4px 0 0; font-size: 11px; color: #555; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>${printContents}</body>
      </html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 300);
  };

  return (
    <div className="min-h-screen bg-[#0B0E13] text-[#F4F4F5] flex flex-col p-4 md:p-8">

      {/* Header */}
      <header className="max-w-7xl w-full mx-auto flex flex-wrap items-center justify-between py-4 border-b border-[#292E38] gap-4 mb-8">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 bg-[#F05A28] inline-block" />
            <span className="font-extrabold text-lg tracking-tighter uppercase font-mono-tech text-[#F4F4F5]">
              PARKSMART<span className="text-[#F05A28]">.SYS</span>
            </span>
          </Link>
          <span className="text-[#71717A] hidden sm:inline">|</span>
          <Badge variant="signal" size="sm">QR SHEET GENERATOR</Badge>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/layout">
            <Button variant="secondary" size="sm"><ArrowLeft className="w-3.5 h-3.5 mr-1" />LAYOUT</Button>
          </Link>
          <LogoutButton />
        </div>
      </header>

      <main className="max-w-7xl w-full mx-auto space-y-6">

        {msg && (
          <div className={`flex items-center gap-2 px-4 py-2 border font-mono-tech text-xs ${msg.type === 'ok' ? 'bg-[#9EB08C]/10 border-[#9EB08C]/40 text-[#9EB08C]' : 'bg-[#F05A28]/10 border-[#F05A28]/40 text-[#F05A28]'}`}>
            {msg.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {msg.text}
          </div>
        )}

        {/* Controls */}
        <div className="border border-[#292E38] bg-[#121720] p-5 flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-[10px] font-mono-tech text-[#A1A1AA] block mb-1">SCOPE</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as typeof scope)}
              className="bg-[#0B0E13] border border-[#292E38] text-white px-3 py-2 text-xs font-mono-tech focus:border-[#F05A28] outline-none"
            >
              <option value="all">All (Gates + Slots)</option>
              <option value="gates">Gates Only</option>
              <option value="slots">Slots Only</option>
            </select>
          </div>

          {(scope === 'all' || scope === 'slots') && zones.length > 0 && (
            <div>
              <label className="text-[10px] font-mono-tech text-[#A1A1AA] block mb-1">FILTER BY ZONE (optional)</label>
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="bg-[#0B0E13] border border-[#292E38] text-white px-3 py-2 text-xs font-mono-tech focus:border-[#F05A28] outline-none"
              >
                <option value="">All Zones</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.levelName} / {z.name}</option>
                ))}
              </select>
            </div>
          )}

          <Button variant="primary" size="md" onClick={fetchQR} isLoading={loading}>
            <QrCode className="w-4 h-4 mr-2" /> GENERATE QR SHEET
          </Button>

          {qrData && (
            <Button variant="secondary" size="md" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" /> PRINT / SAVE PDF
            </Button>
          )}
        </div>

        {/* QR Preview Grid */}
        {!qrData && !loading && (
          <div className="border border-dashed border-[#292E38] text-center py-20 text-[#71717A] font-mono-tech text-xs">
            <QrCode className="w-8 h-8 mx-auto mb-3 opacity-40" />
            Click "GENERATE QR SHEET" to create printable QR codes for all slots and gates.
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20 font-mono-tech text-[#A1A1AA] text-xs">
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Generating QR codes…
          </div>
        )}

        {qrData && !loading && (
          <div ref={printRef}>
            {/* Print header */}
            <div className="hidden print:block mb-6">
              <h1 className="text-2xl font-black">ParkSmart QR Sheet</h1>
              <p className="text-sm text-gray-600">{parkingArea?.name} — Code: {parkingArea?.code} — Printed: {new Date().toLocaleString()}</p>
            </div>

            {/* Gate QRs */}
            {qrData.gates.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-bold font-mono-tech text-sm text-white uppercase border-b border-[#292E38] pb-2 flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-[#F05A28]" />
                  GATE QR CODES — {parkingArea?.name} ({parkingArea?.code})
                </h2>
                <div className="flex flex-wrap gap-4">
                  {qrData.gates.map((g, i) => (
                    <div key={i} className="border-2 border-[#F05A28] bg-white p-3 text-center w-44">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={g.qr} alt={g.label} className="w-36 h-36 mx-auto" />
                      <p className="text-black text-xs font-bold font-mono mt-2">{g.label}</p>
                      <p className="text-gray-500 text-[8px] mt-1 break-all">{g.url}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Slot QRs */}
            {qrData.slots.length > 0 && (
              <div className="space-y-3 mt-6">
                <h2 className="font-bold font-mono-tech text-sm text-white uppercase border-b border-[#292E38] pb-2 flex items-center gap-2">
                  <Car className="w-4 h-4 text-[#9EB08C]" />
                  SLOT PILLAR QR CODES ({qrData.slots.length} slots)
                </h2>
                <div className="flex flex-wrap gap-3">
                  {qrData.slots.map((s, i) => (
                    <div key={i} className="border-2 border-[#292E38] bg-white p-2 text-center w-36 hover:border-[#9EB08C] transition-colors">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.qr} alt={s.slotNumber} className="w-28 h-28 mx-auto" />
                      <p className="text-black text-[10px] font-bold font-mono mt-1">{s.slotNumber}</p>
                      <p className="text-gray-500 text-[7px] mt-0.5 break-all">{s.url}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      <footer className="max-w-7xl w-full mx-auto text-center py-4 mt-8 text-xs font-mono-tech text-[#71717A] border-t border-[#292E38]">
        PARKSMART // QR SHEET — Each slot QR opens /s/&#123;slotId&#125; for check-in and blocked-car relay
      </footer>
    </div>
  );
}
