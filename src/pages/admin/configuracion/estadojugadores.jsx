// src/pages/admin/config/EstadoJugadores.jsx
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import api, { getToken, clearToken } from '../../../services/api';
import { useTheme } from '../../../context/ThemeContext';
import Modal from '../../../components/modal';
import { useMobileAutoScrollTop } from '../../../hooks/useMobileScrollTop';

export default function EstadoJugadores() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [estados, setEstados] = useState([]);
  const [nuevoEstado, setNuevoEstado] = useState('');
  const [editarId, setEditarId] = useState(null);
  const [editarNombre, setEditarNombre] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [mostrarModal, setMostrarModal] = useState(false);
  const [estadoSeleccionado, setEstadoSeleccionado] = useState(null);
  const [busy, setBusy] = useState(false);

  // 🧭 Breadcrumb → lo pinta el layout (/admin)
  useEffect(() => {
    const currentPath = location.pathname;
    const bc = Array.isArray(location.state?.breadcrumb) ? location.state.breadcrumb : [];
    const last = bc[bc.length - 1];
    if (!last || last.label !== 'Estados de Jugadores') {
      navigate(currentPath, {
        replace: true,
        state: {
          ...(location.state || {}),
          breadcrumb: [
            { label: 'Configuración', to: '/admin/configuracion' },
            { label: 'Estados de Jugadores', to: currentPath },
          ],
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useMobileAutoScrollTop();


  // 🔐 Auth (solo admin = 1) con rafc_token
  useEffect(() => {
    try {
      const token = getToken();
      if (!token) throw new Error('no-token');
      const decoded = jwtDecode(token);
      const now = Math.floor(Date.now() / 1000);
      if (decoded?.exp && decoded.exp < now) throw new Error('expired');
      const rawRol = decoded?.rol_id ?? decoded?.role_id ?? decoded?.role;
      const rol = Number.isFinite(Number(rawRol)) ? Number(rawRol) : 0;
      if (rol !== 1) navigate('/admin', { replace: true });
    } catch {
      clearToken();
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  // ───────── Helpers ─────────
  const sanitizar = (texto) =>
    String(texto || '')
      .replace(/[<>;"']/g, '')
      .replace(/[^a-zA-Z0-9 áéíóúÁÉÍÓÚñÑ-]/g, '')
      .trim();

  const flash = (okMsg, errMsg) => {
    if (okMsg) setMensaje(okMsg);
    if (errMsg) setError(errMsg);
    setTimeout(() => { setMensaje(''); setError(''); }, 2500);
  };

  const toArray = (resp) => {
    const d = resp?.data ?? resp ?? [];
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.items)) return d.items;
    if (Array.isArray(d?.results)) return d.results;
    if (d?.ok && Array.isArray(d.items)) return d.items;
    if (d?.ok && Array.isArray(d.data)) return d.data;
    return [];
  };

  const withVariants = (fn) => async (base, ...args) => {
    const urls = base.endsWith('/') ? [base, base.slice(0, -1)] : [base, `${base}/`];
    for (const u of urls) {
      try { return await fn(u, ...args); } catch (e) {
        const st = e?.response?.status;
        if (st === 401 || st === 403) throw e; // auth → burbujear
      }
    }
    throw new Error('ENDPOINT_VARIANTS_FAILED');
  };

  const getVar = withVariants((u, cfg) => api.get(u, cfg));
  const postVar = withVariants((u, payload, cfg) => api.post(u, payload, cfg));
  const putVar = withVariants((u, payload, cfg) => api.put(u, payload, cfg));
  const delVar = withVariants((u, cfg) => api.delete(u, cfg));

  // ───────── Fetch ─────────
  const fetchEstados = async () => {
    try {
      const res = await getVar('/estado');
      setEstados(toArray(res));
    } catch (err) {
      const st = err?.response?.status;
      if (st === 401 || st === 403) {
        clearToken();
        navigate('/login', { replace: true });
        return;
      }
      setError('❌ Error al obtener estados');
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      await fetchEstados();
      if (!alive) return;
    })();
    return () => { alive = false; };
  }, []);

  // ───────── Crear ─────────
  const crearEstado = async () => {
    const nombre = sanitizar(nuevoEstado);
    if (nombre.length < 3) return setError('❌ Mínimo 3 caracteres');
    setBusy(true);
    try {
      await postVar('/estado', { nombre });
      setNuevoEstado('');
      flash('✅ Estado creado');
      await fetchEstados();
    } catch (err) {
      const st = err?.response?.status;
      if (st === 401 || st === 403) {
        clearToken();
        navigate('/login', { replace: true });
        return;
      }
      setError(err?.response?.data?.detail || err?.response?.data?.message || '❌ Error al crear estado');
    } finally {
      setBusy(false);
    }
  };

  // ───────── Actualizar ─────────
  const actualizarEstado = async () => {
    if (!editarId) return setError('❌ Debes seleccionar un estado');
    const nombre = sanitizar(editarNombre);
    if (nombre.length < 3) return setError('❌ Mínimo 3 caracteres');
    setBusy(true);
    try {
      await putVar(`/estado/${editarId}`, { nombre });
      setEditarId(null);
      setEditarNombre('');
      flash('✅ Estado actualizado');
      await fetchEstados();
    } catch (err) {
      const st = err?.response?.status;
      if (st === 401 || st === 403) {
        clearToken();
        navigate('/login', { replace: true });
        return;
      }
      setError(err?.response?.data?.detail || err?.response?.data?.message || '❌ Error al actualizar estado');
    } finally {
      setBusy(false);
    }
  };

  // ───────── Eliminar ─────────
  const confirmarEliminacion = async () => {
    if (!estadoSeleccionado?.id) {
      setMostrarModal(false);
      return;
    }
    setBusy(true);
    try {
      await delVar(`/estado/${estadoSeleccionado.id}`);
      flash('✅ Estado eliminado');
      await fetchEstados();
    } catch (err) {
      const st = err?.response?.status;
      if (st === 401 || st === 403) {
        clearToken();
        navigate('/login', { replace: true });
        return;
      }
      setError(err?.response?.data?.detail || err?.response?.data?.message || '❌ Error al eliminar');
    } finally {
      setBusy(false);
      setMostrarModal(false);
      setEstadoSeleccionado(null);
    }
  };

  // 🎨 Estilos
  const fondo = darkMode ? 'bg-[#111827] text-white' : 'bg-white text-[#1d0b0b]';
  const tarjeta = darkMode ? 'bg-[#1f2937] border-gray-700' : 'bg-white border-gray-200';
  const inputClase =
    (darkMode
      ? 'bg-[#1f2937] text-white border border-gray-600 placeholder-gray-400'
      : 'bg-white text-black border border-gray-300 placeholder-gray-500') + ' w-full p-2 rounded';

  return (
    <div className={`${fondo} min-h-screen px-4 pt-4 pb-16 font-realacademy`}>
      {/* 🚫 Sin breadcrumb local; el layout /admin usa location.state */}

      <h2 className="text-2xl font-bold mb-6 text-center">Gestión de Estados de Jugadores</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-6xl mx-auto">
        {/* Listar */}
        <div className={`${tarjeta} border shadow-md rounded-xl p-6`}>
          <h3 className="text-lg font-bold mb-4">📋 Listar Estados</h3>
          {estados.length === 0 ? (
            <p className="opacity-60">Sin estados registrados.</p>
          ) : (
            <ul className="list-disc pl-5 space-y-1">
              {estados.map((estado) => (<li key={estado.id}>{estado.nombre ?? estado.descripcion ?? `#${estado.id}`}</li>))}
            </ul>
          )}
        </div>

        {/* Crear */}
        <div className={`${tarjeta} border shadow-md rounded-xl p-6`}>
          <h3 className="text-lg font-bold mb-4">➕ Crear Estado</h3>
          <input
            type="text"
            value={nuevoEstado}
            onChange={(e) => { setNuevoEstado(e.target.value); setError(''); }}
            placeholder="Nombre estado"
            className={inputClase}
          />
          <button
            onClick={crearEstado}
            disabled={busy}
            className={`mt-4 w-full py-2 rounded text-white ${busy ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            Guardar
          </button>
        </div>

        {/* Editar */}
        <div className={`${tarjeta} border shadow-md rounded-xl p-6`}>
          <h3 className="text-lg font-bold mb-4">✏️ Modificar Estado</h3>
          <select
            value={editarId || ''}
            onChange={(e) => {
              const id = parseInt(e.target.value, 10);
              setEditarId(id || null);
              const seleccionado = estados.find((est) => Number(est.id) === id);
              setEditarNombre(seleccionado?.nombre || seleccionado?.descripcion || '');
              setError('');
            }}
            className={`${inputClase} mb-2`}
          >
            <option value="">Selecciona estado</option>
            {estados.map((estado) => (
              <option key={estado.id} value={estado.id}>{estado.nombre ?? estado.descripcion}</option>
            ))}
          </select>
          <input
            type="text"
            value={editarNombre}
            onChange={(e) => setEditarNombre(e.target.value)}
            placeholder="Nuevo nombre"
            className={inputClase}
          />
          <button
            onClick={actualizarEstado}
            disabled={busy || !editarId}
            className={`mt-4 w-full py-2 rounded text-white ${busy || !editarId ? 'bg-gray-400 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-700'}`}
          >
            Actualizar
          </button>
        </div>

        {/* Eliminar */}
        <div className={`${tarjeta} border shadow-md rounded-xl p-6`}>
          <h3 className="text-lg font-bold mb-4">🗑️ Eliminar Estado</h3>
          <select
            value={estadoSeleccionado?.id || ''}
            onChange={(e) => {
              const id = parseInt(e.target.value, 10);
              const seleccionado = estados.find((est) => Number(est.id) === id);
              setEstadoSeleccionado(seleccionado || null);
              setError('');
            }}
            className={inputClase}
          >
            <option value="">Selecciona estado</option>
            {estados.map((estado) => (
              <option key={estado.id} value={estado.id}>{estado.nombre ?? estado.descripcion}</option>
            ))}
          </select>
          <button
            disabled={!estadoSeleccionado || busy}
            onClick={() => setMostrarModal(true)}
            className={`mt-4 w-full py-2 rounded text-white ${!estadoSeleccionado || busy ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
          >
            Eliminar
          </button>
        </div>
      </div>

      {(mensaje || error) && (
        <p className={`text-center mt-6 ${mensaje ? 'text-green-500' : 'text-red-500'}`}>
          {mensaje || error}
        </p>
      )}

      <Modal
        visible={mostrarModal}
        onConfirm={confirmarEliminacion}
        onCancel={() => setMostrarModal(false)}
      />
    </div>
  );
}
