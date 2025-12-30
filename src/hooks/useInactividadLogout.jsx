// src/hooks/useInactividadLogout.jsx
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api, { getToken, clearToken } from "../services/api";

/**
 * Hook de expulsión por inactividad.
 * - timeoutMs: tiempo máximo de inactividad para expulsar (por defecto 5 min).
 * - pingMs: cadencia del chequeo (por defecto 15s).
 * - storageKey: clave de sincronización entre pestañas.
 * - forceKey: clave para forzar logout entre pestañas.
 * - redirectTo: ruta a la que se redirige al expirar (admin: /login, apoderado: /login-apoderado).
 */
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
  const attachedRef = useRef(false);
  const lastSetRef = useRef(0);

  // Marcar actividad (debounce 1s)
  const markActivity = (ts = Date.now()) => {
    if (ts - lastSetRef.current < 1000) return;
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

    // ✅ ahora respeta redirectTo
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

    const interceptorId = api.interceptors.request.use((cfg) => {
      markActivity();
      return cfg;
    });

    const onAnyActivity = () => markActivity();
    const opts = { passive: true };
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];

    if (!attachedRef.current) {
      events.forEach((ev) => window.addEventListener(ev, onAnyActivity, opts));
      const onVis = () => {
        if (!document.hidden) markActivity();
      };
      document.addEventListener("visibilitychange", onVis);
      attachedRef.current = true;

      // Guardamos para cleanup correcto (sin reventar)
      (attachedRef.current && (attachedRef.current = { onVis })) || null;
    }

    const onStorage = (e) => {
      if (e.key === forceKey && e.newValue) {
        doLogoutEverywhere();
      }
    };
    window.addEventListener("storage", onStorage);

    try {
      bcRef.current = new BroadcastChannel("rafc_bc");
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
      try {
        clearInterval(timerRef.current);
      } catch {}
      try {
        api.interceptors.request.eject(interceptorId);
      } catch {}
      try {
        window.removeEventListener("storage", onStorage);
      } catch {}

      // quitar eventos
      events.forEach((ev) => window.removeEventListener(ev, onAnyActivity, opts));
      try {
        document.removeEventListener("visibilitychange", attachedRef.current?.onVis);
      } catch {}

      if (bcRef.current) {
        try {
          bcRef.current.close();
        } catch {}
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
