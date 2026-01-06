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

/* -------------------- Token helpers (SOLID) -------------------- */
export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  // ✅ matar el “token fantasma” en la instancia privada
  delete apiPrivate.defaults.headers.common.Authorization;
};

export const setToken = (token) => {
  if (token && typeof token === "string") {
    localStorage.setItem(TOKEN_KEY, token);
    // ✅ setear header por defecto SOLO en la instancia privada
    apiPrivate.defaults.headers.common.Authorization = `Bearer ${token}`;
  }
};

/* -------------------- Axios instances -------------------- */
// ✅ Pública: JAMÁS manda Authorization (ideal landing)
export const apiPublic = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 15000,
});

// ✅ Privada: manda Authorization si hay token (ideal admin)
export const apiPrivate = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 15000,
});

// Alias para compatibilidad con imports existentes (admin)
const api = apiPrivate;

/* -------------------- Interceptors (PUBLIC) -------------------- */
// Blindaje: si por alguna razón llega Authorization, lo borra.
apiPublic.interceptors.request.use((config) => {
  config.headers = config.headers || {};
  if (config.headers.Authorization) delete config.headers.Authorization;
  if (config.headers.authorization) delete config.headers.authorization;
  return config;
});

/* -------------------- Interceptors (PRIVATE) -------------------- */
apiPrivate.interceptors.request.use((config) => {
  const token = getToken();

  config.headers = config.headers || {};

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    // ✅ si NO hay token: limpiamos cualquier Authorization colado
    if (config.headers.Authorization) delete config.headers.Authorization;
    if (config.headers.authorization) delete config.headers.authorization;
  }

  return config;
});

apiPrivate.interceptors.response.use(
  (res) => res,
  (error) => {
    const raw = error;
    const status = raw?.response?.status ?? 0;
    const data = raw?.response?.data ?? null;

    // 401 → limpiar token (y header) si el backend indica token inválido/expirado
    if (status === 401) {
      const msg = String(data?.message || "").toLowerCase();
      const shouldClear =
        msg.includes("token inválido") ||
        msg.includes("token invalido") ||
        msg.includes("expirado") ||
        msg.includes("falta bearer") ||
        msg.includes("invalid token") ||
        msg.includes("jwt") ||
        msg.includes("unauthorized");

      if (shouldClear) clearToken();
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
