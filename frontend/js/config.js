// Auto-detected base path so the app works both on GitHub Pages
// (/sr-money-tracker/) and on Vercel at the site root (/).
const m = import.meta.url.match(/^https?:\/\/[^/]+\/(.*)\/js\/config\.js$/);
export const BASE_PATH = m && m[1] ? '/' + m[1] : '';

// Backend API base URL.
// - Local backend:              http://localhost:3001/api  (auto when served from localhost)
// - Combined Vercel deploy:     /api  (same origin, auto)
// - GH Pages + separate Vercel: set the full URL here, e.g. https://sr-money-tracker-backend.vercel.app/api
const isLocal = typeof location !== 'undefined' &&
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
export const API_BASE = isLocal ? 'http://localhost:3001/api' : '/api';
