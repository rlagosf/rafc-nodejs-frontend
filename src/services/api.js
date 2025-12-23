// src/services/api.js
import axios from "axios";

export const TOKEN_KEY = "rafc_token";

/* -------------------- Base URL (determinista) -------------------- */
const pickBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  let url =
    (typeof envUrl === "string" && envUrl.trim()) || "http://127.0.0.1:8000";

  if (url.endsWith("/")) url = url.slice(0, -1);
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;

  if (import.meta.env.PROD && /(^http:\/\/localhost)|127\.0\.0\.1/.test(url)) {
    console.warn("[RAFC] API_BASE_URL en producción apunta a localhost:", url);
  }
  return url;
};

export const API_BASE_URL = pickBaseUrl();

/* -------------------- Axios instance -------------------- */
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 15000,
});

/* -------------------- Token helpers (SOLID) -------------------- */
export const setToken = (token) => {
  if (token && typeof token === "string") {
    localStorage.setItem(TOKEN_KEY, token);
    // ✅ clave: setear header por defecto (evita re-leer siempre)
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  }
};

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  // ✅ clave: borrar header por defecto (mata el “token fantasma”)
  delete api.defaults.headers.common.Authorization;
};

/* -------------------- Interceptors -------------------- */
api.interceptors.request.use((config) => {
  const token = getToken();

  // ✅ si hay token: lo aseguramos
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  }

  // ✅ si NO hay token: limpiamos cualquier Authorization colado
  if (config?.headers?.Authorization) {
    delete config.headers.Authorization;
  }

  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const raw = error;
    const status = raw?.response?.status ?? 0;
    const data = raw?.response?.data ?? null;

    // 401 → limpiar token (y header)
    if (status === 401) {
      clearToken();
    }

    const norm = {
      status,
      message:
        (data && (data.message || data.detail || data.error)) ||
        raw?.message ||
        "Error de red o del servidor",
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
