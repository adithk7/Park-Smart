'use client';

import React, { useState } from 'react';
import { Lock, Key, Copy, Eye, EyeOff, ShieldCheck, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  parkingCode: string;
  hasPassword: boolean;
}

export function StaffAccessSettings({ parkingCode, hasPassword }: Props) {
  const [staffPassword, setStaffPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [slotMessage, setSlotMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(parkingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffPassword || staffPassword.length < 4) {
      setMessage({ type: 'error', text: 'Password must be at least 4 characters.' });
      return;
    }
    if (staffPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/staff-password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffPassword, confirmStaffPassword: confirmPassword }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: 'success', text: json.message });
        setStaffPassword('');
        setConfirmPassword('');
      } else {
        setMessage({ type: 'error', text: json.message || 'Error saving password.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleReconcileSlots = async () => {
    setReconciling(true);
    setSlotMessage(null);
    try {
      const res = await fetch('/api/admin/staff-password', {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        setSlotMessage({ type: 'success', text: json.message });
      } else {
        setSlotMessage({ type: 'error', text: json.message || 'Reconciliation failed.' });
      }
    } catch {
      setSlotMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setReconciling(false);
    }
  };

  return (
    <div className="space-y-6 font-mono-tech">
      {/* Staff Access Settings */}
      <div className="border border-[#292E38] bg-[#121720] p-6 space-y-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#292E38] pb-3">
          <h2 className="text-base font-bold text-white uppercase flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#F05A28]" /> Staff Access Settings
          </h2>
          <span className="text-[11px] text-zinc-500">NO INDIVIDUAL ACCOUNTS REQUIRED</span>
        </div>

        <p className="text-xs text-[#A1A1AA] leading-relaxed">
          Gate attendants log in using your <strong className="text-white">Parking Area Code</strong> and a
          single shared <strong className="text-white">Staff Password</strong> — no individual email or account needed.
        </p>

        {/* Parking Area Code Display */}
        <div className="bg-[#171D27] border border-[#292E38] p-4 space-y-1">
          <label className="text-[11px] text-zinc-400 uppercase block">Parking Area Code (share with staff)</label>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-extrabold text-[#F05A28] tracking-widest">{parkingCode}</span>
            <button
              type="button"
              onClick={handleCopyCode}
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 border border-[#292E38] px-2 py-1 hover:border-[#F05A28] transition-colors"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'COPIED' : 'COPY'}
            </button>
          </div>
          <p className="text-[11px] text-zinc-500">Staff members enter this code on the login screen.</p>
        </div>

        {/* Password Status */}
        <div className={`flex items-center gap-2 text-xs p-2.5 border ${
          hasPassword
            ? 'border-emerald-700/40 bg-emerald-950/20 text-emerald-400'
            : 'border-amber-700/40 bg-amber-950/20 text-amber-400'
        }`}>
          <ShieldCheck className="w-4 h-4 flex-shrink-0" />
          {hasPassword
            ? 'Staff password is set. Gate attendants can log in.'
            : 'No staff password configured. Set one below to enable staff login.'}
        </div>

        {/* Password Change Form */}
        <form onSubmit={handleSavePassword} className="space-y-3 text-xs border-t border-[#292E38] pt-4">
          <p className="text-zinc-400">{hasPassword ? 'Change the common staff password:' : 'Set a common staff password:'}</p>

          {message && (
            <div className={`flex items-center gap-2 p-2.5 border text-xs ${
              message.type === 'success'
                ? 'border-emerald-700/40 bg-emerald-950/20 text-emerald-300'
                : 'border-red-700/40 bg-red-950/20 text-red-300'
            }`}>
              {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {message.text}
            </div>
          )}

          <div className="relative">
            <label className="text-zinc-400 uppercase block mb-1">New Staff Password</label>
            <div className="flex">
              <input
                type={showPassword ? 'text' : 'password'}
                value={staffPassword}
                onChange={(e) => setStaffPassword(e.target.value)}
                placeholder="Min. 4 characters"
                minLength={4}
                required
                className="flex-1 bg-[#171D27] border border-[#292E38] text-white p-2.5 font-bold focus:outline-none focus:border-[#F05A28] text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="bg-[#171D27] border border-l-0 border-[#292E38] px-3 text-zinc-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-zinc-400 uppercase block mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              required
              className="w-full bg-[#171D27] border border-[#292E38] text-white p-2.5 font-bold focus:outline-none focus:border-[#F05A28] text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#F05A28] hover:bg-[#d0461b] text-white font-extrabold py-3 uppercase tracking-wider flex items-center justify-center gap-2 text-sm transition-colors disabled:opacity-60"
          >
            <Key className="w-4 h-4" />
            {saving ? 'SAVING...' : hasPassword ? 'UPDATE STAFF PASSWORD' : 'SET STAFF PASSWORD'}
          </button>
        </form>
      </div>

      {/* Slot Reconciliation */}
      <div className="border border-[#292E38] bg-[#121720] p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#292E38] pb-3">
          <h2 className="text-base font-bold text-white uppercase flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-[#9EB08C]" /> Slot Database Repair
          </h2>
        </div>

        <p className="text-xs text-[#A1A1AA] leading-relaxed">
          If your slot count on the listing page doesn&apos;t match your configured capacity,
          click below to generate missing slot records. Existing occupied, reserved, and maintenance
          slots are never deleted.
        </p>

        {slotMessage && (
          <div className={`flex items-center gap-2 p-2.5 border text-xs font-mono-tech ${
            slotMessage.type === 'success'
              ? 'border-emerald-700/40 bg-emerald-950/20 text-emerald-300'
              : 'border-red-700/40 bg-red-950/20 text-red-300'
          }`}>
            {slotMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {slotMessage.text}
          </div>
        )}

        <button
          type="button"
          onClick={handleReconcileSlots}
          disabled={reconciling}
          className="w-full bg-[#171D27] border border-[#292E38] hover:border-[#9EB08C] text-[#9EB08C] font-bold py-3 uppercase tracking-wider flex items-center justify-center gap-2 text-xs transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${reconciling ? 'animate-spin' : ''}`} />
          {reconciling ? 'RECONCILING...' : 'REPAIR SLOT DATABASE'}
        </button>
      </div>
    </div>
  );
}
