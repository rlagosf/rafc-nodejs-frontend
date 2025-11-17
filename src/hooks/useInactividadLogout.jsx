// src/hooks/useInactividadLogout.jsx
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getToken, clearToken } from '../services/api';

/**
 * Hook de expulsión por inactividad.
 * - timeoutMs: tiempo máximo de inactividad para expulsar (por defecto 5 min).
 * - pingMs: cadencia del chequeo (por defecto 15s).
 * - storageKey: clave de sincronización entre pestañas.
 */
export default function useInactividadLogout({
  timeoutMs = 5 * 60 * 1000,
  pingMs = 15 * 1000,
  storageKey = 'rafc_lastActivity',
  forceKey = 'rafc_forceLogout',
} = {}) {
  const navigate = useNavigate();
  const timerRef = useRef(null);
  const bcRef = useRef(null); // BroadcastChannel (si el browser lo soporta)
  const attachedRef = useRef(false);
  const lastSetRef = useRef(0);

  // Marcar actividad (con leve “debounce”)
  const markActivity = (ts = Date.now()) => {
    // evita spamear el storage muchas veces por segundo
    if (ts - lastSetRef.current < 1000) return;
    lastSetRef.current = ts;
    try {
      localStorage.setItem(storageKey, String(ts));
    } catch (_e) {}
  };

  const doLogoutEverywhere = () => {
    // borra token local
    clearToken();
    try {
      // propagar a otras pestañas
      localStorage.setItem(forceKey, String(Date.now()));
    } catch (_e) {}
    // navegación de seguridad
    try {
      navigate('/login', { replace: true });
    } catch {
      window.location.href = '/login';
    }
  };

  // Chequeo periódico
  const checkInactivity = () => {
    // si no hay token, no hay nada que hacer (evita expulsar “en loop” en login)
    const token = getToken();
    if (!token) return;

    let last = 0;
    try {
      last = Number(localStorage.getItem(storageKey) || '0');
    } catch {
      last = 0;
    }
    const now = Date.now();
    if (!last) {
      // primera vez: marca ahora para iniciar conteo
      markActivity(now);
      return;
    }
    const idle = now - last;
    if (idle >= timeoutMs) {
      doLogoutEverywhere();
    }
  };

  useEffect(() => {
    // Inicializa marca de actividad si hay token
    if (getToken()) {
      markActivity();
    }

    // Interceptor de axios: cualquier request cuenta como actividad
    const interceptorId = api.interceptors.request.use((cfg) => {
      markActivity();
      return cfg;
    });

    // Eventos de actividad del usuario
    const onAnyActivity = () => markActivity();
    const opts = { passive: true };
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    if (!attachedRef.current) {
      events.forEach((ev) => window.addEventListener(ev, onAnyActivity, opts));
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) markActivity(); // al volver a la pestaña, cuenta como actividad
      });
      attachedRef.current = true;
    }

    // Sincronización entre pestañas: storage event
    const onStorage = (e) => {
      if (e.key === forceKey && e.newValue) {
        // otra pestaña pidió logout
        doLogoutEverywhere();
      }
    };
    window.addEventListener('storage', onStorage);

    // BroadcastChannel para sincronía (opcional si está disponible)
    try {
      bcRef.current = new BroadcastChannel('rafc_bc');
      bcRef.current.onmessage = (msg) => {
        if (msg?.data === 'forceLogout') doLogoutEverywhere();
        if (msg?.data === 'activityPing') markActivity();
      };
    } catch (_e) {
      bcRef.current = null;
    }

    // Timer de chequeo
    timerRef.current = setInterval(checkInactivity, pingMs);
    // Chequeo inmediato al montar
    checkInactivity();

    return () => {
      // Limpieza
      try { clearInterval(timerRef.current); } catch {}
      try { api.interceptors.request.eject(interceptorId); } catch {}
      try { window.removeEventListener('storage', onStorage); } catch {}

      if (attachedRef.current) {
        events.forEach((ev) => window.removeEventListener(ev, onAnyActivity, opts));
        attachedRef.current = false;
      }
      if (bcRef.current) {
        try { bcRef.current.close(); } catch {}
        bcRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeoutMs, pingMs, storageKey, forceKey]);

  // Expulsión manual (por si quieres llamarla desde un botón “Cerrar sesión”)
  const forceLogout = () => {
    try {
      if (bcRef.current) bcRef.current.postMessage('forceLogout');
    } catch {}
    doLogoutEverywhere();
  };

  return { forceLogout, markActivityNow: () => markActivity() };
}
