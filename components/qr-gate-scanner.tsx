'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  CameraOff,
  QrCode,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  ArrowRight,
  ShieldCheck,
  Clock,
  Car,
  Zap,
  Check,
  History,
  Info
} from 'lucide-react';

interface GateValidationData {
  bookingId: string;
  bookingCode: string;
  vehiclePlate: string;
  vehicleType: string;
  slotNumber: string;
  evChargingPoint?: string | null;
  estimatedArrival?: string;
  entryAt?: string;
  exitAt?: string;
  parkingDuration?: string;
  durationMinutes?: number;
  finalParkingFee?: number;
  evChargingFee?: number;
  totalAmount?: number;
  paymentStatus?: string;
  paymentMethod?: string;
  message?: string;
}

interface ScanLogItem {
  id: string;
  gateType: string;
  result: string;
  reason: string | null;
  scanMethod: string;
  createdAt: string;
  staffName?: string | null;
  booking?: {
    bookingCode: string;
    vehiclePlate: string;
    vehicleType: string;
    status: string;
    slot?: { slotNumber: string } | null;
  } | null;
}

interface QrGateScannerProps {
  facilityCode?: string;
  facilityName?: string;
  onStateChange?: () => void;
}

export function QrGateScanner({ facilityCode, facilityName, onStateChange }: QrGateScannerProps) {
  // Gate mode
  const [gateType, setGateType] = useState<'ENTRY' | 'EXIT'>('ENTRY');

  // Camera State
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Manual input state
  const [manualCode, setManualCode] = useState('');

  // Processing & Confirmation state
  const [isValidating, setIsValidating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const isProcessingRef = useRef(false);
  const lastScannedTokenRef = useRef<{ token: string; time: number } | null>(null);

  // Results
  const [validationData, setValidationData] = useState<GateValidationData | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [confirmedSuccess, setConfirmedSuccess] = useState<string | null>(null);

  // Scan History
  const [scanHistory, setScanHistory] = useState<ScanLogItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Fetch gate scan history
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/staff/gate/history');
      const json = await res.json();
      if (json.success && json.data) {
        setScanHistory(json.data);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Stop camera tracks
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  // Validate scanned or entered token
  const handleValidateInput = async (inputStr: string, method: 'QR_CAMERA' | 'MANUAL_LOOKUP') => {
    if (!inputStr || isProcessingRef.current) return;

    // Prevent repeated detections within 3 seconds
    const now = Date.now();
    if (
      lastScannedTokenRef.current &&
      lastScannedTokenRef.current.token === inputStr &&
      now - lastScannedTokenRef.current.time < 3000
    ) {
      return;
    }

    lastScannedTokenRef.current = { token: inputStr, time: now };
    isProcessingRef.current = true;
    setIsValidating(true);
    setRejectionReason(null);
    setValidationData(null);
    setConfirmedSuccess(null);

    try {
      const res = await fetch('/api/staff/gate/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: inputStr, gateType, scanMethod: method }),
      });
      const json = await res.json();

      if (json.success && json.approved && json.data) {
        setValidationData(json.data);
      } else {
        setRejectionReason(json.reason || json.message || 'Scan validation failed');
      }
    } catch {
      setRejectionReason('Network or server error during validation.');
    } finally {
      setIsValidating(false);
      isProcessingRef.current = false;
      fetchHistory();
    }
  };

  // Scanning loop using requestAnimationFrame + jsQR
  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (!isProcessingRef.current) {
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          handleValidateInput(code.data, 'QR_CAMERA');
        }
      } catch {
        // Continue
      }
    }

    animationFrameRef.current = requestAnimationFrame(scanFrame);
  }, [gateType]);

  // Start camera
  const startCamera = async () => {
    setCameraError(null);
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera API is not supported in this browser environment. Please use Manual Lookup.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS
        await videoRef.current.play();
        setCameraActive(true);
        animationFrameRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err: any) {
      console.warn('Camera error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was denied. Please allow camera access in browser settings, or use Manual Lookup.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera found on this device. Please use Manual Lookup.');
      } else {
        setCameraError('Could not start camera feed. Please check device camera permissions or use Manual Lookup.');
      }
      setCameraActive(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Handle Confirm transition
  const handleConfirmGateAction = async () => {
    if (!validationData || isConfirming) return;
    setIsConfirming(true);

    try {
      const res = await fetch('/api/staff/gate/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: validationData.bookingId,
          gateType,
          scanMethod: cameraActive ? 'QR_CAMERA' : 'MANUAL_LOOKUP',
        }),
      });
      const json = await res.json();
      setIsConfirming(false);

      if (json.success) {
        setConfirmedSuccess(json.message || `${gateType} confirmed successfully!`);
        setValidationData(null);
        if (onStateChange) onStateChange();
        fetchHistory();
      } else {
        setRejectionReason(json.message || 'Gate transition was rejected');
        setValidationData(null);
      }
    } catch {
      setIsConfirming(false);
      setRejectionReason('Network failure while confirming gate action.');
    }
  };

  const handleResetScanner = () => {
    setValidationData(null);
    setRejectionReason(null);
    setConfirmedSuccess(null);
    setManualCode('');
    isProcessingRef.current = false;
  };

  return (
    <div className="border border-[#292E38] bg-[#121720] p-6 shadow-2xl space-y-6 font-mono-tech">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#292E38] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#F05A28] inline-block animate-pulse" />
            <span className="text-xs text-[#F05A28] font-bold tracking-widest uppercase">
              PARKSMART GATE SYSTEM &bull; {facilityCode || 'SECURE'}
            </span>
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight mt-1 flex items-center gap-2">
            <QrCode className="w-6 h-6 text-[#F05A28]" /> QR Gate Scanner
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time entry &amp; exit gate verification. Scans strictly scoped to this facility.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowHistory(!showHistory);
              if (!showHistory) fetchHistory();
            }}
            className="px-3 py-1.5 text-xs font-bold border border-[#292E38] bg-[#171D27] hover:bg-[#232936] text-zinc-300 flex items-center gap-1.5 uppercase"
          >
            <History className="w-3.5 h-3.5 text-zinc-400" />
            {showHistory ? 'HIDE LOGS' : 'SCAN HISTORY'}
          </button>
        </div>
      </div>

      {/* ── Gate Selector Toggle: Entry vs Exit ── */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => {
            setGateType('ENTRY');
            handleResetScanner();
          }}
          className={`py-3.5 px-4 font-black text-sm uppercase flex items-center justify-center gap-2 border transition-all ${
            gateType === 'ENTRY'
              ? 'bg-[#F05A28] text-white border-[#F05A28] shadow-lg shadow-[#F05A28]/20'
              : 'bg-[#171D27] text-zinc-400 border-[#292E38] hover:text-white'
          }`}
        >
          <ArrowRight className="w-4 h-4 rotate-0" />
          <span>ENTRY GATE [CHECK-IN]</span>
        </button>

        <button
          onClick={() => {
            setGateType('EXIT');
            handleResetScanner();
          }}
          className={`py-3.5 px-4 font-black text-sm uppercase flex items-center justify-center gap-2 border transition-all ${
            gateType === 'EXIT'
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-600/20'
              : 'bg-[#171D27] text-zinc-400 border-[#292E38] hover:text-white'
          }`}
        >
          <ArrowRight className="w-4 h-4 rotate-180" />
          <span>EXIT GATE [CHECK-OUT]</span>
        </button>
      </div>

      {/* ── Active Mode Indicator ── */}
      <div
        className={`px-4 py-2 border text-xs flex items-center justify-between ${
          gateType === 'ENTRY'
            ? 'bg-amber-950/20 border-amber-500/40 text-amber-300'
            : 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
        }`}
      >
        <span className="font-bold flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4" />
          ACTIVE GATE MODE: {gateType === 'ENTRY' ? '1st SCAN (ENTRY & OCCUPY)' : '2nd SCAN (EXIT & RELEASE)'}
        </span>
        <span className="text-[11px] opacity-80">
          {gateType === 'ENTRY'
            ? 'Verifies reservation, marks Checked In, marks slot Occupied'
            : 'Verifies active check-in, marks Completed, releases slot to Available'}
        </span>
      </div>

      {/* ── Scanner Preview & Camera Controls ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Camera / Scanner */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative aspect-video sm:aspect-4/3 w-full bg-black border border-[#292E38] overflow-hidden rounded flex items-center justify-center">
            {/* Hidden canvas for decoding */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Video element */}
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
              muted
              playsInline
            />

            {/* Scanning reticle / crosshair overlay */}
            {cameraActive && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-56 h-56 border-2 border-[#F05A28]/80 relative rounded-lg">
                  {/* Corner accents */}
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-white" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-white" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-white" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-white" />
                  {/* Laser scan line animation */}
                  <div className="absolute left-0 right-0 h-0.5 bg-[#F05A28] shadow-[0_0_8px_#F05A28] animate-bounce" />
                </div>
                <div className="absolute bottom-3 bg-black/70 px-3 py-1 rounded text-[11px] text-white">
                  Align QR code inside reticle
                </div>
              </div>
            )}

            {/* Camera Off / Inactive State */}
            {!cameraActive && !cameraError && (
              <div className="text-center p-6 space-y-3">
                <Camera className="w-12 h-12 text-zinc-600 mx-auto" />
                <div className="text-sm font-bold text-white uppercase">Camera Scanner Standby</div>
                <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                  Activate camera to scan driver QR passes directly from mobile screen or printout.
                </p>
                <button
                  onClick={startCamera}
                  className="bg-[#F05A28] hover:bg-[#DC4C1C] text-white text-xs font-bold px-4 py-2.5 uppercase inline-flex items-center gap-1.5 shadow"
                >
                  <Camera className="w-4 h-4" /> ACTIVATE CAMERA SCANNER
                </button>
              </div>
            )}

            {/* Camera Error State */}
            {cameraError && (
              <div className="p-6 text-center space-y-3 max-w-sm">
                <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
                <div className="text-xs font-bold text-white uppercase">Camera Access Notice</div>
                <p className="text-[11px] text-zinc-300 leading-relaxed">{cameraError}</p>
                <div className="flex justify-center gap-2 pt-1">
                  <button
                    onClick={startCamera}
                    className="bg-[#171D27] hover:bg-[#232936] text-white border border-[#292E38] text-xs font-bold px-3 py-2 uppercase"
                  >
                    RETRY CAMERA
                  </button>
                </div>
              </div>
            )}

            {/* Validation Loading Overlay */}
            {isValidating && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center z-10">
                <RefreshCw className="w-8 h-8 text-[#F05A28] animate-spin mb-2" />
                <span className="text-sm font-black text-white uppercase tracking-wider">
                  VERIFYING GATE PASS...
                </span>
                <span className="text-xs text-zinc-400 mt-1">Checking area authorization &amp; lifecycle rules</span>
              </div>
            )}
          </div>

          {/* Camera On/Off Toggle Button */}
          {cameraActive && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-emerald-400 flex items-center gap-1.5 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> SCANNING LIVE
              </span>
              <button
                onClick={stopCamera}
                className="bg-[#171D27] hover:bg-[#232936] text-zinc-300 border border-[#292E38] px-3 py-1.5 text-xs font-bold uppercase flex items-center gap-1"
              >
                <CameraOff className="w-3.5 h-3.5" /> STOP CAMERA
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Manual Lookup Fallback & Status Panel */}
        <div className="lg:col-span-5 space-y-4">
          {/* Manual Reference Lookup Fallback */}
          <div className="border border-[#292E38] bg-[#171D27] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-[#F05A28]" />
              <span className="text-xs font-bold text-white uppercase">Manual Booking Fallback</span>
            </div>
            <p className="text-[11px] text-zinc-400">
              In case of unreadable camera conditions or damaged phone screen, enter booking reference code:
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleValidateInput(manualCode, 'MANUAL_LOOKUP');
              }}
              className="space-y-2"
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. BK-1001"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="flex-1 bg-[#121720] border border-[#292E38] px-3 py-2 text-xs text-white placeholder-zinc-500 font-bold uppercase focus:border-[#F05A28] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!manualCode.trim() || isValidating}
                  className="bg-[#F05A28] hover:bg-[#DC4C1C] disabled:opacity-50 text-white px-4 py-2 text-xs font-bold uppercase shrink-0"
                >
                  VALIDATE
                </button>
              </div>
            </form>
          </div>

          {/* Quick Gate Rules Reminder */}
          <div className="border border-[#292E38] bg-[#121720] p-4 text-[11px] text-zinc-400 space-y-2">
            <span className="font-bold text-white uppercase block flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-[#F05A28]" /> GATE TRANSITION POLICY
            </span>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li>Exactly two scans per booking: Entry (1st) and Exit (2nd).</li>
              <li>Invalid or cancelled passes will not release gate barriers.</li>
              <li>Bookings must belong strictly to this authorized parking area.</li>
              <li>Exit marks booking Completed and releases the occupied slot.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── Success Confirmation Screen: ENTRY APPROVED / EXIT APPROVED ── */}
      {validationData && (
        <div className="border-2 border-emerald-500 bg-emerald-950/30 p-6 space-y-5 rounded shadow-2xl animate-in fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-emerald-500/40 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              <h3 className="text-xl font-black text-emerald-300 uppercase tracking-tight">
                {validationData.message || (gateType === 'ENTRY' ? 'ENTRY APPROVED' : 'EXIT APPROVED')}
              </h3>
            </div>
            <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 font-bold uppercase">
              CONFIRMATION REQUIRED
            </span>
          </div>

          {/* Prominent Slot & Vehicle Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#121720] border border-[#292E38] p-4">
              <span className="text-[10px] text-zinc-400 uppercase block">ALLOCATED SLOT NUMBER</span>
              <span className="text-4xl font-black text-[#9EB08C] block mt-1">
                {validationData.slotNumber}
              </span>
              <span className="text-[11px] text-zinc-500">
                {gateType === 'ENTRY' ? 'Slot will change to OCCUPIED' : 'Slot will release to AVAILABLE'}
              </span>
            </div>

            <div className="bg-[#121720] border border-[#292E38] p-4">
              <span className="text-[10px] text-zinc-400 uppercase block">VEHICLE IDENTIFICATION</span>
              <span className="text-2xl font-black text-white block mt-1 tracking-wider">
                {validationData.vehiclePlate}
              </span>
              <span className="text-[11px] text-[#F05A28] font-bold uppercase">
                {validationData.vehicleType} VEHICLE
              </span>
            </div>
          </div>

          {/* Details Breakdown */}
          <div className="bg-[#121720] border border-[#292E38] p-4 space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-[#292E38]/60">
              <span className="text-zinc-400">BOOKING REFERENCE:</span>
              <span className="font-bold text-white">{validationData.bookingCode}</span>
            </div>

            {gateType === 'ENTRY' && validationData.estimatedArrival && (
              <div className="flex justify-between py-1 border-b border-[#292E38]/60">
                <span className="text-zinc-400">ESTIMATED ARRIVAL:</span>
                <span className="font-bold text-white">
                  {new Date(validationData.estimatedArrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}

            {gateType === 'EXIT' && validationData.entryAt && (
              <div className="flex justify-between py-1 border-b border-[#292E38]/60">
                <span className="text-zinc-400">ENTRY TIMESTAMP:</span>
                <span className="font-bold text-white">
                  {new Date(validationData.entryAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}

            {gateType === 'EXIT' && validationData.parkingDuration && (
              <div className="flex justify-between py-1 border-b border-[#292E38]/60">
                <span className="text-zinc-400">PARKING DURATION:</span>
                <span className="font-bold text-emerald-400">{validationData.parkingDuration}</span>
              </div>
            )}

            {validationData.evChargingPoint && (
              <div className="flex justify-between py-1 border-b border-[#292E38]/60 text-amber-400 font-bold">
                <span className="flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" /> EV CHARGING RESOURCE:
                </span>
                <span>{validationData.evChargingPoint}</span>
              </div>
            )}

            <div className="flex justify-between py-1 border-b border-[#292E38]/60">
              <span className="text-zinc-400">PAYMENT STATUS:</span>
              <span
                className={`font-bold ${
                  validationData.paymentStatus === 'PAID' ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {validationData.paymentStatus} ({validationData.paymentMethod || 'PAY_AT_PARKING'})
              </span>
            </div>

            <div className="flex justify-between py-1">
              <span className="text-zinc-400">TOTAL FEE:</span>
              <span className="font-black text-white text-sm">₹{validationData.totalAmount || 0}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleConfirmGateAction}
              disabled={isConfirming}
              className={`flex-1 py-3.5 px-6 font-black text-sm uppercase flex items-center justify-center gap-2 text-white shadow-xl ${
                gateType === 'ENTRY' ? 'bg-[#F05A28] hover:bg-[#DC4C1C]' : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              {isConfirming ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> EXECUTING GATE TRANSITION...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  {gateType === 'ENTRY' ? 'CONFIRM VEHICLE ENTRY & OCCUPY SLOT' : 'CONFIRM VEHICLE EXIT & RELEASE SLOT'}
                </>
              )}
            </button>

            <button
              onClick={handleResetScanner}
              disabled={isConfirming}
              className="bg-[#171D27] hover:bg-[#232936] text-zinc-300 border border-[#292E38] px-5 py-3 text-xs font-bold uppercase"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* ── Rejection Error Screen ── */}
      {rejectionReason && (
        <div className="border-2 border-rose-500/80 bg-rose-950/30 p-5 space-y-4 rounded shadow-2xl animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <XCircle className="w-7 h-7 text-rose-500 shrink-0" />
            <div>
              <h3 className="text-base font-black text-rose-400 uppercase tracking-tight">
                GATE SCAN REJECTED
              </h3>
              <p className="text-xs text-rose-200 font-bold mt-0.5">{rejectionReason}</p>
            </div>
          </div>

          <div className="bg-[#121720] p-3 border border-rose-500/30 text-xs text-zinc-300">
            <span className="text-[10px] text-zinc-500 uppercase block font-bold">REASON FOR GATE LOCK:</span>
            <span className="text-rose-300 font-bold block mt-0.5">{rejectionReason}</span>
            <span className="text-[11px] text-zinc-400 block mt-1">
              Barrier gate remains locked. Do not allow vehicle entry/exit until a valid pass is presented.
            </span>
          </div>

          <button
            onClick={handleResetScanner}
            className="w-full bg-[#171D27] hover:bg-[#232936] text-white border border-[#292E38] text-xs font-bold py-2.5 uppercase flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> RETRY SCAN / DISMISS
          </button>
        </div>
      )}

      {/* ── Confirmed Success Screen ── */}
      {confirmedSuccess && (
        <div className="border-2 border-emerald-500 bg-emerald-950/40 p-5 space-y-3 rounded shadow-2xl animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            <h3 className="text-lg font-black text-emerald-300 uppercase">
              {gateType === 'ENTRY' ? 'ENTRY RECORDED — BARRIER RELEASED' : 'EXIT COMPLETED — SLOT RELEASED'}
            </h3>
          </div>
          <p className="text-xs text-emerald-200">{confirmedSuccess}</p>
          <button
            onClick={handleResetScanner}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 uppercase"
          >
            SCAN NEXT VEHICLE &rarr;
          </button>
        </div>
      )}

      {/* ── Scan History Accordion ── */}
      {showHistory && (
        <div className="border border-[#292E38] bg-[#121720] p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#292E38] pb-2">
            <h4 className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
              <History className="w-4 h-4 text-[#F05A28]" /> RECENT GATE AUDIT LOGS
            </h4>
            <button onClick={fetchHistory} className="text-zinc-400 hover:text-white text-xs">
              <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {scanHistory.length === 0 ? (
            <p className="text-xs text-zinc-500 py-3 text-center">No gate scan logs recorded yet.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto text-xs pr-1">
              {scanHistory.map((log) => (
                <div
                  key={log.id}
                  className={`p-2.5 border flex items-center justify-between ${
                    log.result === 'SUCCESS'
                      ? 'border-emerald-500/30 bg-emerald-950/10 text-emerald-200'
                      : 'border-rose-500/30 bg-rose-950/10 text-rose-200'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-black font-mono-tech uppercase">
                        [{log.gateType}] {log.result}
                      </span>
                      {log.booking && (
                        <span className="text-white font-bold">
                          {log.booking.bookingCode} &bull; {log.booking.vehiclePlate}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-zinc-400 block">{log.reason || 'No description'}</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
