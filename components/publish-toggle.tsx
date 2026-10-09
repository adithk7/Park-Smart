'use client';

import React, { useState } from 'react';
import { Globe, EyeOff, RefreshCw } from 'lucide-react';

interface Props {
  isPublished: boolean;
  areaName: string;
}

export function PublishToggle({ isPublished: initial, areaName }: Props) {
  const [published, setPublished] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggle = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/publish', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: !published }),
      });
      const json = await res.json();
      if (json.success) setPublished(json.data.isPublished);
      else setError(json.message || 'Failed to update');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-[#292E38] bg-[#121720] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono-tech text-xs text-[#A1A1AA] uppercase">Public Listing</p>
          <p className="text-sm font-bold text-white mt-0.5">{areaName}</p>
        </div>
        <button
          onClick={toggle}
          disabled={loading}
          id="publish-toggle-btn"
          aria-label={published ? 'Unpublish this area' : 'Publish this area'}
          className={`flex items-center gap-2 px-4 py-2 font-mono-tech text-xs font-bold transition-colors ${
            published
              ? 'bg-[#9EB08C]/20 border border-[#9EB08C]/50 text-[#9EB08C] hover:bg-[#9EB08C]/30'
              : 'bg-[#292E38] border border-[#3E4552] text-[#A1A1AA] hover:border-[#F05A28] hover:text-[#F05A28]'
          }`}
        >
          {loading ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : published ? (
            <><Globe className="w-3.5 h-3.5" /> PUBLISHED</>
          ) : (
            <><EyeOff className="w-3.5 h-3.5" /> UNPUBLISHED</>
          )}
        </button>
      </div>
      {published && (
        <p className="font-mono-tech text-[10px] text-[#9EB08C]">
          ✓ Visible in public parking search. Drivers can discover this area.
        </p>
      )}
      {!published && (
        <p className="font-mono-tech text-[10px] text-[#71717A]">
          Hidden from public search. Only accessible via direct link or staff login.
        </p>
      )}
      {error && <p className="font-mono-tech text-[10px] text-[#F05A28]">{error}</p>}
    </div>
  );
}
