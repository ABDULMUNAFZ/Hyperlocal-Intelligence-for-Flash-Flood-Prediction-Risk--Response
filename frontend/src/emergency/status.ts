// Rescue state machine — mirrors backend app/models/emergency.py::RescueStatus and
// app/services/emergency/core.py::USER_TRANSITIONS exactly (see tests).

export enum RescueStatus {
  SAFE = 'SAFE',
  NEEDS_ASSISTANCE = 'NEEDS_ASSISTANCE',
  LOCATION_PINNED = 'LOCATION_PINNED',
  RESCUE_REQUESTED = 'RESCUE_REQUESTED',
  RESPONDER_ASSIGNED = 'RESPONDER_ASSIGNED',
  EVACUATING = 'EVACUATING',
  EN_ROUTE_TO_SHELTER = 'EN_ROUTE_TO_SHELTER',
  REACHED_SAFE_LOCATION = 'REACHED_SAFE_LOCATION',
  RESOLVED = 'RESOLVED',
}

const S = RescueStatus;

export const USER_TRANSITIONS: Record<RescueStatus | 'NONE', RescueStatus[]> = {
  NONE: [S.SAFE, S.NEEDS_ASSISTANCE, S.LOCATION_PINNED, S.RESCUE_REQUESTED],
  [S.SAFE]: [S.NEEDS_ASSISTANCE, S.LOCATION_PINNED, S.RESCUE_REQUESTED, S.EVACUATING, S.EN_ROUTE_TO_SHELTER],
  [S.NEEDS_ASSISTANCE]: [S.SAFE, S.LOCATION_PINNED, S.RESCUE_REQUESTED, S.EVACUATING, S.EN_ROUTE_TO_SHELTER],
  [S.LOCATION_PINNED]: [S.SAFE, S.NEEDS_ASSISTANCE, S.RESCUE_REQUESTED, S.EVACUATING, S.EN_ROUTE_TO_SHELTER],
  [S.RESCUE_REQUESTED]: [S.SAFE, S.EVACUATING, S.EN_ROUTE_TO_SHELTER],
  [S.RESPONDER_ASSIGNED]: [S.SAFE, S.EVACUATING, S.EN_ROUTE_TO_SHELTER, S.RESCUE_REQUESTED],
  [S.EVACUATING]: [S.SAFE, S.EN_ROUTE_TO_SHELTER, S.RESCUE_REQUESTED],
  [S.EN_ROUTE_TO_SHELTER]: [S.SAFE, S.RESCUE_REQUESTED, S.EVACUATING, S.REACHED_SAFE_LOCATION],
  [S.REACHED_SAFE_LOCATION]: [S.SAFE, S.RESCUE_REQUESTED, S.EN_ROUTE_TO_SHELTER],
  [S.RESOLVED]: [],
};

export function userCan(from: RescueStatus | null | undefined, to: RescueStatus): boolean {
  if (from === to) return true;
  return USER_TRANSITIONS[from ?? 'NONE'].includes(to);
}

export const STATUS_LABEL: Record<RescueStatus, string> = {
  [S.SAFE]: 'Safe',
  [S.NEEDS_ASSISTANCE]: 'Needs assistance',
  [S.LOCATION_PINNED]: 'Location pinned',
  [S.RESCUE_REQUESTED]: 'Rescue required',
  [S.RESPONDER_ASSIGNED]: 'Responder assigned',
  [S.EVACUATING]: 'Evacuating',
  [S.EN_ROUTE_TO_SHELTER]: 'En route to safe location',
  [S.REACHED_SAFE_LOCATION]: 'Reached safe location',
  [S.RESOLVED]: 'Resolved',
};

/** Map colour class: red = rescue required, orange = evacuating / needs attention, yellow = pinned, green = safe. */
export type StatusTone = 'red' | 'orange' | 'yellow' | 'green' | 'grey';
export function statusTone(s: RescueStatus | string): StatusTone {
  switch (s) {
    case S.RESCUE_REQUESTED:
    case S.RESPONDER_ASSIGNED:
      return 'red';
    case S.NEEDS_ASSISTANCE:
    case S.EVACUATING:
    case S.EN_ROUTE_TO_SHELTER:
      return 'orange';
    case S.LOCATION_PINNED:
      return 'yellow';
    case S.REACHED_SAFE_LOCATION:
    case S.SAFE:
      return 'green';
    default:
      return 'grey';
  }
}

export const TONE_HEX: Record<StatusTone, string> = { red: '#e03131', orange: '#f76707', yellow: '#f5b700', green: '#2f9e44', grey: '#868e96' };
