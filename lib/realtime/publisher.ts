/**
 * lib/realtime/publisher.ts
 * Server-side authoritative event publisher.
 * Dispatches real-time availability and slot status events across Supabase Realtime (when configured)
 * and an internal SSE event bus for zero-config local development and testing.
 */
import { EventEmitter } from 'events';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getParkingAvailability } from '@/lib/availability';
import { ParkingRealtimePayload, RealtimeEventType, ParkingSlotSummary } from './types';

// Global singleton EventEmitter across Next.js dev server hot reloads
const globalForRealtime = globalThis as unknown as {
  realtimeEmitter: EventEmitter | undefined;
  supabaseServerClient: SupabaseClient | undefined;
};

export const realtimeEmitter =
  globalForRealtime.realtimeEmitter ?? new EventEmitter();
realtimeEmitter.setMaxListeners(200);

if (process.env.NODE_ENV !== 'production') {
  globalForRealtime.realtimeEmitter = realtimeEmitter;
}

// Lazy Supabase Server Client
function getSupabaseServerClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  if (!globalForRealtime.supabaseServerClient) {
    globalForRealtime.supabaseServerClient = createClient(url, key, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }

  return globalForRealtime.supabaseServerClient;
}

/**
 * Authoritatively computes current parking counts and broadcasts
 * sanitized public availability to connected clients.
 * Never broadcasts private booking records, phone numbers, or credentials.
 */
export async function broadcastParkingUpdate(
  parkingAreaId: string,
  type: RealtimeEventType,
  slot?: ParkingSlotSummary
): Promise<ParkingRealtimePayload | null> {
  if (!parkingAreaId) return null;

  try {
    const availability = await getParkingAvailability(parkingAreaId);

    const payload: ParkingRealtimePayload = {
      type,
      parkingAreaId,
      timestamp: new Date().toISOString(),
      slot,
      availability: {
        total: availability.total,
        free: availability.free,
        occupied: availability.occupied,
        reserved: availability.reserved,
        blocked: availability.blocked,
        available: availability.available,
      },
    };

    // 1. Dispatch locally via EventEmitter for SSE subscribers
    realtimeEmitter.emit(`parking:${parkingAreaId}`, payload);
    realtimeEmitter.emit('parking:all', payload);

    // 2. Dispatch via Supabase Realtime Broadcast if configured
    const supabase = getSupabaseServerClient();
    if (supabase) {
      const channel = supabase.channel(`parking:${parkingAreaId}`);
      channel
        .send({
          type: 'broadcast',
          event: 'availability_update',
          payload,
        })
        .catch((err) => {
          console.warn('Supabase Realtime broadcast warning:', err?.message || err);
        });
    }

    return payload;
  } catch (err) {
    console.error('Failed to broadcast real-time parking update:', err);
    return null;
  }
}
