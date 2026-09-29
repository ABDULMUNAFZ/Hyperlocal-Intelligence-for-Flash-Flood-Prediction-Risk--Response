// FloodGuard Main App Component
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import WayanadCommandCenter from './pages/WayanadCommandCenter';
import { CommandCenterErrorBoundary } from './components/Wayanad/ErrorBoundary';
// Secondary pages are code-split so the command center loads first
const CommandCenter = lazy(() => import('./pages/CommandCenter'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Map3D = lazy(() => import('./pages/Map3D'));
const RiskAnalysis = lazy(() => import('./pages/RiskAnalysis'));
const Simulations = lazy(() => import('./pages/Simulations'));
const Evacuation = lazy(() => import('./pages/Evacuation'));
const Alerts = lazy(() => import('./pages/Alerts'));
const AIAssistant = lazy(() => import('./pages/AIAssistant'));
const Settings = lazy(() => import('./pages/Settings'));
const Login = lazy(() => import('./pages/Login'));
const EmergencyApp = lazy(() => import('./pages/EmergencyApp'));
import { ProtectedRoute } from './components/ProtectedRoute';
import { LocationProvider } from './context/LocationContext';
import './styles/globals.css';

// Create query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <LocationProvider>
        <BrowserRouter>
          <Suspense fallback={null}>
          <Routes>
            {/* Primary: Wayanad 3D situational-awareness command center (real data only) */}
            <Route path="/" element={<CommandCenterErrorBoundary><WayanadCommandCenter /></CommandCenterErrorBoundary>} />
            <Route path="/command" element={<CommandCenterErrorBoundary><WayanadCommandCenter /></CommandCenterErrorBoundary>} />
            <Route path="/map" element={<CommandCenterErrorBoundary><WayanadCommandCenter /></CommandCenterErrorBoundary>} />
            {/* Previous South India prototype (uses illustrative, non-sourced sample data) */}
            <Route path="/south-india" element={<CommandCenter />} />

            {/* Citizen emergency app (installable PWA): alerts, location pin, rescue, evacuation */}
            <Route path="/emergency" element={<EmergencyApp />} />

            {/* Authentication */}
            <Route path="/login" element={<Login />} />

            {/* Standard Dashboard & Analytics views */}
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/risk" element={<RiskAnalysis />} />
              <Route path="/simulations" element={<Simulations />} />
              <Route path="/evacuation" element={<Evacuation />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/ai" element={<AIAssistant />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/legacy-map" element={<Map3D />} />
            </Route>
          </Routes>
          </Suspense>
        </BrowserRouter>
      </LocationProvider>
    </QueryClientProvider>
  );
};

export default App;