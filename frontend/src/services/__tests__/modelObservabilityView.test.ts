import { describe, expect, it } from 'vitest';
import { CONNECT_PROMPT, deriveObservabilityView } from '../modelObservabilityView';
import type { ModelObservabilitySummary } from '../modelObservabilityApi';

const base = (over: Partial<ModelObservabilitySummary['arize']> = {}, stats: Partial<ModelObservabilitySummary['stats']> = {}): ModelObservabilitySummary => ({
  source: 'floodguard_model_observability',
  model: { name: 'FloodGuard Risk Prediction', id: 'FloodGuard-Risk-Prediction', version: '1.2.0', type: 'binary classification (flood probability)' },
  stats: { day: '2026-10-07', scope: 'all_instances', predictions: 1234, avg_latency_ms: 18.456, high_risk_pct: 12.5, last_prediction_at: '2026-10-07T09:00:00+00:00', ...stats },
  arize: {
    enabled: false, configured: false, status: 'not_connected', message: 'Arize AI not connected',
    model_id: null, last_export_at: null, last_error_at: null, exported_records: 0, app_url: null, ...over,
  },
  drift: { source: 'arize', note: 'Computed by Arize monitors.' },
});

describe('deriveObservabilityView', () => {
  it('disconnected: shows the connect prompt and still shows FloodGuard stats', () => {
    const v = deriveObservabilityView(base());
    expect(v.connection.label).toBe('Arize AI not connected');
    expect(v.showConnectPrompt).toBe(true);
    expect(CONNECT_PROMPT).toMatch(/Connect Arize AI/);
    expect(v.predictionsToday).toBe('1,234');
    expect(v.arizeLink).toBeNull();
  });

  it('connected: green state, no prompt, link to the Arize app', () => {
    const v = deriveObservabilityView(base({ enabled: true, configured: true, status: 'connected', message: 'Arize AI Connected', app_url: 'https://app.arize.com/' }));
    expect(v.connection).toMatchObject({ label: 'Arize AI Connected', tone: 'good' });
    expect(v.showConnectPrompt).toBe(false);
    expect(v.arizeLink).toBe('https://app.arize.com/');
    expect(v.avgLatency).toBe('18.5 ms');
    expect(v.highRiskShare).toBe('12.5%');
  });

  it('export failure: shows "temporarily unavailable" with the safe backend message', () => {
    const v = deriveObservabilityView(base({ enabled: true, configured: true, status: 'error', message: 'Arize is unreachable' }));
    expect(v.connection).toMatchObject({ label: 'Arize AI temporarily unavailable', tone: 'bad', detail: 'Arize is unreachable' });
    expect(v.drift.value).toBe('In Arize');
  });

  it('never invents values when there is no data', () => {
    const v = deriveObservabilityView(base({}, { predictions: 0, avg_latency_ms: null, high_risk_pct: null, last_prediction_at: null }));
    expect([v.avgLatency, v.highRiskShare, v.lastEvent]).toEqual(['—', '—', null]);
    expect(v.drift.value).toBe('—');
  });

  it('keeps sub-millisecond latency visible instead of rounding it to zero', () => {
    expect(deriveObservabilityView(base({}, { avg_latency_ms: 0.04 })).avgLatency).toBe('0.04 ms');
  });

  it('flags per-instance numbers when shared counters are unavailable', () => {
    expect(deriveObservabilityView(base({}, { scope: 'this_instance' })).scopeNote).toMatch(/this server instance/);
  });

  it('the summary type carries no credential fields', () => {
    const keys = JSON.stringify(base({ enabled: true, configured: true, status: 'connected' }));
    expect(keys).not.toMatch(/api_key|space_id|token|secret|password/i);
  });
});
