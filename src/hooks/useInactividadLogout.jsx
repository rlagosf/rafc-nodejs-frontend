// src/hooks/useInactividadLogout.jsx
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api, { getToken, clearToken } from "../services/api";

export default function useInactividadLogout({
  timeoutMs = 5 * 60 * 1000,
  pingMs = 15 * 1000,
  storageKey = "rafc_lastActivity",
  forceKey = "rafc_forceLogout",
  redirectTo = "/login",
} = {}) {
  const navigate = useNavigate();

  const timerRef = useRef(null);
  const bcRef = useRef(null);

  const attachedRef = useRef(false);      // ✅ solo boolean
  const onVisRef = useRef(null);          // ✅ guarda handler visibilitychange

  const lastSetRef = useRef(0);

  const markActivity = (ts = Date.now()) => {
    if (ts - lastSetRef.current < 1000) return; // debounce 1s
    lastSetRef.current = ts;
    try {
      localStorage.setItem(storageKey, String(ts));
    } catch {}
  };

  const doLogoutEverywhere = () => {
    clearToken();
    try {
      localStorage.setItem(forceKey, String(Date.now()));
    } catch {}

    try {
      navigate(redirectTo, { replace: true });
    } catch {
      window.location.href = redirectTo;
    }
  };

  const checkInactivity = () => {
    const token = getToken();
    if (!token) return;

    let last = 0;
    try {
      last = Number(localStorage.getItem(storageKey) || "0");
    } catch {
      last = 0;
    }

    const now = Date.now();

    if (!last) {
      markActivity(now);
      return;
    }

    const idle = now - last;
    if (idle >= timeoutMs) doLogoutEverywhere();
  };

  useEffect(() => {
    if (getToken()) markActivity();

    // ✅ si hay requests, cuenta como actividad
    const interceptorId = api.interceptors.request.use((cfg) => {
      markActivity();
      return cfg;
    });

    // ✅ actividad real del usuario
    const onAnyActivity = () => markActivity();
    const opts = { passive: true };
    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
      "wheel",
    ];

    if (!attachedRef.current) {
      events.forEach((ev) => window.addEventListener(ev, onAnyActivity, opts));

      const onVis = () => {
        if (!document.hidden) markActivity();
      };
      onVisRef.current = onVis;
      document.addEventListener("visibilitychange", onVis);

      attachedRef.current = true;
    }

    // ✅ sincroniza logout entre pestañas del MISMO módulo
    const onStorage = (e) => {
      if (e.key === forceKey && e.newValue) doLogoutEverywhere();
      if (e.key === storageKey && e.newValue) {
        // opcional: no hacer nada; solo existe para “wake up”
      }
    };
    window.addEventListener("storage", onStorage);

    try {
      bcRef.current = new BroadcastChannel("rafc_bc_" + forceKey);
      bcRef.current.onmessage = (msg) => {
        if (msg?.data === "forceLogout") doLogoutEverywhere();
        if (msg?.data === "activityPing") markActivity();
      };
    } catch {
      bcRef.current = null;
    }

    timerRef.current = setInterval(checkInactivity, pingMs);
    checkInactivity();

    return () => {
      try { clearInterval(timerRef.current); } catch {}
      try { api.interceptors.request.eject(interceptorId); } catch {}
      try { window.removeEventListener("storage", onStorage); } catch {}

      events.forEach((ev) => window.removeEventListener(ev, onAnyActivity, opts));
      try {
        if (onVisRef.current) {
          document.removeEventListener("visibilitychange", onVisRef.current);
        }
      } catch {}

      if (bcRef.current) {
        try { bcRef.current.close(); } catch {}
        bcRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeoutMs, pingMs, storageKey, forceKey, redirectTo]);

  const forceLogout = () => {
    try {
      if (bcRef.current) bcRef.current.postMessage("forceLogout");
    } catch {}
    doLogoutEverywhere();
  };

  return { forceLogout, markActivityNow: () => markActivity() };
}
