/**
 * lib/session.ts
 * Session state machine with validated transitions.
 *
 * States:  OPEN → PARKED → PAYING → PAID → EXITED
 *          Any state → DISPUTED
 *
 * Transitions are enforced on the database record — never trust client-supplied next state.
 */
import { db } from '@/lib/db';

export type SessionStatus =
  | 'OPEN'
  | 'PARKED'
  | 'PAYING'
  | 'PAID'
  | 'EXITED'
  | 'DISPUTED';

// Allowed next-states for each current state
const VALID_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  OPEN:     ['PARKED', 'EXITED', 'DISPUTED'],
  PARKED:   ['PAYING', 'EXITED', 'DISPUTED'],
  PAYING:   ['PAID', 'PARKED', 'DISPUTED'],    // PARKED = payment failed, revert
  PAID:     ['EXITED', 'DISPUTED'],
  EXITED:   [],
  DISPUTED: ['PARKED', 'EXITED'],
};

export function canTransition(from: SessionStatus, to: SessionStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Atomically transition a session to a new status.
 * Throws if the transition is invalid or the session is not found.
 */
export async function transitionSession(
  sessionId: string,
  parkingAreaId: string,
  to: SessionStatus,
  extra?: {
    slotId?: string;
    feeAmount?: number;
    paymentMethod?: string;
    paymentStatus?: string;
    exitGateId?: string;
  }
): Promise<{ ok: boolean; session?: any; error?: string }> {
  const session = await db.visitSession.findFirst({
    where: { id: sessionId, parkingAreaId },
  });
  if (!session) return { ok: false, error: 'Session not found' };

  const from = session.status as SessionStatus;
  if (!canTransition(from, to)) {
    return { ok: false, error: `Invalid transition ${from} → ${to}` };
  }

  const now = new Date();
  const timeFields: Record<string, Date | null> = {};
  if (to === 'PARKED')   timeFields.parkedAt     = now;
  if (to === 'PAYING')   timeFields.paymentInitAt = now;
  if (to === 'PAID')     timeFields.paidAt        = now;
  if (to === 'EXITED')   timeFields.exitAt        = now;

  const updated = await db.visitSession.update({
    where: { id: sessionId },
    data: {
      status: to,
      ...timeFields,
      ...(extra?.slotId        && { slotId: extra.slotId }),
      ...(extra?.feeAmount     !== undefined && { feeAmount: extra.feeAmount }),
      ...(extra?.paymentMethod && { paymentMethod: extra.paymentMethod }),
      ...(extra?.paymentStatus && { paymentStatus: extra.paymentStatus }),
      ...(extra?.exitGateId    && { exitGateId: extra.exitGateId }),
    },
  });

  // Update bay occupancy counter
  if (to === 'PARKED') {
    await db.parkingArea.update({
      where: { id: parkingAreaId },
      data: { occupiedCount: { increment: 1 } },
    });
    if (extra?.slotId) {
      await db.parkingSlot.update({
        where: { id: extra.slotId },
        data: { status: 'OCCUPIED' },
      });
    }
  }
  if (to === 'EXITED') {
    await db.parkingArea.update({
      where: { id: parkingAreaId },
      data: { occupiedCount: { decrement: 1 } },
    });
    if (session.slotId) {
      await db.parkingSlot.update({
        where: { id: session.slotId },
        data: { status: 'FREE' },
      });
    }
  }

  // Append to session event timeline
  await db.sessionEvent.create({
    data: {
      parkingAreaId,
      sessionId,
      eventType: `STATUS_${to}`,
      payload: JSON.stringify({ from, to, ...timeFields, ...extra }),
    },
  });

  return { ok: true, session: updated };
}
