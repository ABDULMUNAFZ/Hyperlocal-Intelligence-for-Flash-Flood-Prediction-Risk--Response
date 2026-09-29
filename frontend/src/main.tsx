// FloodGuard Frontend Entry Point
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { initPwa } from './emergency/device';

initPwa(); // service worker + install prompt capture (no permission prompts here)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);