'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QRCodeImage } from '@/components/qr-code';
import {
  Camera,
  Keyboard,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Car,
  Bike,
  Shield,
  Printer,
  ArrowRight,
  RefreshCw,
  Sliders,
  Radio,
  Check,
  X
} from 'lucide-react';

interface CreatedSession {
  id: string;
  ticketCode: string;
  plateRaw: string;
  vehicleType: string;
  isEV: boolean;
  preference: string;
  status: string;
  entryMethod: string;
  entryAt: string;
  visitModel: string;
}

export default function StaffEntryPage() {
  const router = useRouter();

  // Mode: ANPR webcam, Manual plate, Reservation QR
  const [mode, setMode] = useState<'ANPR' | 'MANUAL' | 'RESERVATION'>('ANPR');

  // Form State
  const [plateRaw, setPlateRaw] = useState('');
  const [vehicleType, setVehicleType] = useState<'2W' | '4W'>('4W');
  const [isEV, setIsEV] = useState(false);
  const [preference, setPreference] = useState<'SELF' | 'VALET' | 'ACCESSIBLE'>('SELF');
  const [driverPhone, setDriverPhone] = useState('');
  const [reservationCode, setReservationCode] = useState('');

  // ANPR Scanner state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [anprScanning, setAnprScanning] = useState(false);
  const [anprResult, setAnprResult] = useState<{ plate: string; confidence: number; valid: boolean } | null>(null);
  const [anprError, setAnprError] = useState<string | null>(null);

  // Submission State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSession, setCreatedSession] = useState<CreatedSession | null>(null);
  const [barrierOpen, setBarrierOpen] = useState(false);

  // Initialize webcam when ANPR mode active
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (mode === 'ANPR') {
      navigator.mediaDevices
        ?.getUserMedia({ video: { facingMode: 'environment', width: 1280, height: 720 } })
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
            setIsWebcamActive(true);
          }
        })
        .catch((err) => {
          console.warn('Webcam access error:', err);
          setIsWebcamActive(false);
          setAnprError('Webcam not detected — switch to Manual Entry');
        });
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [mode]);

  // Capture frame and call ANPR proxy
  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setAnprScanning(true);
    setAnprError(null);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const frameBase64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

    try {
      const res = await fetch('/api/anpr/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frame: frameBase64 }),
      });
      const data = await res.json();
      setAnprScanning(false);

      if (data.success && data.data) {
        setAnprResult({
          plate: data.data.plate || data.data.normalised || '',
          confidence: data.data.confidence ?? 0.9,
          valid: data.data.valid ?? true,
        });
        if (data.data.plate) {
          setPlateRaw(data.data.plate);
        }
      } else {
        setAnprError(data.message || 'ANPR scan failed — enter plate manually');
      }
    } catch (err: any) {
      setAnprScanning(false);
      setAnprError('ANPR service offline — switch to Manual Entry');
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plateRaw,
          vehicleType,
          isEV,
          preference,
          driverPhone: driverPhone || undefined,
          entryMethod: mode,
        }),
      });

      const data = await res.json();
      setLoading(false);

      if (!data.success) {
        setError(data.message || 'Failed to create session');
        return;
      }

      setCreatedSession(data.data);
      // Trigger barrier open simulation animation
      setBarrierOpen(true);
      setTimeout(() => setBarrierOpen(false), 5000);
    } catch (err: any) {
      setLoading(false);
      setError('Network error creating session');
    }
  };

  const handleReset = () => {
    setCreatedSession(null);
    setPlateRaw('');
    setAnprResult(null);
    setError(null);
    setBarrierOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#0B0E13] text-[#F4F4F5] p-4 md:p-8 flex flex-col justify-between">
      {/* Top Header */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between border-b border-[#292E38] pb-4">
        <div className="flex items-center gap-3">
          <Link href="/staff" className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 bg-[#F05A28] inline-block" />
            <span className="font-extrabold text-lg tracking-tighter uppercase font-mono-tech leading-none text-white">
              PARKSMART<span className="text-[#F05A28]">.ENTRY</span>
            </span>
          </Link>
          <span className="text-xs font-mono-tech bg-[#171D27] text-zinc-400 border border-[#292E38] px-2 py-0.5 rounded">
            GATE-01 TERMINAL
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono-tech text-xs">
          <Link href="/staff" className="text-zinc-400 hover:text-white transition">
            &larr; BACK TO OPS CONSOLE
          </Link>
        </div>
      </header>

      {/* Main Area */}
      <main className="max-w-5xl w-full mx-auto my-6 space-y-6">
        {/* Simulated Barrier Status Bar */}
        <div
          className={`border p-4 flex items-center justify-between transition-colors duration-500 font-mono-tech ${
            barrierOpen
              ? 'border-emerald-500/50 bg-emerald-950/30 text-emerald-300'
              : 'border-[#292E38] bg-[#121720] text-zinc-400'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-4 h-4 rounded-full transition-all ${
                barrierOpen ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'
              }`}
            />
            <div>
              <span className="text-xs uppercase tracking-wider block font-bold">
                BARRIER GATE STATUS
              </span>
              <span className="text-sm font-black tracking-tight text-white">
                {barrierOpen ? 'OPEN — VEHICLE CLEAR TO ENTER' : 'CLOSED — AWAITING SESSION VALIDATION'}
              </span>
            </div>
          </div>
          {barrierOpen && (
            <span className="bg-emerald-500 text-black font-extrabold text-xs px-3 py-1 uppercase animate-pulse">
              BARRIER UP
            </span>
          )}
        </div>

        {/* Modal / Overlay when Session Created */}
        {createdSession ? (
          <div className="border border-emerald-500/40 bg-[#121720] p-6 space-y-6 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between border-b border-[#292E38] pb-4 gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                <div>
                  <h2 className="text-xl font-bold text-white font-mono-tech uppercase">
                    Session Created — Entry Granted
                  </h2>
                  <p className="text-xs text-zinc-400 font-mono-tech">
                    TICKET CODE: <span className="text-emerald-400 font-bold">{createdSession.ticketCode}</span>
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-[#171D27] hover:bg-[#232936] text-white border border-[#292E38] px-3 py-2 text-xs font-mono-tech flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" /> PRINT TICKET
                </button>
                <button
                  onClick={handleReset}
                  className="bg-[#F05A28] hover:bg-[#d0461b] text-white font-bold px-4 py-2 text-xs font-mono-tech flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> NEXT VEHICLE &rarr;
                </button>
              </div>
            </div>

            {/* Ticket Card Preview (Print Target) */}
            <div id="printable-ticket" className="bg-white text-black p-6 rounded shadow-xl max-w-sm mx-auto font-mono text-center space-y-4">
              <div className="border-b border-zinc-200 pb-3">
                <h3 className="text-lg font-extrabold tracking-wider">PARKSMART ENTRY TICKET</h3>
                <p className="text-xs text-zinc-500">Scan at exit or pay via mobile</p>
              </div>

              <div className="py-2 flex justify-center">
                <QRCodeImage
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/t/${createdSession.ticketCode}`}
                  size={180}
                />
              </div>

              <div className="text-xs space-y-1 text-left bg-zinc-50 p-3 rounded border border-zinc-200">
                <div className="flex justify-between">
                  <span className="text-zinc-500">PLATE:</span>
                  <span className="font-bold text-sm tracking-wider">{createdSession.plateRaw}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">VEHICLE TYPE:</span>
                  <span className="font-bold">{createdSession.vehicleType} {createdSession.isEV ? '(EV)' : ''}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">ENTRY TIME:</span>
                  <span className="font-bold">{new Date(createdSession.entryAt).toLocaleTimeString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">PREFERENCE:</span>
                  <span className="font-bold">{createdSession.preference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">TICKET #:</span>
                  <span className="font-bold text-emerald-700">{createdSession.ticketCode}</span>
                </div>
              </div>

              <p className="text-[10px] text-zinc-500 pt-2 border-t border-zinc-200">
                Keep this ticket. Free grace period 15 min after payment.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Mode Selector & Capture Area (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              {/* Mode Tabs */}
              <div className="grid grid-cols-3 gap-2 font-mono-tech text-xs">
                <button
                  type="button"
                  onClick={() => setMode('ANPR')}
                  className={`p-3 border flex items-center justify-center gap-2 uppercase font-bold transition ${
                    mode === 'ANPR'
                      ? 'border-[#F05A28] bg-[#F05A28]/10 text-white'
                      : 'border-[#292E38] bg-[#121720] text-zinc-400 hover:text-white'
                  }`}
                >
                  <Camera className="w-4 h-4" /> ANPR Vision
                </button>
                <button
                  type="button"
                  onClick={() => setMode('MANUAL')}
                  className={`p-3 border flex items-center justify-center gap-2 uppercase font-bold transition ${
                    mode === 'MANUAL'
                      ? 'border-[#F05A28] bg-[#F05A28]/10 text-white'
                      : 'border-[#292E38] bg-[#121720] text-zinc-400 hover:text-white'
                  }`}
                >
                  <Keyboard className="w-4 h-4" /> Manual Entry
                </button>
                <button
                  type="button"
                  onClick={() => setMode('RESERVATION')}
                  className={`p-3 border flex items-center justify-center gap-2 uppercase font-bold transition ${
                    mode === 'RESERVATION'
                      ? 'border-[#F05A28] bg-[#F05A28]/10 text-white'
                      : 'border-[#292E38] bg-[#121720] text-zinc-400 hover:text-white'
                  }`}
                >
                  <QrCode className="w-4 h-4" /> Pre-booked QR
                </button>
              </div>

              {/* ANPR Webcam Stream */}
              {mode === 'ANPR' && (
                <div className="border border-[#292E38] bg-[#121720] p-4 space-y-3">
                  <div className="relative aspect-video bg-black rounded overflow-hidden border border-[#292E38] flex items-center justify-center">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {!isWebcamActive && (
                      <div className="absolute inset-0 bg-[#121720]/90 flex flex-col items-center justify-center text-center p-4 text-xs font-mono text-zinc-400 space-y-2">
                        <Camera className="w-8 h-8 text-zinc-600" />
                        <p>Webcam stream offline or permission requested</p>
                      </div>
                    )}

                    {/* Target Reticle Overlay */}
                    <div className="absolute inset-0 border-2 border-emerald-500/30 m-8 rounded pointer-events-none flex items-center justify-center">
                      <span className="text-[10px] font-mono text-emerald-400/80 bg-black/60 px-2 py-0.5">
                        ALIGN LICENSE PLATE HERE
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={captureAndScan}
                      disabled={anprScanning}
                      className="flex-1 bg-[#F05A28] hover:bg-[#d0461b] disabled:opacity-50 text-white font-mono-tech text-xs font-bold py-3 uppercase tracking-wider flex items-center justify-center gap-2"
                    >
                      {anprScanning ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" /> SCANNING FRAME...
                        </>
                      ) : (
                        <>
                          <Camera className="w-4 h-4" /> SCAN PLATE NOW
                        </>
                      )}
                    </button>
                  </div>

                  {anprResult && (
                    <div
                      className={`p-3 border text-xs font-mono-tech ${
                        anprResult.valid && anprResult.confidence >= 0.7
                          ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300'
                          : 'border-amber-500/40 bg-amber-950/20 text-amber-300'
                      }`}
                    >
                      <div className="flex justify-between font-bold">
                        <span>ANPR DETECTED:</span>
                        <span>CONFIDENCE: {Math.round(anprResult.confidence * 100)}%</span>
                      </div>
                      <p className="text-lg font-black tracking-widest mt-1 text-white">
                        {anprResult.plate || 'NO PLATE DETECTED'}
                      </p>
                      {anprResult.confidence < 0.7 && (
                        <p className="text-[11px] text-amber-400 mt-1">
                          Low confidence — please verify plate manually below before issuing ticket.
                        </p>
                      )}
                    </div>
                  )}

                  {anprError && (
                    <div className="p-3 border border-rose-500/40 bg-rose-950/20 text-rose-300 text-xs font-mono">
                      {anprError}
                    </div>
                  )}
                </div>
              )}

              {/* Reservation Code Search */}
              {mode === 'RESERVATION' && (
                <div className="border border-[#292E38] bg-[#121720] p-4 space-y-3 font-mono-tech">
                  <label className="text-xs text-zinc-400 block uppercase">Enter Reservation Pass Code</label>
                  <input
                    type="text"
                    value={reservationCode}
                    onChange={(e) => setReservationCode(e.target.value.toUpperCase())}
                    placeholder="e.g. RES-99812"
                    className="w-full bg-[#171D27] border border-[#292E38] text-white p-3 font-bold tracking-wider uppercase focus:outline-none focus:border-[#F05A28]"
                  />
                  <p className="text-xs text-zinc-500">
                    Scan or type pre-booked QR pass code to auto-populate vehicle and guest details.
                  </p>
                </div>
              )}
            </div>

            {/* Entry Form (5 cols) */}
            <div className="lg:col-span-5">
              <form onSubmit={handleCreateSession} className="border border-[#292E38] bg-[#121720] p-6 space-y-5 font-mono-tech">
                <h2 className="text-base font-bold text-white uppercase border-b border-[#292E38] pb-3 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#F05A28]" /> VEHICLE ENTRY DETAILS
                </h2>

                {/* License Plate Input */}
                <div>
                  <label className="text-xs text-zinc-400 block uppercase mb-1">
                    License Plate Number <span className="text-[#F05A28]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={plateRaw}
                    onChange={(e) => setPlateRaw(e.target.value.toUpperCase())}
                    placeholder="e.g. KA01AB1234"
                    className="w-full bg-[#171D27] border border-[#292E38] text-white text-lg font-black tracking-widest p-3 uppercase focus:outline-none focus:border-[#F05A28]"
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    Supported: KA01AB1234, 22BH1234AA, etc.
                  </span>
                </div>

                {/* Vehicle Type Radio */}
                <div>
                  <label className="text-xs text-zinc-400 block uppercase mb-1">Vehicle Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setVehicleType('4W')}
                      className={`p-3 border flex items-center justify-center gap-2 text-xs font-bold uppercase transition ${
                        vehicleType === '4W'
                          ? 'border-[#F05A28] bg-[#F05A28]/20 text-white'
                          : 'border-[#292E38] bg-[#171D27] text-zinc-400'
                      }`}
                    >
                      <Car className="w-4 h-4" /> 4-Wheeler
                    </button>
                    <button
                      type="button"
                      onClick={() => setVehicleType('2W')}
                      className={`p-3 border flex items-center justify-center gap-2 text-xs font-bold uppercase transition ${
                        vehicleType === '2W'
                          ? 'border-[#F05A28] bg-[#F05A28]/20 text-white'
                          : 'border-[#292E38] bg-[#171D27] text-zinc-400'
                      }`}
                    >
                      <Bike className="w-4 h-4" /> 2-Wheeler
                    </button>
                  </div>
                </div>

                {/* EV Checkbox */}
                <label className="flex items-center gap-3 p-3 bg-[#171D27] border border-[#292E38] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isEV}
                    onChange={(e) => setIsEV(e.target.checked)}
                    className="w-4 h-4 accent-[#F05A28]"
                  />
                  <span className="text-xs font-bold text-white flex items-center gap-1">
                    <Zap className="w-4 h-4 text-amber-400" /> Electric Vehicle (EV)
                  </span>
                </label>

                {/* Slot Preference */}
                <div>
                  <label className="text-xs text-zinc-400 block uppercase mb-1">Parking Preference</label>
                  <select
                    value={preference}
                    onChange={(e) => setPreference(e.target.value as any)}
                    className="w-full bg-[#171D27] border border-[#292E38] text-white text-xs p-3 focus:outline-none focus:border-[#F05A28]"
                  >
                    <option value="SELF">SELF-PARK (STANDARD)</option>
                    <option value="VALET">VALET SERVICE</option>
                    <option value="ACCESSIBLE">ACCESSIBLE / HANDICAP</option>
                  </select>
                </div>

                {/* Optional Phone */}
                <div>
                  <label className="text-xs text-zinc-400 block uppercase mb-1">Driver Phone (Optional)</label>
                  <input
                    type="tel"
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full bg-[#171D27] border border-[#292E38] text-white text-xs p-3 focus:outline-none focus:border-[#F05A28]"
                  />
                </div>

                {error && (
                  <div className="p-3 border border-rose-500/40 bg-rose-950/20 text-rose-300 text-xs">
                    {error}
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#F05A28] hover:bg-[#d0461b] disabled:opacity-50 text-white font-extrabold text-sm py-3.5 uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg"
                >
                  {loading ? (
                    'GENERATING SESSION & OPENING GATE...'
                  ) : (
                    <>
                      OPEN GATE & ISSUE TICKET <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-5xl w-full mx-auto text-center py-4 text-xs font-mono-tech text-zinc-600 border-t border-[#292E38]">
        PARKSMART GATE TERMINAL &bull; 60-SEC DUPLICATE ENTRY PROTECTION ACTIVE
      </footer>
    </div>
  );
}
