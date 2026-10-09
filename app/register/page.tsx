'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Check, 
  Copy, 
  ArrowRight, 
  ArrowLeft, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Key,
  Zap,
  Sparkles,
  AlertTriangle,
  Car,
  Bike
} from 'lucide-react';

interface FormState {
  // Step 1
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  // Step 2
  parkingAreaName: string;
  city: string;
  address: string;
  venueType: 'TRANSIENT' | 'RECURRING' | 'BOTH';
  siteTier: number;
  levels: number;
  totalSlots: number;
  twoWheelerCapacity: number;
  fourWheelerCapacity: number;
  otherCapacity: number;
  hourlyRate2W: number;
  hourlyRate4W: number;
  evChargingAvailable: boolean;
  evPointsCount: number;
  evHourlyRate: number;
  carWashAvailable: boolean;
  carWashRate: number;
  openingTime: string;
  closingTime: string;
  staffPassword: string;
}

const initialForm: FormState = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  parkingAreaName: '',
  city: '',
  address: '',
  venueType: 'BOTH',
  siteTier: 2,
  levels: 1,
  totalSlots: 100,
  twoWheelerCapacity: 60,
  fourWheelerCapacity: 40,
  otherCapacity: 0,
  hourlyRate2W: 15.0,
  hourlyRate4W: 30.0,
  evChargingAvailable: true,
  evPointsCount: 5,
  evHourlyRate: 50.0,
  carWashAvailable: true,
  carWashRate: 150.0,
  openingTime: '00:00',
  closingTime: '23:59',
  staffPassword: '',
};

