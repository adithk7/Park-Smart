'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export function QRCodeImage({ value, size = 180, className = '' }: QRCodeProps) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    if (!value) return;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })
      .then((url) => setDataUrl(url))
      .catch((err) => console.error('QR code generation error:', err));
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        className={`bg-white/10 animate-pulse flex items-center justify-center text-xs font-mono text-zinc-500 ${className}`}
        style={{ width: size, height: size }}
      >
        Generating QR...
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt={`QR Code for ${value}`}
      width={size}
      height={size}
      className={`rounded shadow-md bg-white p-2 ${className}`}
    />
  );
}
