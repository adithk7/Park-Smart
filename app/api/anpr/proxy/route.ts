import { NextRequest, NextResponse } from 'next/server';

const EDGE_URL = process.env.EDGE_ANPR_URL || 'http://localhost:8000';

/**
 * POST /api/anpr/proxy
 * Proxies a base64 image frame to the edge ANPR service.
 * Staff console webcam sends frames here; result is returned to the client.
 * Body: { frame: string (base64 JPEG), parkingAreaId: string, gateId?: string }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.frame) {
    return NextResponse.json({ success: false, message: 'frame (base64) is required' }, { status: 400 });
  }

  try {
    const res = await fetch(`${EDGE_URL}/anpr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frame: body.frame,
        parkingAreaId: body.parkingAreaId ?? '',
        gateId: body.gateId ?? 'MAIN',
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, message: 'ANPR service error', status: res.status }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    // Edge not running — return graceful degradation signal
    if (err?.name === 'TimeoutError' || err?.cause?.code === 'ECONNREFUSED') {
      return NextResponse.json({
        success: false,
        message: 'ANPR service unavailable — use manual plate entry',
        fallback: true,
      }, { status: 503 });
    }
    return NextResponse.json({ success: false, message: 'Proxy error' }, { status: 500 });
  }
}
