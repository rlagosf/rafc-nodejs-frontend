// src/pages/admin/config/MediosPago.jsx
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import api, { getToken, clearToken } from '../../../services/api';
import { useTheme } from '../../../context/ThemeContext';
import Modal from '../../../components/modal';

export default function MediosPago() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [medios, setMedios] = useState([]);
  const [nuevoMedio, setNuevoMedio] = useState('');
  const [editarId, setEditarId] = useState(null);
  const [editarNombre, setEditarNombre] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [mostrarModal, setMostrarModal] = useState(false);
  const [medioSeleccionado, setMedioSeleccionado] = useState(null);
  const [busy, setBusy] = useState(false);

  // 🧭 Breadcrumb → lo pinta el layout (/admin)
  useEffect(() => {
    const currentPath = location.pathname;
    const bc = Array.isArray(location.state?.breadcrumb) ? location.state.breadcrumb : [];
    const last = bc[bc.length - 1];
    if (!last || last.label !== 'Medios de Pago') {
      navigate(currentPath, {
        replace: true,
        state: {
          ...(location.state || {}),
          breadcrumb: [
            { label: 'Configuración', to: '/admin/configuracion' },
            { label: 'Medios de Pago', to: currentPath },
          ],
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // 🔐 Auth (solo admin = 1) con rafc_token gestionado por getToken/clearToken
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

  // Acepta variantes con y sin slash final
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

  const getVar  = withVariants((u, cfg) => api.get(u, cfg));
  const postVar = withVariants((u, payload, cfg) => api.post(u, payload, cfg));
  const putVar  = withVariants((u, payload, cfg) => api.put(u, payload, cfg));
  const delVar  = withVariants((u, cfg) => api.delete(u, cfg));

  // ───────── Fetch ─────────
  const fetchMedios = async () => {
    try {
      const res = await getVar('/medio-pago');
      setMedios(toArray(res));
    } catch (err) {
      const st = err?.response?.status;
      if (st === 401 || st === 403) {
        clearToken();
        navigate('/login', { replace: true });
        return;
      }
      setError('❌ Error al obtener medios de pago');
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      await fetchMedios();
      if (!alive) return;
    })();
    return () => { alive = false; };
  }, []);

  // ───────── Crear ─────────
  const crearMedio = async () => {
    const nombre = sanitizar(nuevoMedio);
    if (nombre.length < 3) return setError('❌ Mínimo 3 caracteres');
    setBusy(true);
    try {
      await postVar('/medio-pago', { nombre });
      setNuevoMedio('');
      flash('✅ Medio de pago creado');
      await fetchMedios();
    } catch (err) {
      const st = err?.response?.status;
      if (st === 401 || st === 403) {
        clearToken();
        navigate('/login', { replace: true });
        return;
      }
      setError(err?.response?.data?.detail || err?.response?.data?.message || '❌ Error al crear medio de pago');
    } finally {
      setBusy(false);
    }
  };

  // ───────── Actualizar ─────────
  const actualizarMedio = async () => {
    if (!editarId) return setError('❌ Debes seleccionar un medio');
    const nombre = sanitizar(editarNombre);
    if (nombre.length < 3) return setError('❌ Mínimo 3 caracteres');
    setBusy(true);
    try {
      await putVar(`/medio-pago/${editarId}`, { nombre });
      setEditarId(null);
      setEditarNombre('');
      flash('✅ Medio de pago actualizado');
      await fetchMedios();
    } catch (err) {
      const st = err?.response?.status;
      if (st === 401 || st === 403) {
        clearToken();
        navigate('/login', { replace: true });
        return;
      }
      setError(err?.response?.data?.detail || err?.response?.data?.message || '❌ Error al actualizar medio de pago');
    } finally {
      setBusy(false);
    }
  };

  // ───────── Eliminar ─────────
  const confirmarEliminacion = async () => {
    if (!medioSeleccionado?.id) {
      setMostrarModal(false);
      return;
    }
    setBusy(true);
    try {
      await delVar(`/medio-pago/${medioSeleccionado.id}`);
      flash('✅ Medio de pago eliminado');
      await fetchMedios();
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
      setMedioSeleccionado(null);
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

      <h2 className="text-2xl font-bold mb-6 text-center">Gestión de Medios de Pago</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-6xl mx-auto">
        {/* Listar */}
        <div className={`${tarjeta} border shadow-md rounded-xl p-6`}>
          <h3 className="text-lg font-bold mb-4">📋 Listar Medios</h3>
          {medios.length === 0 ? (
            <p className="opacity-60">Sin medios registrados.</p>
          ) : (
            <ul className="list-disc pl-5 space-y-1">
              {medios.map((item) => (<li key={item.id}>{item.nombre ?? item.descripcion ?? `#${item.id}`}</li>))}
            </ul>
          )}
        </div>

        {/* Crear */}
        <div className={`${tarjeta} border shadow-md rounded-xl p-6`}>
          <h3 className="text-lg font-bold mb-4">➕ Crear Medio</h3>
          <input
            type="text"
            value={nuevoMedio}
            onChange={(e) => { setNuevoMedio(e.target.value); setError(''); }}
            placeholder="Nombre medio"
            className={inputClase}
          />
          <button
            onClick={crearMedio}
            disabled={busy}
            className={`mt-4 w-full py-2 rounded text-white ${busy ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            Guardar
          </button>
        </div>

        {/* Editar */}
        <div className={`${tarjeta} border shadow-md rounded-xl p-6`}>
          <h3 className="text-lg font-bold mb-4">✏️ Modificar Medio</h3>
          <select
            value={editarId || ''}
            onChange={(e) => {
              const id = parseInt(e.target.value, 10);
              setEditarId(id || null);
              const seleccionado = medios.find((m) => Number(m.id) === id);
              setEditarNombre(seleccionado?.nombre || seleccionado?.descripcion || '');
              setError('');
            }}
            className={`${inputClase} mb-2`}
          >
            <option value="">Selecciona medio</option>
            {medios.map(item => (<option key={item.id} value={item.id}>{item.nombre ?? item.descripcion}</option>))}
          </select>
          <input
            type="text"
            value={editarNombre}
            onChange={(e) => setEditarNombre(e.target.value)}
            placeholder="Nuevo nombre"
            className={inputClase}
          />
          <button
            onClick={actualizarMedio}
            disabled={busy || !editarId}
            className={`mt-4 w-full py-2 rounded text-white ${busy || !editarId ? 'bg-gray-400 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-700'}`}
          >
            Actualizar
          </button>
        </div>

        {/* Eliminar */}
        <div className={`${tarjeta} border shadow-md rounded-xl p-6`}>
          <h3 className="text-lg font-bold mb-4">🗑️ Eliminar Medio</h3>
          <select
            value={medioSeleccionado?.id || ''}
            onChange={(e) => {
              const id = parseInt(e.target.value, 10);
              const seleccionado = medios.find((m) => Number(m.id) === id);
              setMedioSeleccionado(seleccionado || null);
              setError('');
            }}
            className={inputClase}
          >
            <option value="">Selecciona medio</option>
            {medios.map(m => (<option key={m.id} value={m.id}>{m.nombre ?? m.descripcion}</option>))}
          </select>
          <button
            disabled={!medioSeleccionado || busy}
            onClick={() => setMostrarModal(true)}
            className={`mt-4 w-full py-2 rounded text-white ${!medioSeleccionado || busy ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
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
