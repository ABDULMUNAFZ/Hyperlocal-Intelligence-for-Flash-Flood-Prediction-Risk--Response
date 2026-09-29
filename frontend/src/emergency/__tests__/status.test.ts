// The rescue status model is shared by frontend and backend: this test fails if they drift apart.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RescueStatus, USER_TRANSITIONS, userCan, statusTone, STATUS_LABEL } from '../status';

const BACKEND = resolve(__dirname, '../../../../backend/app');

function backendEnum(): string[] {
  const src = readFileSync(`${BACKEND}/models/emergency.py`, 'utf8');
  const block = src.slice(src.indexOf('class RescueStatus'), src.indexOf('\n\n', src.indexOf('class RescueStatus')));
  return [...block.matchAll(/^\s+([A-Z_]+)\s*=\s*"([A-Z_]+)"/gm)].map((m) => m[2]);
}

function backendUserTransitions(): Record<string, string[]> {
  const src = readFileSync(`${BACKEND}/services/emergency/core.py`, 'utf8');
  const block = src.slice(src.indexOf('USER_TRANSITIONS'), src.indexOf('}\n', src.indexOf('USER_TRANSITIONS')));
  const out: Record<string, string[]> = {};
  for (const m of block.matchAll(/^\s+(None|S\.[A-Z_]+):\s*(set\(\)|\{([^}]*)\})/gm)) {
    const key = m[1] === 'None' ? 'NONE' : m[1].slice(2);
    out[key] = m[3] ? m[3].split(',').map((x) => x.trim().replace(/^S\./, '')).filter(Boolean).sort() : [];
  }
  return out;
}

describe('rescue status model', () => {
  it('has exactly the backend enum values', () => {
    expect(Object.values(RescueStatus).sort()).toEqual(backendEnum().sort());
    expect(Object.keys(STATUS_LABEL).sort()).toEqual(backendEnum().sort());
  });

  it('mirrors the backend user transition table', () => {
    const be = backendUserTransitions();
    const fe = Object.fromEntries(Object.entries(USER_TRANSITIONS).map(([k, v]) => [k, [...v].sort()]));
    expect(fe).toEqual(be);
  });

  it('enforces key rules', () => {
    expect(userCan(null, RescueStatus.RESCUE_REQUESTED)).toBe(true);
    expect(userCan(RescueStatus.RESCUE_REQUESTED, RescueStatus.LOCATION_PINNED)).toBe(false);
    expect(userCan(RescueStatus.LOCATION_PINNED, RescueStatus.REACHED_SAFE_LOCATION)).toBe(false); // only via a journey
    expect(userCan(RescueStatus.EN_ROUTE_TO_SHELTER, RescueStatus.REACHED_SAFE_LOCATION)).toBe(true);
    expect(userCan(RescueStatus.RESOLVED, RescueStatus.SAFE)).toBe(false);
    for (const s of Object.values(RescueStatus)) expect(userCan(s, RescueStatus.RESOLVED)).toBe(s === RescueStatus.RESOLVED);
  });

  it('maps statuses to the responder map colours', () => {
    expect(statusTone('RESCUE_REQUESTED')).toBe('red');
    expect(statusTone('RESPONDER_ASSIGNED')).toBe('red');
    expect(statusTone('EVACUATING')).toBe('orange');
    expect(statusTone('NEEDS_ASSISTANCE')).toBe('orange');
    expect(statusTone('EN_ROUTE_TO_SHELTER')).toBe('orange');
    expect(statusTone('LOCATION_PINNED')).toBe('yellow');
    expect(statusTone('REACHED_SAFE_LOCATION')).toBe('green');
  });
});
