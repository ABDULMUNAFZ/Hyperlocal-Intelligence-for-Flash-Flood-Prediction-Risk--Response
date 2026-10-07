// Client for FloodGuard's model-observability summary. Arize AI credentials never reach the browser:
// the backend exports predictions to Arize and only returns aggregate stats and connection state.
import { api } from './api';

export type ArizeStatus = 'not_connected' | 'pending' | 'connected' | 'error';

export interface ModelObservabilitySummary {
  source: 'floodguard_model_observability';
  model: { name: string; id: string; version: string | null; type: string };
  stats: {
    day: string;
    scope: 'all_instances' | 'this_instance';
    predictions: number;
    avg_latency_ms: number | null;
    high_risk_pct: number | null;
    last_prediction_at: string | null;
  };
  arize: {
    enabled: boolean;
    configured: boolean;
    status: ArizeStatus;
    message: string;
    model_id: string | null;
    last_export_at: string | null;
    last_error_at: string | null;
    exported_records: number;
    app_url: string | null;
  };
  drift: { source: 'arize'; note: string };
}

export const modelObservabilityApi = {
  summary: async () => (await api.get<ModelObservabilitySummary>('/model-observability/summary')).data,
};
