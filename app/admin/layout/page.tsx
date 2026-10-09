'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { LogoutButton } from '@/components/logout-button';
import {
  Layers,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  Grid3X3,
  Car,
  Zap,
  Accessibility,
  Bike,
  Truck,
  AlertCircle,
  CheckCircle2,
  Clock,
  Lock,
  QrCode,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────
interface SlotData {
  id: string;
  slotNumber: string;
  vehicleType: string;
  status: string;
  ownerId: string | null;
  ownerLabel: string | null;
}

interface ZoneData {
  id: string;
  name: string;
  zoneType: string;
  slots: SlotData[];
}

interface LevelData {
  id: string;
  name: string;
  displayOrder: number;
  zones: ZoneData[];
}

// ─── Helpers ──────────────────────────────────────────────────────
const VEHICLE_ICONS: Record<string, React.ReactNode> = {
  '4W': <Car className="w-3 h-3" />,
  '2W': <Bike className="w-3 h-3" />,
  EV: <Zap className="w-3 h-3" />,
  ACCESSIBLE: <Accessibility className="w-3 h-3" />,
  SUV: <Truck className="w-3 h-3" />,
};

const STATUS_STYLES: Record<string, string> = {
  FREE: 'bg-[#9EB08C]/20 border-[#9EB08C]/40 text-[#9EB08C]',
  OCCUPIED: 'bg-[#F05A28]/20 border-[#F05A28]/50 text-[#F05A28]',
  RESERVED: 'bg-blue-500/15 border-blue-500/40 text-blue-400',
  BLOCKED: 'bg-[#292E38] border-[#3E4552] text-[#71717A]',
};

const ZONE_TYPE_LABELS: Record<string, string> = {
  VISITOR_POOL: 'Visitor Pool',
  RESIDENT_ASSIGNED: 'Resident Assigned',
  OVERFLOW: 'Overflow (No Sensors)',
};

function SlotCell({
  slot,
  onStatusChange,
}: {
  slot: SlotData;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const statusClass = STATUS_STYLES[slot.status] ?? STATUS_STYLES.FREE;

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((p) => !p)}
        title={`${slot.slotNumber} — ${slot.status}`}
        className={`w-14 h-10 border text-[9px] font-mono-tech font-bold flex flex-col items-center justify-center gap-0.5 transition-all duration-150 hover:scale-105 hover:z-10 relative ${statusClass}`}
      >
        {VEHICLE_ICONS[slot.vehicleType] || <Car className="w-3 h-3" />}
        <span className="leading-none truncate w-full text-center px-0.5">
          {slot.slotNumber.split('-').pop()}
        </span>
      </button>
      {menuOpen && (
        <div className="absolute top-full left-0 z-50 mt-1 w-36 bg-[#121720] border border-[#292E38] shadow-xl text-xs font-mono-tech">
          <div className="px-2 py-1.5 text-[10px] text-[#A1A1AA] border-b border-[#292E38]">
            {slot.slotNumber}
          </div>
          {['FREE', 'OCCUPIED', 'RESERVED', 'BLOCKED'].map((s) => (
            <button
              key={s}
              onClick={() => { onStatusChange(slot.id, s); setMenuOpen(false); }}
              className={`block w-full text-left px-3 py-1.5 hover:bg-[#171D27] transition-colors ${slot.status === s ? 'text-[#F05A28]' : 'text-[#F4F4F5]'}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
export default function LayoutBuilderPage() {
  const [levels, setLevels] = useState<LevelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());

  // Forms
  const [newLevelName, setNewLevelName] = useState('');
  const [newZone, setNewZone] = useState({ levelId: '', name: '', zoneType: 'VISITOR_POOL' });
  const [bulkGen, setBulkGen] = useState({
    zoneId: '', levelName: '', zoneName: '', count: 12, vehicleType: '4W',
  });
  const [showAddZone, setShowAddZone] = useState<string | null>(null);
  const [showBulkGen, setShowBulkGen] = useState<string | null>(null);

  const flash = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const fetchLayout = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/layout');
      const json = await res.json();
      if (json.success) {
        setLevels(json.data.levels);
        setExpandedLevels(new Set(json.data.levels.map((l: LevelData) => l.id)));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLayout(); }, [fetchLayout]);

  const post = async (payload: object) => {
    const res = await fetch('/api/admin/layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  };

  const handleCreateLevel = async () => {
    if (!newLevelName.trim()) return;
    setSaving(true);
    const json = await post({ action: 'CREATE_LEVEL', name: newLevelName, displayOrder: levels.length });
    setSaving(false);
    if (json.success) { setNewLevelName(''); fetchLayout(); flash('ok', `Level "${json.data.name}" created`); }
    else flash('err', json.message);
  };

  const handleCreateZone = async () => {
    if (!newZone.levelId || !newZone.name.trim()) return;
    setSaving(true);
    const json = await post({ action: 'CREATE_ZONE', ...newZone });
    setSaving(false);
    if (json.success) { setNewZone({ levelId: '', name: '', zoneType: 'VISITOR_POOL' }); setShowAddZone(null); fetchLayout(); flash('ok', `Zone "${json.data.name}" created`); }
    else flash('err', json.message);
  };

  const handleBulkGenerate = async () => {
    if (!bulkGen.zoneId || bulkGen.count < 1) return;
    setSaving(true);
    const json = await post({ action: 'BULK_GENERATE_SLOTS', ...bulkGen });
    setSaving(false);
    if (json.success) { setShowBulkGen(null); fetchLayout(); flash('ok', `Generated ${json.data.created} slots (${json.data.prefix}-XX)`); }
    else flash('err', json.message);
  };

  const handleStatusChange = async (slotId: string, status: string) => {
    const json = await post({ action: 'UPDATE_SLOT', slotId, status });
    if (json.success) fetchLayout();
    else flash('err', json.message);
  };

  const handleDelete = async (type: string, id: string) => {
    if (!confirm(`Delete this ${type}? All children will also be removed.`)) return;
    setSaving(true);
    const res = await fetch(`/api/admin/layout?type=${type}&id=${id}`, { method: 'DELETE' });
    const json = await res.json();
    setSaving(false);
    if (json.success) { fetchLayout(); flash('ok', `${type} deleted`); }
    else flash('err', json.message);
  };

  const toggleLevel = (id: string) => {
    setExpandedLevels((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const totalSlots = levels.reduce((a, l) => a + l.zones.reduce((b, z) => b + z.slots.length, 0), 0);
  const freeSlots = levels.reduce((a, l) => a + l.zones.reduce((b, z) => b + z.slots.filter(s => s.status === 'FREE').length, 0), 0);

  return (
    <div className="min-h-screen bg-[#0B0E13] text-[#F4F4F5] flex flex-col p-4 md:p-8">

      {/* Header */}
      <header className="max-w-7xl w-full mx-auto flex flex-wrap items-center justify-between py-4 border-b border-[#292E38] gap-4 mb-8">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="flex items-center gap-2 group">
            <span className="w-3.5 h-3.5 bg-[#F05A28] inline-block" />
            <span className="font-extrabold text-lg tracking-tighter uppercase font-mono-tech text-[#F4F4F5]">
              PARKSMART<span className="text-[#F05A28]">.SYS</span>
            </span>
          </Link>
          <span className="text-[#71717A] hidden sm:inline">|</span>
          <Badge variant="signal" size="sm">LAYOUT BUILDER</Badge>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/tariff">
            <Button variant="secondary" size="sm">TARIFF RULES →</Button>
          </Link>
          <Link href="/admin/qr">
            <Button variant="secondary" size="sm"><QrCode className="w-3.5 h-3.5 mr-1.5" />QR SHEET</Button>
          </Link>
          <Link href="/admin">
            <Button variant="outline" size="sm"><ArrowLeft className="w-3.5 h-3.5 mr-1" />DASHBOARD</Button>
          </Link>
          <LogoutButton />
        </div>
      </header>

      <main className="max-w-7xl w-full mx-auto space-y-6">

        {/* Status bar */}
        {msg && (
          <div className={`flex items-center gap-2 px-4 py-2 border font-mono-tech text-xs ${msg.type === 'ok' ? 'bg-[#9EB08C]/10 border-[#9EB08C]/40 text-[#9EB08C]' : 'bg-[#F05A28]/10 border-[#F05A28]/40 text-[#F05A28]'}`}>
            {msg.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {msg.text}
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono-tech text-xs">
          {[
            { label: 'LEVELS', val: levels.length, color: 'text-white' },
            { label: 'ZONES', val: levels.reduce((a, l) => a + l.zones.length, 0), color: 'text-white' },
            { label: 'TOTAL SLOTS', val: totalSlots, color: 'text-white' },
            { label: 'FREE', val: freeSlots, color: 'text-[#9EB08C]' },
          ].map((s) => (
            <div key={s.label} className="border border-[#292E38] bg-[#121720] p-4">
              <span className="text-[#A1A1AA] block mb-1">{s.label}</span>
              <span className={`text-2xl font-extrabold ${s.color}`}>{s.val}</span>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 font-mono-tech text-[10px]">
          {Object.entries(STATUS_STYLES).map(([k, v]) => (
            <div key={k} className={`flex items-center gap-1.5 px-2 py-1 border ${v}`}>
              <span className="w-2 h-2 rounded-full bg-current" />{k}
            </div>
          ))}
          <div className="flex items-center gap-2 ml-auto text-[#A1A1AA]">
            <span>Click a slot cell to change status</span>
          </div>
        </div>

        {/* Add Level Form */}
        <div className="border border-[#292E38] bg-[#121720] p-4">
          <h2 className="text-sm font-bold font-mono-tech text-white uppercase mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#F05A28]" /> Add New Level
          </h2>
          <div className="flex gap-3">
            <Input
              label=""
              placeholder='e.g. "Level 1" or "Basement 1"'
              value={newLevelName}
              onChange={(e) => setNewLevelName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateLevel()}
              className="flex-1"
            />
            <Button variant="primary" size="md" onClick={handleCreateLevel} isLoading={saving} disabled={!newLevelName.trim()}>
              <Plus className="w-4 h-4 mr-1" /> ADD LEVEL
            </Button>
          </div>
        </div>

        {/* Level Tree */}
        {loading ? (
          <div className="flex items-center justify-center py-16 font-mono-tech text-[#A1A1AA] text-xs">
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Loading layout…
          </div>
        ) : levels.length === 0 ? (
          <div className="border border-dashed border-[#292E38] text-center py-16 text-[#71717A] font-mono-tech text-xs">
            No levels yet — add your first level above.
          </div>
        ) : (
          <div className="space-y-4">
            {levels.map((level) => (
              <div key={level.id} className="border border-[#292E38] bg-[#121720]">

                {/* Level Header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-[#292E38]">
                  <button onClick={() => toggleLevel(level.id)} className="flex items-center gap-2 flex-1 text-left">
                    {expandedLevels.has(level.id)
                      ? <ChevronDown className="w-4 h-4 text-[#A1A1AA]" />
                      : <ChevronRight className="w-4 h-4 text-[#A1A1AA]" />}
                    <span className="font-extrabold text-white uppercase font-mono-tech tracking-wide">{level.name}</span>
                    <Badge variant="neutral" size="sm">{level.zones.length} zones</Badge>
                    <Badge variant="olive" size="sm">{level.zones.reduce((a, z) => a + z.slots.length, 0)} slots</Badge>
                  </button>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary" size="sm"
                      onClick={() => { setShowAddZone(showAddZone === level.id ? null : level.id); setNewZone({ levelId: level.id, name: '', zoneType: 'VISITOR_POOL' }); }}
                    >
                      <Plus className="w-3 h-3 mr-1" /> ZONE
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete('level', level.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {/* Add Zone Form */}
                {showAddZone === level.id && (
                  <div className="px-4 py-3 border-b border-[#292E38] bg-[#171D27] flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[160px]">
                      <label className="text-[10px] font-mono-tech text-[#A1A1AA] block mb-1">ZONE NAME</label>
                      <input
                        value={newZone.name}
                        onChange={(e) => setNewZone(p => ({ ...p, name: e.target.value }))}
                        placeholder='e.g. "Zone A"'
                        className="w-full bg-[#0B0E13] border border-[#292E38] text-white px-3 py-2 text-xs font-mono-tech outline-none focus:border-[#F05A28]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono-tech text-[#A1A1AA] block mb-1">TYPE</label>
                      <select
                        value={newZone.zoneType}
                        onChange={(e) => setNewZone(p => ({ ...p, zoneType: e.target.value }))}
                        className="bg-[#0B0E13] border border-[#292E38] text-white px-3 py-2 text-xs font-mono-tech outline-none focus:border-[#F05A28]"
                      >
                        <option value="VISITOR_POOL">Visitor Pool</option>
                        <option value="RESIDENT_ASSIGNED">Resident Assigned</option>
                        <option value="OVERFLOW">Overflow (No Sensors)</option>
                      </select>
                    </div>
                    <Button variant="primary" size="sm" onClick={handleCreateZone} isLoading={saving}>CREATE ZONE</Button>
                    <Button variant="outline" size="sm" onClick={() => setShowAddZone(null)}>CANCEL</Button>
                  </div>
                )}

                {/* Zones */}
                {expandedLevels.has(level.id) && (
                  <div className="p-4 space-y-6">
                    {level.zones.length === 0 ? (
                      <p className="text-[#71717A] text-xs font-mono-tech">No zones — click "+ ZONE" to add one.</p>
                    ) : (
                      level.zones.map((zone) => (
                        <div key={zone.id} className="border border-[#292E38] bg-[#0B0E13]">

                          {/* Zone Header */}
                          <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-b border-[#292E38]">
                            <Grid3X3 className="w-4 h-4 text-[#A1A1AA]" />
                            <span className="font-bold font-mono-tech text-white text-sm">{zone.name}</span>
                            <Badge
                              variant={zone.zoneType === 'OVERFLOW' ? 'neutral' : zone.zoneType === 'RESIDENT_ASSIGNED' ? 'info' : 'olive'}
                              size="sm"
                            >
                              {ZONE_TYPE_LABELS[zone.zoneType]}
                            </Badge>
                            <Badge variant="neutral" size="sm">{zone.slots.length} slots</Badge>
                            <div className="ml-auto flex gap-2">
                              <Button
                                variant="secondary" size="sm"
                                onClick={() => {
                                  setShowBulkGen(showBulkGen === zone.id ? null : zone.id);
                                  setBulkGen({ zoneId: zone.id, levelName: level.name, zoneName: zone.name, count: 12, vehicleType: '4W' });
                                }}
                              >
                                <Plus className="w-3 h-3 mr-1" /> BULK SLOTS
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleDelete('zone', zone.id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>

                          {/* Bulk Generate Form */}
                          {showBulkGen === zone.id && (
                            <div className="px-4 py-3 border-b border-[#292E38] bg-[#121720] flex flex-wrap gap-3 items-end">
                              <div>
                                <label className="text-[10px] font-mono-tech text-[#A1A1AA] block mb-1">COUNT (1-200)</label>
                                <input
                                  type="number" min={1} max={200}
                                  value={bulkGen.count}
                                  onChange={(e) => setBulkGen(p => ({ ...p, count: Number(e.target.value) }))}
                                  className="w-20 bg-[#0B0E13] border border-[#292E38] text-white px-3 py-2 text-xs font-mono-tech outline-none focus:border-[#F05A28]"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-mono-tech text-[#A1A1AA] block mb-1">VEHICLE TYPE</label>
                                <select
                                  value={bulkGen.vehicleType}
                                  onChange={(e) => setBulkGen(p => ({ ...p, vehicleType: e.target.value }))}
                                  className="bg-[#0B0E13] border border-[#292E38] text-white px-3 py-2 text-xs font-mono-tech outline-none focus:border-[#F05A28]"
                                >
                                  <option value="4W">4W (Car)</option>
                                  <option value="2W">2W (Bike)</option>
                                  <option value="EV">EV</option>
                                  <option value="ACCESSIBLE">Accessible</option>
                                  <option value="SUV">SUV</option>
                                </select>
                              </div>
                              <div className="text-xs font-mono-tech text-[#A1A1AA] self-center">
                                → will generate <strong className="text-white">{bulkGen.count}</strong> slots prefixed{' '}
                                <span className="text-[#F05A28]">
                                  {level.name.replace(/\s+/g,'').toUpperCase()}-{zone.name.replace(/\s+/g,'').toUpperCase()}-XX
                                </span>
                              </div>
                              <Button variant="primary" size="sm" onClick={handleBulkGenerate} isLoading={saving}>GENERATE</Button>
                              <Button variant="outline" size="sm" onClick={() => setShowBulkGen(null)}>CANCEL</Button>
                            </div>
                          )}

                          {/* Slot Grid */}
                          <div className="p-4">
                            {zone.slots.length === 0 ? (
                              <p className="text-[#71717A] text-[10px] font-mono-tech">No slots — click "+ BULK SLOTS" to generate.</p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {zone.slots.map((slot) => (
                                  <SlotCell key={slot.id} slot={slot} onStatusChange={handleStatusChange} />
                                ))}
                              </div>
                            )}
                          </div>

                        </div>
                      ))
                    )}
                  </div>
                )}

              </div>
            ))}
          </div>
        )}

      </main>

      <footer className="max-w-7xl w-full mx-auto text-center py-4 mt-8 text-xs font-mono-tech text-[#71717A] border-t border-[#292E38]">
        PARKSMART // LAYOUT BUILDER — Click any slot cell to change status • Click "+ BULK SLOTS" to mass-generate bays
      </footer>
    </div>
  );
}
