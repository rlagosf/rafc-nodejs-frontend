// src/components/BotonCerrarSesion.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api'; // ajusta la ruta si difiere

const TOKEN_KEY = 'rafc_token'; // <-- unifica la clave

export default function BotonCerrarSesion() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const cerrarSesion = async () => {
    if (busy) return;
    setBusy(true);

    const token = localStorage.getItem(TOKEN_KEY);

    try {
      // Enviamos el token si existe, para auditar con user_id
      await api.post(
        '/auth/logout',
        null,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          withCredentials: true, // inofensivo aunque /auth/logout sea público
        }
      );
    } catch {
      // No pasa nada: el logout es idempotente (igual limpiamos local)
    } finally {
      try {
        localStorage.removeItem(TOKEN_KEY);
        // si guardas otros artefactos de sesión, límpialos aquí:
        // localStorage.removeItem('rol_id');
        // localStorage.removeItem('usuario');
      } catch {}
      setBusy(false);

      // Redirección “limpia” (evita volver con Back)
      window.location.replace('/login');
      // o navigate('/login', { replace: true });
    }
  };

  return (
    <button
      onClick={cerrarSesion}
      disabled={busy}
      className={`bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 ${
        busy ? 'opacity-70 cursor-not-allowed' : ''
      }`}
      title="Cerrar sesión"
      aria-busy={busy}
    >
      {busy ? 'Cerrando…' : 'Cerrar Sesión'}
    </button>
  );
}
