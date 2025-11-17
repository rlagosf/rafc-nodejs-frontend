// src/services/api.js
import axios from 'axios';

export const TOKEN_KEY = 'rafc_token';

/* -------------------- Base URL (determinista) -------------------- */
const pickBaseUrl = () => {
  // Vite reemplaza en build
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  let url = (typeof envUrl === 'string' && envUrl.trim()) || 'http://127.0.0.1:8000';

  // normalizaciones
  if (url.endsWith('/')) url = url.slice(0, -1);
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;

  // Guardia: en producción no deberíamos hablarle a localhost
  if (import.meta.env.PROD && /(^http:\/\/localhost)|127\.0\.0\.1/.test(url)) {
    console.warn('[RAFC] API_BASE_URL en producción apunta a localhost:', url);
  }
  return url;
};

export const API_BASE_URL = pickBaseUrl(); // 👈 export para diagnóstico

/* -------------------- Token helpers -------------------- */
export const setToken = (token) => {
  if (token && typeof token === 'string') {
    localStorage.setItem(TOKEN_KEY, token);
  }
};
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

/* -------------------- Axios instance -------------------- */
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 15000,
  // withCredentials: false, // habilitar si usas cookies/sesiones
});

/* -------------------- Interceptors -------------------- */
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    // No pisar Authorization si ya venía
    if (!config.headers?.Authorization) {
      config.headers = Object.assign({}, config.headers, { Authorization: `Bearer ${token}` });
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const raw = error;
    const status = raw?.response?.status ?? 0;
    const data = raw?.response?.data ?? null;

    // 401 → limpiar token
    if (status === 401) {
      clearToken();
      // opcional: redirigir a /login aquí
      // if (window?.location?.pathname !== '/login') window.location.href = '/login';
    }

    const norm = {
      status,
      message:
        (data && (data.message || data.detail || data.error)) ||
        raw?.message ||
        'Error de red o del servidor',
      data,
      response: raw?.response || null,
      request: raw?.request || null,
      code: raw?.code,
      config: raw?.config,
      _raw: raw,
    };
    return Promise.reject(norm);
  }
);

export default api;
