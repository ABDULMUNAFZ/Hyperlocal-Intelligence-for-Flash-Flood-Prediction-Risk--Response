// FloodGuard Login Page
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { FloodGuardLogo } from '../components/common/FloodGuardLogo';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        const response = await api.login(email, password);
        localStorage.setItem('access_token', response.access_token);
        localStorage.setItem('refresh_token', response.refresh_token);
      } else {
        const response = await api.register({ email, password, full_name: name });
        localStorage.setItem('access_token', response.access_token);
        localStorage.setItem('refresh_token', response.refresh_token);
      }
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#181A1E] mb-4">
            <FloodGuardLogo variant="citron" className="h-9 w-auto" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">FloodGuard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Flash Flood Prediction System for Hilly Regions
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">SIH 26192</p>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
          <div className="mb-6">
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              {['login', 'register'].map(mode => (
                <button
                  key={mode}
                  onClick={() => setIsLogin(mode === 'login')}
                  className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                    isLogin === (mode === 'login')
                      ? 'text-blue-600 border-b-2 border-blue-600 dark:border-blue-400'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Your full name"
                  required={!isLogin}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                required
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                minLength={isLogin ? undefined : 8}
              />
            </div>

            {!isLogin && (
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Password must be at least 8 characters
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {isLogin ? 'Signing in...' : 'Creating account...'}
                </span>
              ) : (
                isLogin ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-500">
            <p>Demo credentials: <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">demo@floodguard.in</code> / <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">demo123</code></p>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-center text-sm text-gray-500 dark:text-gray-500 mb-4">Quick Access (Demo)</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { role: 'Disaster Manager', email: 'dm@floodguard.in' },
                { role: 'Analyst', email: 'analyst@floodguard.in' },
                { role: 'Public User', email: 'public@floodguard.in' },
                { role: 'Admin', email: 'admin@floodguard.in' },
              ].map((demo, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setEmail(demo.email);
                    setPassword('demo123');
                    setIsLogin(true);
                  }}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {demo.role}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-500">
        <p>FloodGuard - SIH 26192 Flash Flood Prediction System</p>
        <p className="mt-1">
          <a href="https://github.com" className="text-blue-600 hover:underline" target="_blank" rel="noopener">
            GitHub
          </a> |{' '}
          <a href="#" className="text-blue-600 hover:underline">Documentation</a> |{' '}
          <a href="#" className="text-blue-600 hover:underline">Support</a>
        </p>
      </div>
    </div>
  );
};

export default Login;