'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { ParkingRealtimePayload } from '@/lib/realtime/types';

interface UseParkingRealtimeOptions {
  parkingAreaId?: string | null;
  onUpdate?: (event: ParkingRealtimePayload) => void;
  onRefresh?: () => void;
  enabled?: boolean;
}

interface UseParkingRealtimeResult {
  isConnected: boolean;
  isReconnecting: boolean;
  error: string | null;
  lastPayload: ParkingRealtimePayload | null;
  provider: 'SUPABASE' | 'SSE' | 'DISCONNECTED';
}

// Global cache for Supabase client on browser
let cachedSupabaseBrowserClient: SupabaseClient | null = null;

function getSupabaseBrowserClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  if (!cachedSupabaseBrowserClient) {
    cachedSupabaseBrowserClient = createClient(url, anonKey, {
      realtime: {
        params: {
          eventsPerSecond: 20,
        },
      },
    });
  }

  return cachedSupabaseBrowserClient;
}

export function useParkingRealtime({
  parkingAreaId,
  onUpdate,
  onRefresh,
  enabled = true,
}: UseParkingRealtimeOptions): UseParkingRealtimeResult {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPayload, setLastPayload] = useState<ParkingRealtimePayload | null>(null);
  const [provider, setProvider] = useState<'SUPABASE' | 'SSE' | 'DISCONNECTED'>('DISCONNECTED');

  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const backoffRef = useRef(1000);
  const isMountedRef = useRef(true);

  const handleIncomingPayload = useCallback((payload: ParkingRealtimePayload) => {
    setLastPayload(payload);
    if (onUpdateRef.current) {
      onUpdateRef.current(payload);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    if (!enabled || !parkingAreaId) {
      setIsConnected(false);
      setProvider('DISCONNECTED');
      return;
    }

    const supabase = getSupabaseBrowserClient();

    // ── Mode 1: Supabase Realtime Broadcast ──
    if (supabase) {
      setProvider('SUPABASE');
      let channel: RealtimeChannel | null = null;

      try {
        const channelName = `parking:${parkingAreaId}`;
        channel = supabase.channel(channelName);

        channel
          .on('broadcast', { event: 'availability_update' }, ({ payload }) => {
            if (isMountedRef.current && payload) {
              handleIncomingPayload(payload);
            }
          })
          .subscribe((status) => {
            if (!isMountedRef.current) return;
            if (status === 'SUBSCRIBED') {
              setIsConnected(true);
              setIsReconnecting(false);
              setError(null);
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              setIsConnected(false);
              setIsReconnecting(true);
              setError('Supabase Realtime disconnected. Reconnecting...');
              if (onRefreshRef.current) onRefreshRef.current();
            }
          });
      } catch (err: any) {
        console.warn('Supabase Realtime subscription error:', err);
        setError(err?.message || 'Connection error');
      }

      return () => {
        isMountedRef.current = false;
        if (channel && supabase) {
          supabase.removeChannel(channel).catch(() => {});
        }
      };
    }

    // ── Mode 2: Server-Sent Events (SSE) Engine ──
    setProvider('SSE');
    let eventSource: EventSource | null = null;

    const connectSSE = () => {
      if (!isMountedRef.current) return;

      try {
        const sseUrl = `/api/realtime/sse?parkingAreaId=${encodeURIComponent(parkingAreaId)}`;
        eventSource = new EventSource(sseUrl);

        eventSource.onopen = () => {
          if (!isMountedRef.current) return;
          setIsConnected(true);
          setIsReconnecting(false);
          setError(null);
          backoffRef.current = 1000;
          // Refresh authoritative data upon reconnection to guarantee no missed events
          if (onRefreshRef.current) {
            onRefreshRef.current();
          }
        };

        eventSource.addEventListener('connected', () => {
          if (!isMountedRef.current) return;
          setIsConnected(true);
          setIsReconnecting(false);
        });

        eventSource.addEventListener('parking_update', (e: MessageEvent) => {
          if (!isMountedRef.current) return;
          try {
            const data: ParkingRealtimePayload = JSON.parse(e.data);
            handleIncomingPayload(data);
          } catch (err) {
            console.warn('Failed to parse SSE message:', err);
          }
        });

        eventSource.onerror = () => {
          if (!isMountedRef.current) return;
          setIsConnected(false);
          setIsReconnecting(true);
          setError('Real-time connection interrupted. Reconnecting...');

          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }

          // Exponential backoff reconnection: 1s, 2s, 4s, ... max 15s
          const nextDelay = Math.min(15000, backoffRef.current);
          backoffRef.current = nextDelay * 1.5;

          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) connectSSE();
          }, nextDelay);
        };
      } catch (err: any) {
        if (!isMountedRef.current) return;
        setIsConnected(false);
        setError(err?.message || 'SSE initialization error');
      }
    };

    connectSSE();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  }, [parkingAreaId, enabled, handleIncomingPayload]);

  return {
    isConnected,
    isReconnecting,
    error,
    lastPayload,
    provider,
  };
}
