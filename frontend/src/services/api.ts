// FloodGuard Frontend API Service
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000/api/v1';

class ApiService {
  public client: AxiosInstance;

  async get<T = any>(url: string, config?: any) {
    return this.client.get<T>(url, config);
  }

  async post<T = any>(url: string, data?: any, config?: any) {
    return this.client.post<T>(url, data, config);
  }

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Request interceptor for auth
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('access_token');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
              const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                refresh_token: refreshToken,
              });
              const { access_token, refresh_token } = response.data;
              localStorage.setItem('access_token', access_token);
              localStorage.setItem('refresh_token', refresh_token);
              originalRequest.headers.Authorization = `Bearer ${access_token}`;
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth
  async login(email: string, password: string) {
    const params = new URLSearchParams();
    params.append('username', email);
    params.append('password', password);
    const response = await this.client.post('/auth/login', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data;
  }

  async register(data: { email: string; password: string; full_name?: string }) {
    const response = await this.client.post('/auth/register', data);
    return response.data;
  }

  async refreshToken(refreshToken: string) {
    const response = await this.client.post('/auth/refresh', { refresh_token: refreshToken });
    return response.data;
  }

  async getCurrentUser() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  // Regions
  async getRegions(params?: { level?: number; parent_id?: string; state_code?: string }) {
    const response = await this.client.get('/regions', { params });
    return response.data;
  }

  async getRegionTree(stateCode?: string) {
    const response = await this.client.get('/regions/tree', { params: { state_code: stateCode } });
    return response.data;
  }

  async getRegion(regionId: string) {
    const response = await this.client.get(`/regions/${regionId}`);
    return response.data;
  }

  async getRegionGeometry(regionId: string, simplify?: number) {
    const response = await this.client.get(`/regions/${regionId}/geometry`, { params: { simplify } });
    return response.data;
  }

  // Rainfall
  async getRainfallObservations(params: {
    start_time: string;
    end_time: string;
    source?: string;
    latitude?: number;
    longitude?: number;
    radius_km?: number;
    limit?: number;
  }) {
    const response = await this.client.get('/rainfall/observations', { params });
    return response.data;
  }

  async getRainfallGrids(params: {
    start_time: string;
    end_time: string;
    source?: string;
    limit?: number;
  }) {
    const response = await this.client.get('/rainfall/grids', { params });
    return response.data;
  }

  async getLatestRainfall(params: {
    latitude: number;
    longitude: number;
    radius_km?: number;
    hours?: number;
  }) {
    const response = await this.client.get('/rainfall/latest', { params });
    return response.data;
  }

  // Weather
  async getWeatherForecast(params: {
    latitude: number;
    longitude: number;
    source?: string;
    model?: string;
    hours?: number;
  }) {
    const response = await this.client.get('/weather/forecast', { params });
    return response.data;
  }

  async getForecastSummary(params: {
    latitude: number;
    longitude: number;
    source?: string;
    hours?: number;
  }) {
    const response = await this.client.get('/weather/forecast/summary', { params });
    return response.data;
  }

  async getCurrentWeather(params: {
    latitude: number;
    longitude: number;
    source?: string;
  }) {
    const response = await this.client.get('/weather/current', { params });
    return response.data;
  }

  // Terrain
  async getElevation(latitude: number, longitude: number, source?: string) {
    const response = await this.client.get('/terrain/elevation', { params: { latitude, longitude, source } });
    return response.data;
  }

  async getElevationProfile(coordinates: number[][], source?: string, numPoints?: number) {
    const response = await this.client.post('/terrain/elevation/profile', { coordinates, source, num_points: numPoints });
    return response.data;
  }

  async getSlopeAspect(latitude: number, longitude: number, radiusM?: number) {
    const response = await this.client.get('/terrain/slope-aspect', { params: { latitude, longitude, radius_m: radiusM } });
    return response.data;
  }

  async getWatersheds(params?: { region_id?: string; min_area?: number; limit?: number }) {
    const response = await this.client.get('/terrain/watersheds', { params });
    return response.data;
  }

  // Soil
  async getSoilProfile(latitude: number, longitude: number, properties?: string[], depths?: string[]) {
    const response = await this.client.get('/soil/profile', { params: { latitude, longitude, properties, depths } });
    return response.data;
  }

  // Land Cover
  async getLandCoverGrids(source?: string, year?: number) {
    const response = await this.client.get('/landcover/grids', { params: { source, year } });
    return response.data;
  }

  async getBuildings(regionId?: string, buildingType?: string, limit?: number) {
    const response = await this.client.get('/infrastructure/buildings', { params: { region_id: regionId, building_type: buildingType, limit } });
    return response.data;
  }

  async getRoads(regionId?: string, highwayType?: string, limit?: number) {
    const response = await this.client.get('/infrastructure/roads', { params: { region_id: regionId, highway_type: highwayType, limit } });
    return response.data;
  }

  async getCriticalInfrastructure(regionId?: string, category?: string, limit?: number) {
    const response = await this.client.get('/infrastructure/critical', { params: { region_id: regionId, category, limit } });
    return response.data;
  }

  // Population
  async getPopulationStats(regionId: string, year?: number) {
    const response = await this.client.get(`/population/stats/${regionId}`, { params: { year } });
    return response.data;
  }

  // Historical Floods
  async getHistoricalFloods(params?: {
    state?: string;
    district?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
  }) {
    const response = await this.client.get('/historical-floods', { params });
    return response.data;
  }

  async getHistoricalFlood(eventId: string) {
    const response = await this.client.get(`/historical-floods/${eventId}`);
    return response.data;
  }

  // Risk
  async getFloodRisks(params: {
    region_id?: string;
    latitude?: number;
    longitude?: number;
    radius_km?: number;
    min_risk?: number;
    max_risk?: number;
    forecast_hours?: number;
    limit?: number;
  }) {
    const response = await this.client.get('/risk', { params });
    return response.data;
  }

  async getRiskSummary(regionId: string, forecastHours?: number) {
    const response = await this.client.get(`/risk/summary/${regionId}`, { params: { forecast_hours: forecastHours } });
    return response.data;
  }

  async getRiskMap(regionId: string, params?: { forecast_hours?: number; resolution?: number; format?: string }) {
    const response = await this.client.get(`/risk/map/${regionId}`, { params });
    return response.data;
  }

  // Prediction Engine (Phase 5 ML Ensemble)
  async predict(params: {
    latitude: number;
    longitude: number;
    prediction_horizon_hours?: number;
    model_name?: string;
    use_ensemble?: boolean;
    return_uncertainty?: boolean;
    return_explanations?: boolean;
    top_k_features?: number;
  }) {
    const response = await this.client.post('/prediction/predict', params);
    return response.data;
  }

  // Simulation
  async createSimulation(data: any) {
    const response = await this.client.post('/simulations', data);
    return response.data;
  }

  async getSimulations(params?: { status?: string; limit?: number }) {
    const response = await this.client.get('/simulations', { params });
    return response.data;
  }

  async getSimulation(simId: string) {
    const response = await this.client.get(`/simulations/${simId}`);
    return response.data;
  }

  async getSimulationStatus(simId: string) {
    const response = await this.client.get(`/simulations/${simId}/status`);
    return response.data;
  }

  async getSimulationResults(simId: string) {
    const response = await this.client.get(`/simulations/${simId}/results`);
    return response.data;
  }

  // Evacuation
  async getEvacuationZones(regionId?: string) {
    const response = await this.client.get('/evacuation/zones', { params: { region_id: regionId } });
    return response.data;
  }

  async getShelters(regionId?: string) {
    const response = await this.client.get('/evacuation/shelters', { params: { region_id: regionId } });
    return response.data;
  }

  async getNearbyShelters(latitude: number, longitude: number, radiusKm?: number) {
    const response = await this.client.get('/evacuation/shelters/nearby', { params: { latitude, longitude, radius_km: radiusKm } });
    return response.data;
  }

  async getSafeRoute(params: {
    origin_lat: number;
    origin_lon: number;
    destination_lat: number;
    destination_lon: number;
    avoid_flooded?: boolean;
    max_flood_depth_m?: number;
    vehicle_type?: string;
  }) {
    const response = await this.client.post('/evacuation/safe-route', params);
    return response.data;
  }

  // Alerts
  async getActiveAlerts(params?: {
    region_id?: string;
    latitude?: number;
    longitude?: number;
    radius_km?: number;
  }) {
    const response = await this.client.get('/alerts/active', { params });
    return response.data;
  }

  async getAlerts(params?: { status?: string; severity?: string; limit?: number }) {
    const response = await this.client.get('/alerts', { params });
    return response.data;
  }

  // AI Assistant
  async chatWithAI(data: { message: string; session_id?: string; language?: string; context?: any }) {
    const response = await this.client.post('/ai/chat', data);
    return response.data;
  }

  async getAIConversations() {
    const response = await this.client.get('/ai/conversations');
    return response.data;
  }

  async getAIQueryTypes() {
    const response = await this.client.get('/ai/query-types');
    return response.data;
  }

  // Data Status
  async getDataSourceStatus() {
    const response = await this.client.get('/data-sources/status');
    return response.data;
  }

  async getHealthSummary() {
    const response = await this.client.get('/data-sources/health-summary');
    return response.data;
  }

  // IoT
  async registerSensor(data: {
    sensor_id: string;
    name?: string;
    sensor_type: string;
    latitude: number;
    longitude: number;
  }) {
    const response = await this.client.post('/iot/register', data);
    return response.data;
  }

  async ingestReading(data: {
    sensor_id: string;
    api_key: string;
    timestamp: string;
    latitude: number;
    longitude: number;
    rainfall_mm?: number;
    water_level_m?: number;
    soil_moisture_volumetric?: number;
    temperature_c?: number;
    humidity_percent?: number;
  }) {
    const response = await this.client.post('/iot/observations', data);
    return response.data;
  }

  async getSensors(sensorType?: string) {
    const response = await this.client.get('/iot/sensors', { params: { sensor_type: sensorType } });
    return response.data;
  }

  async getSensorReadings(sensorId: string, hours?: number) {
    const response = await this.client.get(`/iot/sensors/${sensorId}/readings`, { params: { hours } });
    return response.data;
  }

  // Health
  async healthCheck() {
    const response = await this.client.get('/health');
    return response.data;
  }
}

export const api = new ApiService();
export default api;