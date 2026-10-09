import { NextRequest } from 'next/server';
import { realtimeEmitter } from '@/lib/realtime/publisher';
import { ParkingRealtimePayload } from '@/lib/realtime/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/realtime/sse?parkingAreaId=...
 * Server-Sent Events endpoint streaming real-time parking updates.
 * Provides instant live updates for connected browser sessions.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parkingAreaId = searchParams.get('parkingAreaId');

  const encoder = new TextEncoder();
  const eventChannel = parkingAreaId ? `parking:${parkingAreaId}` : 'parking:all';

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // 1. Initial connection message
      const initialPayload = JSON.stringify({
        status: 'CONNECTED',
        channel: eventChannel,
        timestamp: new Date().toISOString(),
      });
      controller.enqueue(encoder.encode(`event: connected\ndata: ${initialPayload}\n\n`));

      // 2. Real-time event listener
      const onUpdate = (data: ParkingRealtimePayload) => {
        try {
          const message = `event: parking_update\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (err) {
          console.warn('Error enqueuing SSE message:', err);
        }
      };

      realtimeEmitter.on(eventChannel, onUpdate);

      // 3. Heartbeat ping every 20 seconds to prevent edge/proxy timeout
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          clearInterval(pingInterval);
        }
      }, 20000);

      // 4. Cleanup function
      cleanup = () => {
        clearInterval(pingInterval);
        realtimeEmitter.off(eventChannel, onUpdate);
      };
    },
    cancel() {
      if (cleanup) cleanup();
    },
  });

  // Handle client abort
  req.signal.addEventListener('abort', () => {
    if (cleanup) cleanup();
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform, no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
