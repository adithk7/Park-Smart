'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogoutButton } from '@/components/logout-button';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  CheckCircle2,
  Car,
  Zap,
  Clock,
  IndianRupee,
  ShieldAlert,
  Info,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────
interface TariffSlab {
  id?: string;
  vehicleType: string;
  upToHours: number;
  ratePerHour: number;
  flatFee: number;
  sortOrder?: number;
}

interface ValidationRule {
  id?: string;
  ruleType: string;
  label: string;
  config: string;
  isActive: boolean;
}

interface TariffData {
  id?: string;
  name: string;
  freeMinutes: number;
  gracePeriodMin: number;
  dailyCap: number | null;
  reservationFee: number;
  slabs: TariffSlab[];
  validationRules: ValidationRule[];
}

const defaultTariff: TariffData = {
  name: 'Default Tariff',
  freeMinutes: 15,
  gracePeriodMin: 15,
  dailyCap: null,
  reservationFee: 0,
  slabs: [
    { vehicleType: '4W', upToHours: 3, ratePerHour: 50, flatFee: 0 },
    { vehicleType: '4W', upToHours: 12, ratePerHour: 40, flatFee: 0 },
    { vehicleType: '2W', upToHours: 3, ratePerHour: 20, flatFee: 0 },
    { vehicleType: '2W', upToHours: 12, ratePerHour: 15, flatFee: 0 },
  ],
  validationRules: [
    {
      ruleType: 'MINIMUM_SPEND',
      label: 'Mall Minimum Spend',
      config: JSON.stringify({ minAmount: 200, note: 'Customer must spend ₹200+ at mall to get first 3hrs free' }),
      isActive: true,
    },
    {
      ruleType: 'LINKED_FLIGHT',
      label: 'Airport — Linked Flight',
      config: JSON.stringify({ flightWindowMinutes: 120, note: 'Waive parking fee within 120min of confirmed flight' }),
      isActive: false,
    },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────
function SlabRow({
  slab,
  idx,
  onChange,
  onRemove,
}: {
  slab: TariffSlab;
  idx: number;
  onChange: (idx: number, field: string, val: string | number) => void;
  onRemove: (idx: number) => void;
}) {
  return (
    <div className="grid grid-cols-[90px_80px_110px_110px_36px] gap-2 items-center py-2 border-b border-[#292E38] last:border-0">
      <select
        value={slab.vehicleType}
        onChange={(e) => onChange(idx, 'vehicleType', e.target.value)}
        className="bg-[#0B0E13] border border-[#292E38] text-white px-2 py-1.5 text-xs font-mono-tech focus:border-[#F05A28] outline-none"
      >
        {['4W', '2W', 'EV', 'ACCESSIBLE', 'SUV'].map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
      <input
        type="number" min={0} step={0.5}
        value={slab.upToHours}
        onChange={(e) => onChange(idx, 'upToHours', parseFloat(e.target.value))}
        placeholder="Hrs"
        className="bg-[#0B0E13] border border-[#292E38] text-white px-2 py-1.5 text-xs font-mono-tech focus:border-[#F05A28] outline-none w-full"
      />
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#A1A1AA] text-xs">₹</span>
        <input
          type="number" min={0} step={5}
          value={slab.ratePerHour}
          onChange={(e) => onChange(idx, 'ratePerHour', parseFloat(e.target.value))}
          placeholder="/hr"
          className="bg-[#0B0E13] border border-[#292E38] text-white pl-6 pr-2 py-1.5 text-xs font-mono-tech focus:border-[#F05A28] outline-none w-full"
        />
      </div>
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#A1A1AA] text-xs">₹</span>
        <input
          type="number" min={0} step={10}
          value={slab.flatFee}
          onChange={(e) => onChange(idx, 'flatFee', parseFloat(e.target.value))}
          placeholder="flat"
          className="bg-[#0B0E13] border border-[#292E38] text-white pl-6 pr-2 py-1.5 text-xs font-mono-tech focus:border-[#F05A28] outline-none w-full"
        />
      </div>
      <button onClick={() => onRemove(idx)} className="text-[#71717A] hover:text-[#F05A28] transition-colors">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
export default function TariffPage() {
  const [tariff, setTariff] = useState<TariffData>(defaultTariff);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const flash = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const fetchTariff = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/tariff');
    const json = await res.json();
    if (json.success && json.data) setTariff(json.data);
    else setTariff(defaultTariff);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTariff(); }, [fetchTariff]);

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch('/api/admin/tariff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tariff),
    });
    const json = await res.json();
    setSaving(false);
    if (json.success) { setTariff(json.data); flash('ok', 'Tariff saved successfully'); }
    else flash('err', json.message || 'Save failed');
  };

  const updateField = (field: keyof TariffData, value: any) =>
    setTariff((p) => ({ ...p, [field]: value }));

  const updateSlab = (idx: number, field: string, val: string | number) =>
    setTariff((p) => ({
      ...p,
      slabs: p.slabs.map((s, i) => (i === idx ? { ...s, [field]: val } : s)),
    }));

  const removeSlab = (idx: number) =>
    setTariff((p) => ({ ...p, slabs: p.slabs.filter((_, i) => i !== idx) }));

  const addSlab = () =>
    setTariff((p) => ({
      ...p,
      slabs: [...p.slabs, { vehicleType: '4W', upToHours: 24, ratePerHour: 30, flatFee: 0 }],
    }));

  const updateRule = (idx: number, field: string, val: any) =>
    setTariff((p) => ({
      ...p,
      validationRules: p.validationRules.map((r, i) => (i === idx ? { ...r, [field]: val } : r)),
    }));

  const removeRule = (idx: number) =>
    setTariff((p) => ({ ...p, validationRules: p.validationRules.filter((_, i) => i !== idx) }));

  const addRule = () =>
    setTariff((p) => ({
      ...p,
      validationRules: [...p.validationRules, { ruleType: 'CUSTOM', label: 'New Rule', config: '{}', isActive: true }],
    }));

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0E13] flex items-center justify-center text-[#A1A1AA] font-mono-tech text-xs">
        Loading tariff…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0E13] text-[#F4F4F5] flex flex-col p-4 md:p-8">

      {/* Header */}
      <header className="max-w-4xl w-full mx-auto flex flex-wrap items-center justify-between py-4 border-b border-[#292E38] gap-4 mb-8">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 bg-[#F05A28] inline-block" />
            <span className="font-extrabold text-lg tracking-tighter uppercase font-mono-tech text-[#F4F4F5]">
              PARKSMART<span className="text-[#F05A28]">.SYS</span>
            </span>
          </Link>
          <span className="text-[#71717A] hidden sm:inline">|</span>
          <Badge variant="signal" size="sm">TARIFF ENGINE</Badge>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/layout">
            <Button variant="secondary" size="sm"><ArrowLeft className="w-3.5 h-3.5 mr-1" />LAYOUT</Button>
          </Link>
          <LogoutButton />
        </div>
      </header>

      <main className="max-w-4xl w-full mx-auto space-y-6">

        {msg && (
          <div className={`flex items-center gap-2 px-4 py-2 border font-mono-tech text-xs ${msg.type === 'ok' ? 'bg-[#9EB08C]/10 border-[#9EB08C]/40 text-[#9EB08C]' : 'bg-[#F05A28]/10 border-[#F05A28]/40 text-[#F05A28]'}`}>
            {msg.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {msg.text}
          </div>
        )}

        {/* Tariff Name & Global Settings */}
        <div className="border border-[#292E38] bg-[#121720] p-6 space-y-4">
          <h2 className="text-sm font-bold font-mono-tech text-white uppercase flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-[#F05A28]" /> Global Settings
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-mono-tech text-[#A1A1AA] block mb-1">TARIFF NAME</label>
              <input
                value={tariff.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="w-full bg-[#0B0E13] border border-[#292E38] text-white px-3 py-2 text-xs font-mono-tech focus:border-[#F05A28] outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono-tech text-[#A1A1AA] block mb-1">
                <Clock className="w-3 h-3 inline mr-1" />FREE ENTRY WINDOW (minutes)
              </label>
              <input
                type="number" min={0} max={120}
                value={tariff.freeMinutes}
                onChange={(e) => updateField('freeMinutes', parseInt(e.target.value))}
                className="w-full bg-[#0B0E13] border border-[#292E38] text-white px-3 py-2 text-xs font-mono-tech focus:border-[#F05A28] outline-none"
              />
              <p className="text-[10px] text-[#71717A] mt-1 font-mono-tech">First {tariff.freeMinutes} min are free on entry</p>
            </div>
            <div>
              <label className="text-[10px] font-mono-tech text-[#A1A1AA] block mb-1">
                GRACE WINDOW AFTER PAYMENT (minutes)
              </label>
              <input
                type="number" min={0} max={60}
                value={tariff.gracePeriodMin}
                onChange={(e) => updateField('gracePeriodMin', parseInt(e.target.value))}
                className="w-full bg-[#0B0E13] border border-[#292E38] text-white px-3 py-2 text-xs font-mono-tech focus:border-[#F05A28] outline-none"
              />
              <p className="text-[10px] text-[#71717A] mt-1 font-mono-tech">Vehicle must exit within {tariff.gracePeriodMin} min of payment</p>
            </div>
            <div>
              <label className="text-[10px] font-mono-tech text-[#A1A1AA] block mb-1">DAILY CAP (₹, leave blank = unlimited)</label>
              <input
                type="number" min={0}
                value={tariff.dailyCap ?? ''}
                onChange={(e) => updateField('dailyCap', e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="e.g. 300"
                className="w-full bg-[#0B0E13] border border-[#292E38] text-white px-3 py-2 text-xs font-mono-tech focus:border-[#F05A28] outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono-tech text-[#A1A1AA] block mb-1">RESERVATION FEE (₹)</label>
              <input
                type="number" min={0}
                value={tariff.reservationFee}
                onChange={(e) => updateField('reservationFee', parseFloat(e.target.value))}
                className="w-full bg-[#0B0E13] border border-[#292E38] text-white px-3 py-2 text-xs font-mono-tech focus:border-[#F05A28] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Rate Slabs */}
        <div className="border border-[#292E38] bg-[#121720] p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold font-mono-tech text-white uppercase flex items-center gap-2">
              <Car className="w-4 h-4 text-[#F05A28]" /> Rate Slabs
            </h2>
            <Button variant="secondary" size="sm" onClick={addSlab}>
              <Plus className="w-3 h-3 mr-1" /> ADD SLAB
            </Button>
          </div>

          <div className="text-[10px] font-mono-tech text-[#71717A] mb-2">
            Slabs are evaluated in order. Each slab defines a rate for a vehicle type up to N hours.
          </div>

          <div className="grid grid-cols-[90px_80px_110px_110px_36px] gap-2 text-[10px] font-mono-tech text-[#A1A1AA] pb-1 border-b border-[#292E38]">
            <span>TYPE</span><span>UP TO HRS</span><span>RATE/HR (₹)</span><span>FLAT FEE (₹)</span><span />
          </div>

          {tariff.slabs.length === 0 ? (
            <p className="text-[#71717A] text-xs font-mono-tech">No slabs defined — add one above.</p>
          ) : (
            tariff.slabs.map((slab, idx) => (
              <SlabRow key={idx} slab={slab} idx={idx} onChange={updateSlab} onRemove={removeSlab} />
            ))
          )}

          <div className="bg-[#171D27] border border-[#292E38] p-3 font-mono-tech text-[10px] text-[#A1A1AA] mt-2 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-[#F05A28] shrink-0 mt-0.5" />
            <span>
              Sample: First 15 min free → Up to 3 hrs ₹50/hr → Up to 12 hrs ₹40/hr → Daily cap ₹300. 2W rates apply separately.
            </span>
          </div>
        </div>

        {/* Validation Rules */}
        <div className="border border-[#292E38] bg-[#121720] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold font-mono-tech text-white uppercase flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#F05A28]" /> Validation Rules
            </h2>
            <Button variant="secondary" size="sm" onClick={addRule}>
              <Plus className="w-3 h-3 mr-1" /> ADD RULE
            </Button>
          </div>

          <p className="text-[10px] font-mono-tech text-[#71717A]">
            Special discount or waiver logic, e.g. mall minimum-spend or airport linked-flight bypass.
          </p>

          {tariff.validationRules.length === 0 ? (
            <p className="text-[#71717A] text-xs font-mono-tech">No validation rules.</p>
          ) : (
            tariff.validationRules.map((rule, idx) => (
              <div key={idx} className="border border-[#292E38] bg-[#0B0E13] p-4 space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <select
                    value={rule.ruleType}
                    onChange={(e) => updateRule(idx, 'ruleType', e.target.value)}
                    className="bg-[#121720] border border-[#292E38] text-white px-2 py-1.5 text-xs font-mono-tech focus:border-[#F05A28] outline-none"
                  >
                    <option value="MINIMUM_SPEND">MINIMUM_SPEND</option>
                    <option value="LINKED_FLIGHT">LINKED_FLIGHT</option>
                    <option value="CUSTOM">CUSTOM</option>
                  </select>
                  <input
                    value={rule.label}
                    onChange={(e) => updateRule(idx, 'label', e.target.value)}
                    placeholder="Rule label"
                    className="flex-1 bg-[#121720] border border-[#292E38] text-white px-3 py-1.5 text-xs font-mono-tech focus:border-[#F05A28] outline-none"
                  />
                  <label className="flex items-center gap-1.5 text-xs font-mono-tech text-[#A1A1AA] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rule.isActive}
                      onChange={(e) => updateRule(idx, 'isActive', e.target.checked)}
                      className="accent-[#F05A28]"
                    />
                    ACTIVE
                  </label>
                  <button onClick={() => removeRule(idx)} className="text-[#71717A] hover:text-[#F05A28]">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div>
                  <label className="text-[10px] font-mono-tech text-[#A1A1AA] block mb-1">CONFIG (JSON)</label>
                  <textarea
                    value={rule.config}
                    onChange={(e) => updateRule(idx, 'config', e.target.value)}
                    rows={2}
                    className="w-full bg-[#121720] border border-[#292E38] text-[#9EB08C] px-3 py-2 text-[10px] font-mono-tech focus:border-[#F05A28] outline-none resize-none"
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-3 pb-8">
          <Button variant="primary" size="lg" onClick={handleSave} isLoading={saving}>
            <Save className="w-4 h-4 mr-2" /> SAVE TARIFF
          </Button>
        </div>

      </main>
    </div>
  );
}
