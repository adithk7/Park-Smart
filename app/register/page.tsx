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
  Key
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
  levels: 2,
  totalSlots: 100,
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
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

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
          <div className="border border-[#292E38] bg-[#121720] p-6 sm:p-8 shadow-2xl">
            <form onSubmit={handleFinalSubmit} className="space-y-6">
              <div>
                <span className="font-mono-tech text-xs text-[#F05A28] font-bold block mb-1">
                  SPATIAL PARAMETERS
                </span>
                <h2 className="text-xl font-bold uppercase text-[#F4F4F5]">Facility Configuration</h2>
                <p className="text-xs text-[#A1A1AA] mt-1">
                  Configure venue model, sensor tiers, and ground staff credentials.
                </p>
              </div>

              <div className="space-y-6">
                
                {/* Name & City */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Facility Name"
                    placeholder="e.g. Phoenix Citadel - North Gate"
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
                  placeholder="e.g. 26/1 Dr Rajkumar Road, Phase 2, IT Corridor"
                  value={form.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  error={errors.address}
                  required
                />

                {/* Venue Type */}
                <div>
                  <label className="text-xs font-mono-tech uppercase font-bold text-[#A1A1AA] tracking-wider block mb-2">
                    Venue Operational Model
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { id: 'TRANSIENT', title: 'TRANSIENT', desc: 'Mall, Airport, Hourly visitors' },
                      { id: 'RECURRING', title: 'RECURRING', desc: 'Residential, Tech Park, Fixed bays' },
                      { id: 'BOTH', title: 'HYBRID (BOTH)', desc: 'Mixed commercial + residential' },
                    ].map((vt) => (
                      <div
                        key={vt.id}
                        onClick={() => updateField('venueType', vt.id)}
                        className={`p-3 border cursor-pointer font-mono-tech transition-all duration-150 ${
                          form.venueType === vt.id
                            ? 'bg-[#171D27] text-[#F4F4F5] border-[#F05A28]'
                            : 'bg-[#0B0E13] text-[#A1A1AA] border-[#292E38] hover:border-[#3E4552]'
                        }`}
                      >
                        <span className="font-bold text-xs block mb-1 text-[#F4F4F5]">{vt.title}</span>
                        <span className="text-[10px] opacity-80 font-sans block">{vt.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Site Tier */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-mono-tech uppercase font-bold text-[#A1A1AA] tracking-wider">
                      Hardware Automation Tier (0 - 3)
                    </label>
                    <span className="font-mono-tech text-[10px] text-[#F05A28] font-bold">FLEXIBLE HARDWARE</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { tier: 0, title: 'TIER 0: MANUAL', desc: 'Attendant tallies' },
                      { tier: 1, title: 'TIER 1: GATES', desc: 'Loop barrier count' },
                      { tier: 2, title: 'TIER 2: CCTV/ANPR', desc: 'Camera vision' },
                      { tier: 3, title: 'TIER 3: IOT GRID', desc: 'Slot sensors' },
                    ].map((st) => (
                      <div
                        key={st.tier}
                        onClick={() => updateField('siteTier', st.tier)}
                        className={`p-2.5 border cursor-pointer font-mono-tech transition-all duration-150 ${
                          form.siteTier === st.tier
                            ? 'bg-[#F05A28] text-white border-[#F05A28] font-bold shadow-sm'
                            : 'bg-[#0B0E13] text-[#A1A1AA] border-[#292E38] hover:border-[#3E4552]'
                        }`}
                      >
                        <span className="text-xs block">{st.title}</span>
                        <span className="text-[9px] opacity-90 font-sans block">{st.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Levels & Slots */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Number of Levels / Decks"
                    type="number"
                    min={1}
                    max={50}
                    value={form.levels}
                    onChange={(e) => updateField('levels', parseInt(e.target.value) || 1)}
                    error={errors.levels}
                    required
                  />

                  <Input
                    label="Total Parking Capacity (Bays)"
                    type="number"
                    min={1}
                    max={10000}
                    value={form.totalSlots}
                    onChange={(e) => updateField('totalSlots', parseInt(e.target.value) || 1)}
                    error={errors.totalSlots}
                    required
                  />
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
                >
                  COMPLETE ONBOARDING <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 3: Success Screen */}
        {step === 3 && successData && (
          <div className="border border-[#292E38] bg-[#121720] p-8 sm:p-12 text-center shadow-2xl">
            
            <div className="w-12 h-12 bg-[#68715B] text-white flex items-center justify-center mx-auto mb-4 font-mono-tech text-xl font-bold">
              ✓
            </div>

            <Badge variant="olive" size="lg" className="mb-3">FACILITY ONBOARDED</Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-[#F4F4F5]">
              Facility Initialized
            </h2>
            <p className="text-sm text-[#A1A1AA] font-mono-tech max-w-md mx-auto mt-2">
              Multi-tenant scope created in ParkSmart engine.
            </p>

            {/* Parking Area Code Card */}
            <div className="mt-8 p-6 bg-[#171D27] text-[#F4F4F5] max-w-md mx-auto border border-[#F05A28]">
              <span className="text-[10px] font-mono-tech text-[#A1A1AA] uppercase tracking-widest block mb-1">
                UNIQUE PARKING FACILITY CODE
              </span>
              <div className="text-2xl md:text-3xl font-mono-tech font-extrabold text-[#F05A28] tracking-widest select-all my-2">
                {successData.code}
              </div>
              <p className="text-[11px] font-mono-tech text-[#A1A1AA] mb-4">
                Share this identifier with gate attendants for terminal sign-in.
              </p>
              <Button
                variant={copied ? 'secondary' : 'primary'}
                size="md"
                onClick={copyCodeToClipboard}
                className="w-full"
              >
                {copied ? '✓ COPIED TO CLIPBOARD' : 'COPY FACILITY CODE'}
              </Button>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto mt-6 text-left font-mono-tech text-xs">
              <div className="bg-[#171D27] p-3 border border-[#292E38]">
                <span className="text-[9px] text-[#A1A1AA] uppercase block">VENUE</span>
                <span className="font-bold text-[#F4F4F5] truncate block">{successData.name}</span>
              </div>
              <div className="bg-[#171D27] p-3 border border-[#292E38]">
                <span className="text-[9px] text-[#A1A1AA] uppercase block">REGION</span>
                <span className="font-bold text-[#F4F4F5] truncate block">{successData.city}</span>
              </div>
              <div className="bg-[#171D27] p-3 border border-[#292E38]">
                <span className="text-[9px] text-[#A1A1AA] uppercase block">SITE TIER</span>
                <span className="font-bold text-[#F05A28] block">TIER {successData.tier}</span>
              </div>
              <div className="bg-[#171D27] p-3 border border-[#292E38]">
                <span className="text-[9px] text-[#A1A1AA] uppercase block">CAPACITY</span>
                <span className="font-bold text-[#9EB08C] block">{successData.slots} BAYS</span>
              </div>
            </div>

            {/* Action CTAs */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/login" className="w-full sm:w-auto">
                <Button variant="primary" size="lg" className="w-full">
                  PROCEED TO LOGIN <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </Link>
              <Link href="/" className="w-full sm:w-auto">
                <Button variant="secondary" size="lg" className="w-full">
                  RETURN TO HOME
                </Button>
              </Link>
            </div>

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs font-mono-tech text-[#71717A] border-t border-[#292E38]">
        PARKSMART // URBAN MOBILITY SPEC &bull; 2026
      </footer>
    </div>
  );
}
