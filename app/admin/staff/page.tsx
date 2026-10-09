'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { LogoutButton } from '@/components/logout-button';
import { 
  Users, 
  UserPlus, 
  Key, 
  Copy, 
  Check, 
  Trash2, 
  ArrowLeft, 
  ShieldCheck, 
  AlertCircle,
  Clock,
  Phone,
  Radio,
  MapPin,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';

interface StaffItem {
  id: string;
  staffCode: string;
  name: string;
  phone?: string | null;
  assignedZone?: string | null;
  active: boolean;
  createdAt: string;
}

interface ParkingAreaInfo {
  id: string;
  name: string;
  code: string;
  tier: number;
  city?: string | null;
}

interface AuditLogItem {
  id: string;
  action: string;
  actorRole: string;
  meta: string | null;
  createdAt: string;
}

export default function StaffManagementPage() {
  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [parkingArea, setParkingArea] = useState<ParkingAreaInfo | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Add Staff Modal / Form
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffZone, setNewStaffZone] = useState('All Gates');
  const [addingStaff, setAddingStaff] = useState(false);

  // Rotate Password Modal / Form
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [rotatingPassword, setRotatingPassword] = useState(false);
  const [rotatedPasswordSuccess, setRotatedPasswordSuccess] = useState<string | null>(null);

  // Copied clipboard states
  const [copiedInstructions, setCopiedInstructions] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const fetchStaffData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/staff');
      const data = await res.json();
      if (res.ok && data.success) {
        setStaffList(data.data.staff);
        setParkingArea(data.data.parkingArea);
        setAuditLogs(data.data.auditLogs || []);
      } else {
        setErrorMsg(data.message || 'Failed to load staff roster');
      }
    } catch {
      setErrorMsg('Failed to communicate with server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffData();
  }, []);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;

    setAddingStaff(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newStaffName,
          phone: newStaffPhone || null,
          assignedZone: newStaffZone || 'All Gates',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(data.message);
        setNewStaffName('');
        setNewStaffPhone('');
        setNewStaffZone('All Gates');
        setShowAddModal(false);
        fetchStaffData();
      } else {
        setErrorMsg(data.message || 'Failed to add staff');
      }
    } catch {
      setErrorMsg('Network error while adding staff');
    } finally {
      setAddingStaff(false);
    }
  };

  const handleToggleStatus = async (staffId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/staff/${staffId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !currentStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(data.message);
        fetchStaffData();
      }
    } catch {
      setErrorMsg('Error updating staff status');
    }
  };

  const handleDeleteStaff = async (staffId: string, staffName: string) => {
    if (!confirm(`Are you sure you want to remove staff member ${staffName}?`)) return;

    try {
      const res = await fetch(`/api/admin/staff/${staffId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(data.message);
        fetchStaffData();
      } else {
        setErrorMsg(data.message || 'Error removing staff');
      }
    } catch {
      setErrorMsg('Error removing staff');
    }
  };

  const handleRotatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      setErrorMsg('Password must be at least 4 characters');
      return;
    }

    setRotatingPassword(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/admin/staff/rotate-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setRotatedPasswordSuccess(newPassword);
        setSuccessMsg(data.message);
        setNewPassword('');
      } else {
        setErrorMsg(data.message || 'Error rotating staff password');
      }
    } catch {
      setErrorMsg('Network error rotating password');
    } finally {
      setRotatingPassword(false);
    }
  };

  const copyLoginInstructions = () => {
    if (!parkingArea) return;
    const instructions = `PARKSMART GATE TERMINAL ACCESS INSTRUCTIONS:
1. Open URL: ${window.location.origin}/login
2. Select: "LOGIN AS STAFF"
3. Parking Area Code: ${parkingArea.code}
4. Staff ID: Use your assigned ID (e.g. ST-001)
5. Staff Password: Use the facility shared password set by your admin.`;

    navigator.clipboard.writeText(instructions);
    setCopiedInstructions(true);
    setTimeout(() => setCopiedInstructions(false), 3000);
  };

  const copyCode = () => {
    if (parkingArea?.code) {
      navigator.clipboard.writeText(parkingArea.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E13] text-[#F4F4F5] flex flex-col justify-between p-4 md:p-8">
      
      {/* Top Navbar */}
      <header className="max-w-6xl w-full mx-auto flex flex-wrap items-center justify-between py-4 border-b border-[#292E38] gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="flex items-center gap-2 group">
            <span className="w-3.5 h-3.5 bg-[#F05A28] inline-block transition-transform duration-200 group-hover:scale-110" />
            <span className="font-extrabold text-lg tracking-tighter uppercase font-mono-tech leading-none text-[#F4F4F5]">
              PARKSMART<span className="text-[#F05A28]">.SYS</span>
            </span>
          </Link>
          <span className="text-[#71717A] hidden sm:inline">|</span>
          <Badge variant="signal" size="sm">STAFF MANAGEMENT</Badge>
        </div>

        <div className="flex items-center gap-3 font-mono-tech text-xs">
          <Link href="/admin">
            <Button variant="secondary" size="sm">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> ADMIN OVERVIEW
            </Button>
          </Link>
          <LogoutButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl w-full mx-auto my-8 space-y-8">
        
        {/* Banner with Venue Code & Actions */}
        <div className="border border-[#292E38] bg-[#121720] p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2 font-mono-tech text-xs">
                <span className="w-2 h-2 bg-[#F05A28] animate-live-dot inline-block" />
                <span className="text-[#F05A28] font-bold">VENUE CODE: {parkingArea?.code || 'LOADING...'}</span>
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight uppercase">
                Staff & Gate Attendants Roster
              </h1>
              <p className="text-xs text-[#A1A1AA] mt-1 font-mono-tech">
                [MANAGE ATTENDANT CREDENTIALS &bull; ROTATE SHARED TERMINAL PASSWORDS]
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button 
                variant="outline" 
                size="md"
                onClick={() => { setShowPasswordModal(true); setRotatedPasswordSuccess(null); }}
              >
                <Key className="w-4 h-4 mr-1.5 text-[#F05A28]" /> CHANGE STAFF PASSWORD
              </Button>

              <Button 
                variant="primary" 
                size="md"
                onClick={() => setShowAddModal(true)}
              >
                <UserPlus className="w-4 h-4 mr-1.5" /> ADD NEW STAFF
              </Button>
            </div>
          </div>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="p-4 bg-[#B91C1C]/15 border border-[#B91C1C] text-[#F87171] text-xs font-mono-tech flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-white hover:underline">✕</button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-[#68715B]/25 border border-[#68715B] text-[#9EB08C] text-xs font-mono-tech flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-white hover:underline">✕</button>
          </div>
        )}

        {/* Share Login Instructions Card */}
        <div className="border border-[#292E38] bg-[#171D27] p-6 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 mb-4 border-b border-[#292E38]">
            <div className="flex items-center gap-2.5">
              <Radio className="w-4 h-4 text-[#F05A28]" />
              <h2 className="text-base font-bold uppercase text-white font-mono-tech">
                Staff Terminal Login Credentials & Instructions
              </h2>
            </div>
            <Button
              variant={copiedInstructions ? 'secondary' : 'primary'}
              size="sm"
              onClick={copyLoginInstructions}
              className="font-mono-tech text-xs"
            >
              {copiedInstructions ? '✓ COPIED INSTRUCTIONS' : 'COPY SHAREABLE INSTRUCTIONS'}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono-tech text-xs">
            <div className="bg-[#121720] p-3.5 border border-[#292E38]">
              <span className="text-[#A1A1AA] text-[10px] uppercase block">PARKING AREA CODE</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-lg font-bold text-[#F05A28]">{parkingArea?.code}</span>
                <button onClick={copyCode} className="text-[#A1A1AA] hover:text-white">
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-[#9EB08C]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="bg-[#121720] p-3.5 border border-[#292E38]">
              <span className="text-[#A1A1AA] text-[10px] uppercase block">SHARED STAFF PASSWORD</span>
              <span className="text-lg font-bold text-white mt-1 block">••••••••</span>
              <span className="text-[10px] text-[#A1A1AA] block mt-0.5">Use "Change Staff Password" to rotate</span>
            </div>

            <div className="bg-[#121720] p-3.5 border border-[#292E38]">
              <span className="text-[#A1A1AA] text-[10px] uppercase block">STAFF LOGIN URL</span>
              <span className="text-xs font-bold text-white mt-1 block truncate">/login (Staff Tab)</span>
              <span className="text-[10px] text-[#9EB08C] block mt-0.5">Requires Area Code + Staff ID + Pass</span>
            </div>
          </div>
        </div>

        {/* Staff Table Section */}
        <div className="border border-[#292E38] bg-[#121720] p-6 shadow-2xl">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#292E38]">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#F05A28]" />
              <h2 className="text-lg font-bold uppercase text-white font-mono-tech">
                Active Staff Roster ({staffList.length})
              </h2>
            </div>
            <span className="text-xs font-mono-tech text-[#A1A1AA]">
              AUTO-ID FORMAT: <code className="text-[#F05A28]">ST-00X</code>
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs font-mono-tech text-[#A1A1AA]">
              LOADING STAFF ROSTER...
            </div>
          ) : staffList.length === 0 ? (
            <div className="py-12 text-center space-y-3 font-mono-tech">
              <Users className="w-8 h-8 text-[#71717A] mx-auto" />
              <p className="text-sm font-bold text-white">No staff members enrolled yet.</p>
              <p className="text-xs text-[#A1A1AA]">
                Click "Add New Staff" to enroll your first gate attendant.
              </p>
              <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
                <UserPlus className="w-4 h-4 mr-1.5" /> ADD FIRST STAFF MEMBER
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono-tech">
                <thead>
                  <tr className="border-b border-[#292E38] text-[#A1A1AA]">
                    <th className="pb-3">STAFF ID</th>
                    <th className="pb-3">NAME</th>
                    <th className="pb-3">PHONE</th>
                    <th className="pb-3">ASSIGNED ZONE</th>
                    <th className="pb-3">STATUS</th>
                    <th className="pb-3">ENROLLED</th>
                    <th className="pb-3 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#292E38]">
                  {staffList.map((st) => (
                    <tr key={st.id} className="hover:bg-[#171D27] transition-colors">
                      <td className="py-3.5 font-bold text-[#F05A28]">{st.staffCode}</td>
                      <td className="py-3.5 font-bold text-white">{st.name}</td>
                      <td className="py-3.5 text-[#A1A1AA]">{st.phone || '—'}</td>
                      <td className="py-3.5 text-[#A1A1AA]">{st.assignedZone || 'All Gates'}</td>
                      <td className="py-3.5">
                        <span className={`px-2 py-0.5 border text-[10px] font-bold ${
                          st.active 
                            ? 'bg-[#68715B]/30 border-[#68715B] text-[#9EB08C]' 
                            : 'bg-[#B91C1C]/20 border-[#B91C1C] text-[#F87171]'
                        }`}>
                          {st.active ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </td>
                      <td className="py-3.5 text-[#71717A]">
                        {new Date(st.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 text-right space-x-2">
                        <button
                          onClick={() => handleToggleStatus(st.id, st.active)}
                          className={`px-2 py-1 text-[11px] font-bold border transition-colors ${
                            st.active
                              ? 'bg-[#292E38] hover:bg-[#3E4552] text-[#F4F4F5] border-[#292E38]'
                              : 'bg-[#68715B] hover:bg-[#58604D] text-white border-[#68715B]'
                          }`}
                        >
                          {st.active ? 'DISABLE' : 'ENABLE'}
                        </button>
                        <button
                          onClick={() => handleDeleteStaff(st.id, st.name)}
                          className="px-2 py-1 text-[11px] font-bold bg-[#B91C1C]/20 hover:bg-[#B91C1C]/40 text-[#F87171] border border-[#B91C1C]/40 transition-colors"
                          title="Delete staff member"
                        >
                          REMOVE
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Security Audit Log Preview */}
        {auditLogs.length > 0 && (
          <div className="border border-[#292E38] bg-[#121720] p-6 font-mono-tech text-xs">
            <div className="flex items-center gap-2 pb-3 mb-3 border-b border-[#292E38]">
              <ShieldCheck className="w-4 h-4 text-[#9EB08C]" />
              <h2 className="text-sm font-bold uppercase text-white">
                Recent Security & Authentication Audit Logs
              </h2>
            </div>
            <div className="space-y-2">
              {auditLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-center justify-between p-2 bg-[#171D27] border border-[#292E38] text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="text-[#F05A28] font-bold">[{log.action}]</span>
                    <span className="text-[#A1A1AA]">BY: {log.actorRole}</span>
                    {log.meta && <span className="text-[#71717A] truncate max-w-md">{log.meta}</span>}
                  </div>
                  <span className="text-[#71717A] text-[10px]">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* MODAL: ADD STAFF */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="border-2 border-[#F05A28] bg-[#121720] p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#292E38]">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#F05A28]" />
                <h3 className="text-lg font-bold uppercase text-white font-mono-tech">
                  Enroll New Staff Member
                </h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-[#A1A1AA] hover:text-white">✕</button>
            </div>

            <p className="text-xs text-[#A1A1AA]">
              The system will automatically allocate the next sequential Staff ID (e.g. ST-001, ST-002).
            </p>

            <form onSubmit={handleAddStaff} className="space-y-4">
              <Input
                label="Staff Full Name"
                placeholder="e.g. Ramesh Kumar"
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                required
              />

              <Input
                label="Staff Phone Number (Optional)"
                placeholder="e.g. +91 98765 43210"
                value={newStaffPhone}
                onChange={(e) => setNewStaffPhone(e.target.value)}
              />

              <Input
                label="Assigned Gate / Zone (Optional)"
                placeholder="e.g. Main Gate Entry 1, Ground Floor"
                value={newStaffZone}
                onChange={(e) => setNewStaffZone(e.target.value)}
              />

              <div className="pt-3 border-t border-[#292E38] flex items-center justify-end gap-3">
                <Button type="button" variant="outline" size="md" onClick={() => setShowAddModal(false)}>
                  CANCEL
                </Button>
                <Button type="submit" variant="primary" size="md" isLoading={addingStaff}>
                  SAVE & ENROLL STAFF
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CHANGE STAFF PASSWORD */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="border-2 border-[#292E38] bg-[#121720] p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#292E38]">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-[#F05A28]" />
                <h3 className="text-lg font-bold uppercase text-white font-mono-tech">
                  Rotate Staff Shared Password
                </h3>
              </div>
              <button onClick={() => setShowPasswordModal(false)} className="text-[#A1A1AA] hover:text-white">✕</button>
            </div>

            {rotatedPasswordSuccess ? (
              <div className="space-y-4">
                <div className="p-4 bg-[#68715B]/30 border border-[#68715B] text-xs font-mono-tech space-y-2">
                  <p className="font-bold text-[#9EB08C]">✓ PASSWORD ROTATED SUCCESSFULLY!</p>
                  <p className="text-[#F4F4F5]">
                    The new shared password for parking area <strong>{parkingArea?.code}</strong> is:
                  </p>
                  <div className="p-2 bg-[#0B0E13] border border-[#292E38] text-base font-bold text-[#F05A28] select-all">
                    {rotatedPasswordSuccess}
                  </div>
                  <p className="text-[10px] text-[#A1A1AA]">
                    Please share this new password with your active gate attendants.
                  </p>
                </div>
                <Button variant="primary" size="md" onClick={() => setShowPasswordModal(false)} className="w-full">
                  DONE
                </Button>
              </div>
            ) : (
              <form onSubmit={handleRotatePassword} className="space-y-4">
                <p className="text-xs text-[#A1A1AA]">
                  Updating this changes the shared password for all staff terminals in facility <strong>{parkingArea?.code}</strong>.
                </p>

                <div className="relative">
                  <Input
                    label="New Shared Staff Password"
                    type={showPasswordText ? 'text' : 'password'}
                    placeholder="Min 4 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordText(!showPasswordText)}
                    className="absolute right-3.5 top-7 text-[#71717A] hover:text-[#F4F4F5]"
                  >
                    {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="pt-3 border-t border-[#292E38] flex items-center justify-end gap-3">
                  <Button type="button" variant="outline" size="md" onClick={() => setShowPasswordModal(false)}>
                    CANCEL
                  </Button>
                  <Button type="submit" variant="primary" size="md" isLoading={rotatingPassword}>
                    UPDATE PASSWORD
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto text-center py-4 text-xs font-mono-tech text-[#71717A] border-t border-[#292E38]">
        PARKSMART // MULTI-TENANT ACCESS CONTROL &bull; SCOPE: {parkingArea?.code}
      </footer>

    </div>
  );
}
