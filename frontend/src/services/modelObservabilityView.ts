// Turns the backend summary into what the "AI Model Intelligence" panel shows. Pure, so the
// connected / disconnected / error states are unit-tested without rendering. Values are only ever
// taken from the summary; a missing value is shown as "—", never estimated.
import type { ModelObservabilitySummary } from './modelObservabilityApi';

export type Tone = 'good' | 'warn' | 'bad' | 'neutral';

export interface ObservabilityView {
  connection: { label: string; tone: Tone; detail: string };
  showConnectPrompt: boolean;
  modelName: string;
  modelVersion: string;
  predictionsToday: string;
  avgLatency: string;
  highRiskShare: string;
  drift: { value: string; hint: string };
  lastEvent: string | null;
  scopeNote: string | null;
  arizeLink: string | null;
}

const DASH = '—';

export const CONNECT_PROMPT =
  'Connect Arize AI to enable model observability, drift monitoring and prediction analytics.';

export function deriveObservabilityView(s: ModelObservabilitySummary): ObservabilityView {
  const { arize, stats, model } = s;
  const connection =
    arize.status === 'connected'
      ? { label: 'Arize AI Connected', tone: 'good' as const, detail: arize.message }
      : arize.status === 'pending'
        ? { label: 'Arize AI configured', tone: 'neutral' as const, detail: arize.message }
        : arize.status === 'error'
          ? { label: 'Arize AI temporarily unavailable', tone: 'bad' as const, detail: arize.message }
          : { label: 'Arize AI not connected', tone: 'neutral' as const, detail: arize.message };

  return {
    connection,
    showConnectPrompt: arize.status === 'not_connected',
    modelName: model.name,
    modelVersion: model.version ?? 'not registered',
    predictionsToday: stats.predictions.toLocaleString('en-IN'),
    avgLatency: stats.avg_latency_ms === null ? DASH : `${stats.avg_latency_ms.toFixed(stats.avg_latency_ms < 10 ? 2 : 1)} ms`,
    highRiskShare: stats.high_risk_pct === null ? DASH : `${stats.high_risk_pct.toFixed(1)}%`,
    drift: arize.status === 'not_connected'
      ? { value: DASH, hint: 'needs Arize AI' }
      : { value: 'In Arize', hint: 'computed by Arize monitors' },
    lastEvent: stats.last_prediction_at,
    scopeNote: stats.scope === 'this_instance' ? 'Shared counters unavailable; showing this server instance only.' : null,
    arizeLink: arize.status === 'not_connected' ? null : arize.app_url,
  };
}
