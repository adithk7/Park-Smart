'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, ShieldCheck, AlertCircle, Lock } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect');

  const [tab, setTab] = useState<'admin' | 'staff'>('admin');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [staffParkingCode, setStaffParkingCode] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setIsLocked(false);

    try {
      const payload = tab === 'admin'
        ? { type: 'admin', email: adminEmail, password: adminPassword }
        : { type: 'staff', parkingCode: staffParkingCode, staffPassword };

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.message || 'Authentication failed. Please check credentials.');
        if (data.isLocked) {
          setIsLocked(true);
        }
        setLoading(false);
        return;
      }

      // Successful login -> Redirect
      const destination = redirectPath || data.redirect || (tab === 'admin' ? '/admin' : '/staff');
      router.push(destination);
      router.refresh();
    } catch {
      setErrorMsg('Network connection error. Please try again.');
      setLoading(false);
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
              OPERATIONS PORTAL
            </span>
          </div>
        </Link>
        <Link href="/register">
          <Button variant="primary" size="sm">REGISTER FACILITY</Button>
        </Link>
      </header>

      {/* Main Login Form */}
      <main className="max-w-md w-full mx-auto my-8">
        <div className="border border-[#292E38] bg-[#121720] p-6 sm:p-8 shadow-2xl">
          
          <div className="pb-4 mb-6 border-b border-[#292E38]">
            <span className="font-mono-tech text-xs text-[#F05A28] font-bold block mb-1">
              TERMINAL AUTHENTICATION
            </span>
            <h1 className="text-2xl font-black uppercase tracking-tight text-[#F4F4F5]">
              Sign In to ParkSmart
            </h1>
            <p className="text-xs text-[#A1A1AA] mt-1 font-mono-tech">
              [SELECT GOVERNANCE ROLE]
            </p>

            {/* Role Switcher Tabs */}
            <div className="grid grid-cols-2 gap-2 mt-4 font-mono-tech text-xs">
              <button
                type="button"
                onClick={() => { setTab('admin'); setErrorMsg(null); setIsLocked(false); }}
                className={`py-2 px-3 border font-bold text-center transition-all duration-150 ${
                  tab === 'admin'
                    ? 'bg-[#171D27] text-[#F4F4F5] border-[#F05A28]'
                    : 'bg-[#0B0E13] text-[#A1A1AA] border-[#292E38] hover:border-[#3E4552]'
                }`}
              >
                LOGIN AS ADMIN
              </button>
              <button
                type="button"
                onClick={() => { setTab('staff'); setErrorMsg(null); setIsLocked(false); }}
                className={`py-2 px-3 border font-bold text-center transition-all duration-150 ${
                  tab === 'staff'
                    ? 'bg-[#171D27] text-[#F4F4F5] border-[#F05A28]'
                    : 'bg-[#0B0E13] text-[#A1A1AA] border-[#292E38] hover:border-[#3E4552]'
                }`}
              >
                LOGIN AS STAFF
              </button>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            
            {errorMsg && (
              <div className={`p-3 border font-mono-tech text-xs flex items-start gap-2.5 ${
                isLocked
                  ? 'bg-[#B91C1C]/25 border-[#B91C1C] text-[#FCA5A5]'
                  : 'bg-[#B91C1C]/15 border-[#B91C1C]/60 text-[#F87171]'
              }`}>
                {isLocked ? <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                <div>
                  <span className="font-bold block">{isLocked ? 'RATE LIMIT LOCKOUT' : 'AUTHENTICATION ERROR'}</span>
                  <span>{errorMsg}</span>
                </div>
              </div>
            )}

            {tab === 'admin' ? (
              <>
                <Input
                  label="Administrator Email"
                  type="email"
                  placeholder="admin@parksmart.io"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  disabled={loading || isLocked}
                  required
                />
                <Input
                  label="Admin Password"
                  type="password"
                  placeholder="••••••••"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  disabled={loading || isLocked}
                  required
                />
              </>
            ) : (
              <>
                <Input
                  label="Parking Area Code"
                  placeholder="e.g. BLR-MALL-4821"
                  value={staffParkingCode}
                  onChange={(e) => setStaffParkingCode(e.target.value.toUpperCase())}
                  helperText="Unique code found in your Admin Dashboard → Staff Access Settings."
                  disabled={loading || isLocked}
                  required
                />
                <Input
                  label="Staff Password"
                  type="password"
                  placeholder="••••••••"
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  helperText="Common password set by your facility administrator."
                  disabled={loading || isLocked}
                  required
                />
              </>
            )}

            <div className="pt-4 border-t border-[#292E38] flex flex-col gap-3">
              <Button 
                type="submit" 
                variant="primary" 
                size="lg" 
                className="w-full" 
                isLoading={loading}
                disabled={isLocked}
              >
                {tab === 'admin' ? 'SIGN IN AS ADMIN' : 'SIGN IN AS STAFF'} <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>

              <div className="text-center font-mono-tech text-xs text-[#A1A1AA] mt-2">
                Need to onboard a new parking space?{' '}
                <Link href="/register" className="text-[#F05A28] font-bold hover:underline">
                  REGISTER VENUE
                </Link>
              </div>
            </div>
          </form>

        </div>
      </main>

      <footer className="text-center py-4 text-xs font-mono-tech text-[#71717A] border-t border-[#292E38]">
        PARKSMART // ZERO-LOGIN DRIVER SESSIONS VIA QR RELAY
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0B0E13] text-white flex items-center justify-center font-mono-tech text-xs">LOADING PORTAL...</div>}>
      <LoginForm />
    </Suspense>
  );
}