export default function RegisterPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [successData, setSuccessData] = useState<{
    code: string;
    name: string;
    city: string;
    adminEmail: string;
    tier: number;
    slots: number;
  } | null>(null);

  const updateField = (field: keyof FormState, value: any) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-adjust 4W capacity if totalSlots changed to keep 2W + 4W + other = total
      if (field === 'totalSlots') {
        const total = Math.max(1, Number(value));
        const twoW = Math.min(total, prev.twoWheelerCapacity);
        const fourW = Math.max(0, total - twoW - prev.otherCapacity);
        next.twoWheelerCapacity = twoW;
        next.fourWheelerCapacity = fourW;
      }
      return next;
    });

    if (errors[field] || errors.totalSlots) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        delete next.totalSlots;
        return next;
      });
    }
  };

  const sumCapacities = form.twoWheelerCapacity + form.fourWheelerCapacity + form.otherCapacity;
  const isCapacityMatching = sumCapacities === form.totalSlots;

  const validateStep1 = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) {
      errs.name = 'Please enter your full name (at least 2 characters)';
    }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Please enter a valid email address';
    }
    if (!form.password || form.password.length < 8) {
      errs.password = 'Password must be at least 8 characters long';
    }
    if (form.password !== form.confirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs: Record<string, string> = {};
    if (!form.parkingAreaName.trim() || form.parkingAreaName.trim().length < 2) {
      errs.parkingAreaName = 'Parking area name is required';
    }
    if (!form.city.trim() || form.city.trim().length < 2) {
      errs.city = 'City is required';
    }
    if (!form.address.trim() || form.address.trim().length < 3) {
      errs.address = 'Address is required';
    }
    if (!form.levels || form.levels < 1) {
      errs.levels = 'At least 1 level is required';
    }
    if (!form.totalSlots || form.totalSlots < 1) {
      errs.totalSlots = 'Must have at least 1 parking slot';
    }
    if (!isCapacityMatching) {
      errs.totalSlots = `Capacity mismatch: Two-wheeler (${form.twoWheelerCapacity}) + Four-wheeler (${form.fourWheelerCapacity}) + Other (${form.otherCapacity}) = ${sumCapacities}, which does not match Total Capacity (${form.totalSlots})`;
    }
    if (!form.staffPassword || form.staffPassword.length < 4) {
      errs.staffPassword = 'Staff shared password must be at least 4 characters';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNextToStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateStep1()) {
      setStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep2()) return;

    setLoading(true);
    setErrors({});

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.errors) {
          setErrors(data.errors);
          if (data.errors.name || data.errors.email || data.errors.password || data.errors.confirmPassword) {
            setStep(1);
          }
        } else {
          setErrors({ general: data.message || 'Registration failed. Please try again.' });
        }
        setLoading(false);
        return;
      }

      setSuccessData({
        code: data.data.parkingArea.code,
        name: data.data.parkingArea.name,
        city: data.data.parkingArea.city,
        adminEmail: data.data.user.email,
        tier: data.data.parkingArea.tier,
        slots: data.data.parkingArea.totalCapacity,
      });

      setStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setErrors({ general: 'Network connection error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const copyCodeToClipboard = () => {
    if (successData?.code) {
      navigator.clipboard.writeText(successData.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E13] text-[#F4F4F5] flex flex-col justify-between p-4 md:p-8">
      
      {/* Top Header */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between py-4 border-b border-[#292E38]">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="w-3.5 h-3.5 bg-[#F05A28] inline-block transition-transform duration-200 group-hover:scale-110" />
          <div className="flex flex-col">
            <span className="font-extrabold text-lg tracking-tighter uppercase font-mono-tech leading-none text-[#F4F4F5]">
              PARKSMART<span className="text-[#F05A28]">.SYS</span>
            </span>
            <span className="text-[9px] font-mono-tech text-[#A1A1AA] tracking-widest uppercase">
              FACILITY ONBOARDING
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="outline" size="sm">LOGIN TO PORTAL</Button>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl w-full mx-auto my-8">
        
        {/* Step Progress Header */}
        {step !== 3 && (
          <div className="mb-8">
            <div className="flex items-center justify-between max-w-xs mx-auto mb-4 font-mono-tech text-xs">
              <div className="flex items-center gap-2">
                <span className={`w-6 h-6 flex items-center justify-center font-bold ${
                  step >= 1 ? 'bg-[#F05A28] text-white' : 'bg-[#171D27] text-[#71717A]'
                }`}>
                  01
                </span>
                <span className={step === 1 ? 'font-bold text-[#F4F4F5]' : 'text-[#71717A]'}>ADMIN</span>
              </div>
              <div className={`h-0.5 w-12 ${step === 2 ? 'bg-[#F05A28]' : 'bg-[#292E38]'}`} />
              <div className="flex items-center gap-2">
                <span className={`w-6 h-6 flex items-center justify-center font-bold ${
                  step === 2 ? 'bg-[#F05A28] text-white' : 'bg-[#171D27] text-[#71717A]'
                }`}>
                  02
                </span>
                <span className={step === 2 ? 'font-bold text-[#F4F4F5]' : 'text-[#71717A]'}>VENUE</span>
              </div>
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-extrabold text-[#F4F4F5] uppercase tracking-tight">
                {step === 1 ? '01 // Administrator Account' : '02 // Facility Parameters'}
              </h1>
              <p className="text-sm text-[#A1A1AA] mt-1 font-mono-tech">
                {step === 1 
                  ? '[CREATE PRIMARY GOVERNANCE CREDENTIALS]' 
                  : '[DEFINE HARDWARE TIER, CAPACITY & STAFF SHARED PASS]'}
              </p>
            </div>
          </div>
        )}

        {/* General Error Banner */}
        {errors.general && (
          <div className="mb-6 p-4 bg-[#B91C1C]/20 border border-[#B91C1C] text-[#F87171] text-xs font-mono-tech flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 flex-shrink-0" />
            <span>{errors.general}</span>
          </div>
        )}

        {/* STEP 1: Admin Account */}
        {step === 1 && (
          <div className="border border-[#292E38] bg-[#121720] p-6 sm:p-8 shadow-2xl">
            <form onSubmit={handleNextToStep2} className="space-y-6">
              <div>
                <span className="font-mono-tech text-xs text-[#F05A28] font-bold block mb-1">
                  GOVERNANCE CREDENTIALS
                </span>
                <h2 className="text-xl font-bold uppercase text-[#F4F4F5]">Administrator Identity</h2>
                <p className="text-xs text-[#A1A1AA] mt-1">
                  Full owner privileges for tariffs, revenue analytics, and security policies.
                </p>
              </div>

              <div className="space-y-4">
                <Input
                  label="Full Name"
                  placeholder="e.g. Vikram Sharma"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  error={errors.name}
                  required
                />

                <Input
                  label="Administrator Email Address"
                  type="email"
                  placeholder="e.g. admin@phoenixcitadel.com"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  error={errors.email}
                  helperText="Primary identifier for dashboard sign-in."
                  required
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <Input
                      label="Admin Password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min 8 characters"
                      value={form.password}
                      onChange={(e) => updateField('password', e.target.value)}
                      error={errors.password}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-7 text-[#71717A] hover:text-[#F4F4F5] transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <Input
                    label="Confirm Password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Repeat password"
                    value={form.confirmPassword}
                    onChange={(e) => updateField('confirmPassword', e.target.value)}
                    error={errors.confirmPassword}
                    required
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[#292E38] flex items-center justify-between">
                <Link href="/" className="text-xs font-mono-tech text-[#A1A1AA] hover:text-[#F4F4F5] flex items-center gap-1 transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> BACK TO HOME
                </Link>
                <Button type="submit" variant="primary" size="lg">
                  NEXT: FACILITY SPECS <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 2: Parking Space Setup */}
        {step === 2 && (
          <div className="border border-[#292E38] bg-[#121720] p-6 sm:p-8 shadow-2xl space-y-6">
            <form onSubmit={handleFinalSubmit} className="space-y-6 font-mono-tech">
              <div>
                <span className="text-xs text-[#F05A28] font-bold block mb-1 uppercase">
                  SPATIAL PARAMETERS & CAPACITY SPLIT
                </span>
                <h2 className="text-xl font-bold uppercase text-[#F4F4F5]">Facility Configuration</h2>
                <p className="text-xs text-[#A1A1AA] mt-1">
                  Specify 2-wheeler & 4-wheeler capacity split, hourly pricing, and EV charging settings.
                </p>
              </div>

              <div className="space-y-6">
                
                {/* Name & City */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Facility Name"
                    placeholder="e.g. City Mall Parking"
                    value={form.parkingAreaName}
                    onChange={(e) => updateField('parkingAreaName', e.target.value)}
                    error={errors.parkingAreaName}
                    required
                  />
                  <Input
                    label="City / Region"
                    placeholder="e.g. Bengaluru"
                    value={form.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    error={errors.city}
                    required
                  />
                </div>

                <Input
                  label="Full Facility Address"
                  placeholder="e.g. 26/1 Dr Rajkumar Road, Phase 2"
                  value={form.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  error={errors.address}
                  required
                />

                {/* Operating Hours */}
                <div className="grid grid-cols-2 gap-4 bg-[#171D27] p-4 border border-[#292E38]">
                  <div>
                    <label className="text-xs text-zinc-400 uppercase font-bold block mb-1">Opening Time</label>
                    <input
                      type="time"
                      value={form.openingTime}
                      onChange={(e) => updateField('openingTime', e.target.value)}
                      className="w-full bg-[#121720] border border-[#292E38] text-white p-2.5 text-xs focus:outline-none focus:border-[#F05A28]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 uppercase font-bold block mb-1">Closing Time</label>
                    <input
                      type="time"
                      value={form.closingTime}
                      onChange={(e) => updateField('closingTime', e.target.value)}
                      className="w-full bg-[#121720] border border-[#292E38] text-white p-2.5 text-xs focus:outline-none focus:border-[#F05A28]"
                    />
                  </div>
                </div>

                {/* CAPACITY SPLIT SECTION */}
                <div className="bg-[#171D27] p-4 border border-[#292E38] space-y-4">
                  <div className="flex items-center justify-between border-b border-[#292E38] pb-2">
                    <span className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
                      <Car className="w-4 h-4 text-[#F05A28]" /> Capacity Breakdown & Slot Generation
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 border ${
                        isCapacityMatching
                          ? 'border-emerald-500/50 bg-emerald-950/30 text-emerald-300'
                          : 'border-rose-500/50 bg-rose-950/30 text-rose-300'
                      }`}
                    >
                      {isCapacityMatching
                        ? `✓ ${sumCapacities} / ${form.totalSlots} BAYS MATCHED`
                        : `⚠ SUM (${sumCapacities}) ≠ TOTAL (${form.totalSlots})`}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="text-zinc-400 uppercase block mb-1">Total Capacity</label>
                      <input
                        type="number"
                        min={1}
                        max={10000}
                        value={form.totalSlots}
                        onChange={(e) => updateField('totalSlots', Math.max(1, parseInt(e.target.value) || 0))}
                        className="w-full bg-[#121720] border border-[#292E38] text-white p-2.5 font-bold text-sm focus:outline-none focus:border-[#F05A28]"
                      />
                    </div>

                    <div>
                      <label className="text-zinc-400 uppercase block mb-1">2-Wheeler (B001..)</label>
                      <input
                        type="number"
                        min={0}
                        max={form.totalSlots}
                        value={form.twoWheelerCapacity}
                        onChange={(e) => updateField('twoWheelerCapacity', Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full bg-[#121720] border border-[#292E38] text-white p-2.5 font-bold text-sm focus:outline-none focus:border-[#F05A28]"
                      />
                    </div>

                    <div>
                      <label className="text-zinc-400 uppercase block mb-1">4-Wheeler (C001..)</label>
                      <input
                        type="number"
                        min={0}
                        max={form.totalSlots}
                        value={form.fourWheelerCapacity}
                        onChange={(e) => updateField('fourWheelerCapacity', Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full bg-[#121720] border border-[#292E38] text-white p-2.5 font-bold text-sm focus:outline-none focus:border-[#F05A28]"
                      />
                    </div>

                    <div>
                      <label className="text-zinc-400 uppercase block mb-1">Other (O001..)</label>
                      <input
                        type="number"
                        min={0}
                        max={form.totalSlots}
                        value={form.otherCapacity}
                        onChange={(e) => updateField('otherCapacity', Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full bg-[#121720] border border-[#292E38] text-white p-2.5 font-bold text-sm focus:outline-none focus:border-[#F05A28]"
                      />
                    </div>
                  </div>

                  {errors.totalSlots && (
                    <div className="p-2.5 border border-rose-500/40 bg-rose-950/30 text-rose-300 text-xs">
                      {errors.totalSlots}
                    </div>
                  )}
                </div>

                {/* HOURLY RATES SECTION */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-zinc-400 uppercase font-bold block mb-1">2-Wheeler Hourly Rate (₹/hr)</label>
                    <input
                      type="number"
                      min={0}
                      value={form.hourlyRate2W}
                      onChange={(e) => updateField('hourlyRate2W', Math.max(0, Number(e.target.value)))}
                      className="w-full bg-[#171D27] border border-[#292E38] text-white p-2.5 text-xs font-bold focus:outline-none focus:border-[#F05A28]"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400 uppercase font-bold block mb-1">4-Wheeler Hourly Rate (₹/hr)</label>
                    <input
                      type="number"
                      min={0}
                      value={form.hourlyRate4W}
                      onChange={(e) => updateField('hourlyRate4W', Math.max(0, Number(e.target.value)))}
                      className="w-full bg-[#171D27] border border-[#292E38] text-white p-2.5 text-xs font-bold focus:outline-none focus:border-[#F05A28]"
                    />
                  </div>
                </div>

                {/* EV CHARGING & CAR WASH CONFIG */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* EV Config */}
                  <div className="bg-[#171D27] p-4 border border-[#292E38] space-y-3">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-xs font-bold text-amber-400 uppercase flex items-center gap-1.5">
                        <Zap className="w-4 h-4" /> EV Charging Supported
                      </span>
                      <input
                        type="checkbox"
                        checked={form.evChargingAvailable}
                        onChange={(e) => updateField('evChargingAvailable', e.target.checked)}
                        className="accent-amber-400 w-4 h-4"
                      />
                    </label>

                    {form.evChargingAvailable && (
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div>
                          <label className="text-[10px] text-zinc-400 uppercase block mb-1">EV Points Count</label>
                          <input
                            type="number"
                            min={1}
                            value={form.evPointsCount}
                            onChange={(e) => updateField('evPointsCount', Math.max(1, parseInt(e.target.value) || 0))}
                            className="w-full bg-[#121720] border border-[#292E38] text-white p-2 text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-400 uppercase block mb-1">EV Rate (₹/hr)</label>
                          <input
                            type="number"
                            min={0}
                            value={form.evHourlyRate}
                            onChange={(e) => updateField('evHourlyRate', Math.max(0, Number(e.target.value)))}
                            className="w-full bg-[#121720] border border-[#292E38] text-white p-2 text-xs font-bold text-amber-400"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Car Wash Config */}
                  <div className="bg-[#171D27] p-4 border border-[#292E38] space-y-3">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-xs font-bold text-blue-400 uppercase flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" /> Car Wash Service
                      </span>
                      <input
                        type="checkbox"
                        checked={form.carWashAvailable}
                        onChange={(e) => updateField('carWashAvailable', e.target.checked)}
                        className="accent-blue-400 w-4 h-4"
                      />
                    </label>

                    {form.carWashAvailable && (
                      <div className="text-xs pt-1">
                        <label className="text-[10px] text-zinc-400 uppercase block mb-1">Car Wash Price (₹)</label>
                        <input
                          type="number"
                          min={0}
                          value={form.carWashRate}
                          onChange={(e) => updateField('carWashRate', Math.max(0, Number(e.target.value)))}
                          className="w-full bg-[#121720] border border-[#292E38] text-white p-2 text-xs font-bold text-blue-400"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Staff Shared Password */}
                <div className="bg-[#171D27] p-4 border border-[#292E38] space-y-2">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-[#F05A28]" />
                    <span className="text-xs font-mono-tech font-bold uppercase text-[#F4F4F5]">
                      Staff Terminal Shared Password
                    </span>
                  </div>
                  <p className="text-xs text-[#A1A1AA]">
                    Gate attendants and ground staff log in using the unique <strong>Parking Area Code + Staff Password</strong> without needing individual email accounts.
                  </p>
                  <div className="relative">
                    <Input
                      type={showStaffPassword ? 'text' : 'password'}
                      placeholder="e.g. gatePass2026"
                      value={form.staffPassword}
                      onChange={(e) => updateField('staffPassword', e.target.value)}
                      error={errors.staffPassword}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowStaffPassword(!showStaffPassword)}
                      className="absolute right-3.5 top-3 text-[#71717A] hover:text-[#F4F4F5] transition-colors"
                    >
                      {showStaffPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

              </div>

              <div className="pt-4 border-t border-[#292E38] flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setStep(1)}
                  disabled={loading}
                >
                  <ArrowLeft className="w-4 h-4 mr-1" /> PREVIOUS STEP
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={loading}
                  disabled={!isCapacityMatching}
                >
                  COMPLETE ONBOARDING <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 3: Success Screen */}
        {step === 3 && successData && (
          <div className="border border-[#292E38] bg-[#121720] p-8 sm:p-12 text-center shadow-2xl font-mono-tech space-y-6">
            <div className="w-16 h-16 bg-[#9EB08C]/20 border border-[#9EB08C] text-[#9EB08C] flex items-center justify-center mx-auto rounded-full">
              <Check className="w-8 h-8" />
            </div>

            <div>
              <span className="text-xs text-[#9EB08C] font-bold block mb-1">ONBOARDING SUCCESSFUL</span>
              <h1 className="text-3xl font-extrabold text-white uppercase">{successData.name}</h1>
              <p className="text-xs text-zinc-400 mt-1">
                Your parking facility has been registered and individual slot records (`B001..` & `C001..`) generated.
              </p>
            </div>

            <div className="bg-[#171D27] p-4 border border-[#292E38] max-w-md mx-auto text-left text-xs space-y-2">
              <div className="flex justify-between border-b border-[#292E38] pb-1.5">
                <span className="text-zinc-400">FACILITY CODE:</span>
                <span className="font-bold text-[#F05A28] text-sm">{successData.code}</span>
              </div>
              <div className="flex justify-between border-b border-[#292E38] pb-1.5">
                <span className="text-zinc-400">ADMIN EMAIL:</span>
                <span className="font-bold text-white">{successData.adminEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">GENERATED BAYS:</span>
                <span className="font-bold text-[#9EB08C]">{successData.slots} BAYS</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <Link href="/login">
                <Button variant="primary" size="lg">
                  LOGIN TO ADMIN COCKPIT &rarr;
                </Button>
              </Link>
            </div>
          </div>
        )}

      </main>

      <footer className="max-w-4xl w-full mx-auto text-center py-4 text-xs font-mono-tech text-[#71717A] border-t border-[#292E38]">
        PARKSMART FACILITY ONBOARDING &bull; AUTOMATED B001 & C001 SLOT GENERATION
      </footer>
    </div>
  );
}
