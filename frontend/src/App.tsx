// FloodGuard Main App Component
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import WayanadCommandCenter from './pages/WayanadCommandCenter';
import { CommandCenterErrorBoundary } from './components/Wayanad/ErrorBoundary';
import FloodGuardLoader from './components/FloodGuardLoader';
// Lazy load pages for optimal bundle splitting
const LandingPage = lazy(() => import('./pages/LandingPage'));
const ProductionRoadmap = lazy(() => import('./pages/ProductionRoadmap'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
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
          <Suspense fallback={<FloodGuardLoader />}>
          <Routes>
            {/* 1. Master Premium Landing Page */}
            <Route path="/" element={<LandingPage />} />

            {/* 2. Operational Wayanad 3D Command Center */}
            <Route path="/app" element={<CommandCenterErrorBoundary><WayanadCommandCenter /></CommandCenterErrorBoundary>} />
            <Route path="/app/map" element={<CommandCenterErrorBoundary><WayanadCommandCenter /></CommandCenterErrorBoundary>} />
            <Route path="/command" element={<CommandCenterErrorBoundary><WayanadCommandCenter /></CommandCenterErrorBoundary>} />
            <Route path="/map" element={<CommandCenterErrorBoundary><WayanadCommandCenter /></CommandCenterErrorBoundary>} />

            {/* 3. Production Architecture & Deployment Roadmap */}
            <Route path="/production" element={<ProductionRoadmap />} />
            <Route path="/roadmap" element={<ProductionRoadmap />} />

            {/* 4. Admin Response Center */}
            <Route path="/app/admin" element={<AdminPage />} />
            <Route path="/admin" element={<AdminPage />} />

            {/* 5. Citizen Emergency App (Installable PWA) */}
            <Route path="/app/emergency" element={<EmergencyApp />} />
            <Route path="/emergency" element={<EmergencyApp />} />

            {/* 6. Simulations & What-If scenarios */}
            <Route path="/app/simulation" element={<Simulations />} />

            {/* 7. Previous South India prototype */}
            <Route path="/south-india" element={<CommandCenter />} />

            {/* 8. Authentication */}
            <Route path="/login" element={<Login />} />

            {/* 9. Standard Dashboard & Analytics views */}
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