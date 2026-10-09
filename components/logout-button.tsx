'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export function LogoutButton({ variant = 'outline', size = 'sm' }: { variant?: any; size?: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      router.push('/login');
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleLogout}
      isLoading={loading}
      className="font-mono-tech"
    >
      <LogOut className="w-3.5 h-3.5 mr-1.5" />
      LOGOUT
    </Button>
  );
}
