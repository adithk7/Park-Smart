/**
 * lib/realtime/types.ts
 * Type definitions for sanitized, secure real-time parking events.
 */

export type RealtimeEventType =
  | 'SLOT_UPDATED'
  | 'SLOT_OCCUPIED'
  | 'SLOT_FREED'
  | 'BOOKING_CREATED'
  | 'BOOKING_CANCELLED'
  | 'GATE_ENTRY'
  | 'GATE_EXIT'
  | 'CAPACITY_CHANGED';

export interface ParkingSlotSummary {
  slotId?: string;
  id?: string;
  slotNumber?: string;
  vehicleType?: string;
  status?: 'FREE' | 'OCCUPIED' | 'RESERVED' | 'BLOCKED';
}

export interface ParkingAvailabilityCounts {
  total: number;
  free: number;
  occupied: number;
  reserved: number;
  blocked: number;
  available: number;
}

export interface ParkingRealtimePayload {
  type: RealtimeEventType;
  parkingAreaId: string;
  timestamp: string;
  slot?: ParkingSlotSummary;
  availability: ParkingAvailabilityCounts;
}
