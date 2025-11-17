// src/pages/admin/config/Categorias.jsx
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import api, { getToken, clearToken } from '../../../services/api';
import { useTheme } from '../../../context/ThemeContext';
import Modal from '../../../components/modal';

export default function Categorias() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [categorias, setCategorias] = useState([]);
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [editarId, setEditarId] = useState(null);
  const [editarNombre, setEditarNombre] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [mostrarModal, setMostrarModal] = useState(false);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [busy, setBusy] = useState(false);

  // 🧭 Breadcrumb → lo pinta el layout (/admin)
  useEffect(() => {
    const currentPath = location.pathname;
    const bc = Array.isArray(location.state?.breadcrumb) ? location.state.breadcrumb : [];
    const last = bc[bc.length - 1];
    if (!last || last.label !== 'Categorías') {
      navigate(currentPath, {
        replace: true,
        state: {
          ...(location.state || {}),
          breadcrumb: [
            { label: 'Configuración', to: '/admin/configuracion' },
            { label: 'Categorías', to: currentPath },
          ],
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // ───────── Auth (solo admin=1) ─────────
  useEffect(() => {
    try {
      const token = getToken();
      if (!token) throw new Error('no-token');
      const decoded = jwtDecode(token);
      const now = Math.floor(Date.now() / 1000);
      if (decoded?.exp && decoded.exp < now) throw new Error('expired');
      const rawRol = decoded?.rol_id ?? decoded?.role_id ?? decoded?.role;
      const rol = Number.isFinite(Number(rawRol)) ? Number(rawRol) : 0;
      if (rol !== 1) {
        navigate('/admin', { replace: true });
      }
    } catch {
      clearToken();
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  // ───────── Utils ─────────
  const limpiarTexto = (texto) =>
    String(texto || '')
      .replace(/[<>;"']/g, '')
      .replace(/[^a-zA-Z0-9 áéíóúÁÉÍÓÚñÑ-]/g, '')
      .trim();

  const flash = (okMsg, errMsg) => {
    if (okMsg) setMensaje(okMsg);
    if (errMsg) setError(errMsg);
    setTimeout(() => { setMensaje(''); setError(''); }, 2500);
  };

  // ───────── Helpers endpoints tolerantes ─────────
  const getWithVariants = async (base) => {
    const urls = base.endsWith('/') ? [base, base.slice(0, -1)] : [base, `${base}/`];
    for (const u of urls) {
      try { return await api.get(u); } catch (e) {
        const st = e?.response?.status;
        if (st === 401 || st === 403) throw e;
      }
    }
    throw new Error('GET_FAIL');
  };

  const postWithVariants = async (base, payload) => {
    const urls = base.endsWith('/') ? [base, base.slice(0, -1)] : [base, `${base}/`];
    for (const u of urls) {
      try { return await api.post(u, payload); } catch (e) {
        const st = e?.response?.status;
        if (st === 401 || st === 403) throw e;
      }
    }
    throw new Error('POST_FAIL');
  };

  const putWithVariants = async (base, payload) => {
    const urls = base.endsWith('/') ? [base, base.slice(0, -1)] : [base, `${base}/`];
    for (const u of urls) {
      try { return await api.put(u, payload); } catch (e) {
        const st = e?.response?.status;
        if (st === 401 || st === 403) throw e;
      }
    }
    throw new Error('PUT_FAIL');
  };

  const deleteWithVariants = async (base) => {
    const urls = base.endsWith('/') ? [base, base.slice(0, -1)] : [base, `${base}/`];
    for (const u of urls) {
      try { return await api.delete(u); } catch (e) {
        const st = e?.response?.status;
        if (st === 401 || st === 403) throw e;
      }
    }
    throw new Error('DEL_FAIL');
  };

  // ───────── Fetch ─────────
  const fetchCategorias = async () => {
    try {
      const res = await getWithVariants('/categorias');
      const d = res?.data;
      const lista = Array.isArray(d) ? d
        : Array.isArray(d?.items) ? d.items
        : Array.isArray(d?.results) ? d.results
        : [];
      setCategorias(lista);
    } catch (err) {
      const st = err?.response?.status;
      if (st === 401 || st === 403) {
        clearToken();
        navigate('/login', { replace: true });
        return;
      }
      setError('❌ Error al obtener categorías');
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      await fetchCategorias();
      if (!alive) return;
    })();
    return () => { alive = false; };
  }, []);

  // ───────── Crear ─────────
  const crearCategoria = async () => {
    const nombre = limpiarTexto(nuevaCategoria);
    if (nombre.length < 3) return setError('❌ Mínimo 3 caracteres');
    setBusy(true);
    try {
      await postWithVariants('/categorias', { nombre });
      setNuevaCategoria('');
      flash('✅ Categoría creada');
      await fetchCategorias();
    } catch (err) {
      const st = err?.response?.status;
      if (st === 401 || st === 403) {
        clearToken();
        navigate('/login', { replace: true });
        return;
      }
      const msg = err?.response?.data?.detail || err?.response?.data?.message || '❌ Error al crear categoría';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  // ───────── Actualizar ─────────
  const actualizarCategoria = async () => {
    if (!editarId) return setError('❌ Debes seleccionar una categoría');
    const nombre = limpiarTexto(editarNombre);
    if (nombre.length < 3) return setError('❌ Mínimo 3 caracteres');
    setBusy(true);
    try {
      await putWithVariants(`/categorias/${editarId}`, { nombre });
      setEditarId(null);
      setEditarNombre('');
      flash('✅ Categoría actualizada');
      await fetchCategorias();
    } catch (err) {
      const st = err?.response?.status;
      if (st === 401 || st === 403) {
        clearToken();
        navigate('/login', { replace: true });
        return;
      }
      const msg = err?.response?.data?.detail || err?.response?.data?.message || '❌ Error al actualizar categoría';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  // ───────── Eliminar ─────────
  const confirmarEliminacion = async () => {
    if (!categoriaSeleccionada?.id) {
      setMostrarModal(false);
      return;
    }
    setBusy(true);
    try {
      await deleteWithVariants(`/categorias/${categoriaSeleccionada.id}`);
      flash('✅ Categoría eliminada');
      await fetchCategorias();
    } catch (err) {
      const st = err?.response?.status;
      if (st === 401 || st === 403) {
        clearToken();
        navigate('/login', { replace: true });
        return;
      }
      const msg = err?.response?.data?.detail || err?.response?.data?.message || '❌ Error al eliminar';
      setError(msg);
    } finally {
      setBusy(false);
      setMostrarModal(false);
      setCategoriaSeleccionada(null);
    }
  };

  // ───────── Estilos ─────────
  const fondo = darkMode ? 'bg-[#111827] text-white' : 'bg-white text-[#1d0b0b]';
  const tarjeta = darkMode ? 'bg-[#1f2937] border-gray-700' : 'bg-white border-gray-200';
  const inputClase =
    (darkMode
      ? 'bg-[#1f2937] text-white border border-gray-600 placeholder-gray-400'
      : 'bg-white text-black border border-gray-300 placeholder-gray-500') + ' w-full p-2 rounded';

  return (
    <div className={`${fondo} min-h-screen px-4 pt-4 pb-16 font-realacademy`}>
      {/* 🚫 Sin breadcrumb local; el layout /admin lo pinta con location.state */}

      <h2 className="text-2xl font-bold mb-6 text-center">Gestión de Categorías</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-6xl mx-auto">
        <div className={`${tarjeta} border shadow-md rounded-xl p-6`}>
          <h3 className="text-lg font-bold mb-4">📋 Listar Categorías</h3>
          {categorias.length === 0 ? (
            <p className="opacity-60">Sin categorías registradas.</p>
          ) : (
            <ul className="list-disc pl-5 space-y-1">
              {categorias.map((cat) => (
                <li key={cat.id}>{cat.nombre ?? cat.descripcion ?? `#${cat.id}`}</li>
              ))}
            </ul>
          )}
        </div>

        <div className={`${tarjeta} border shadow-md rounded-xl p-6`}>
          <h3 className="text-lg font-bold mb-4">➕ Crear Categoría</h3>
          <input
            type="text"
            value={nuevaCategoria}
            onChange={(e) => { setError(''); setNuevaCategoria(e.target.value); }}
            placeholder="Nombre categoría"
            className={inputClase}
          />
          <button
            onClick={crearCategoria}
            disabled={busy}
            className={`mt-4 w-full py-2 rounded text-white ${busy ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            Guardar
          </button>
        </div>

        <div className={`${tarjeta} border shadow-md rounded-xl p-6`}>
          <h3 className="text-lg font-bold mb-4">✏️ Modificar Categoría</h3>
          <select
            value={editarId || ''}
            onChange={(e) => {
              setError('');
              const id = parseInt(e.target.value);
              setEditarId(id || null);
              const cat = categorias.find((c) => Number(c.id) === id);
              setEditarNombre(cat?.nombre ?? cat?.descripcion ?? '');
            }}
            className={`${inputClase} mb-2`}
          >
            <option value="">Selecciona categoría</option>
            {categorias.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.nombre ?? cat.descripcion}</option>
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
            onClick={actualizarCategoria}
            disabled={busy || !editarId}
            className={`mt-4 w-full py-2 rounded text-white ${busy || !editarId ? 'bg-gray-400 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-700'}`}
          >
            Actualizar
          </button>
        </div>

        <div className={`${tarjeta} border shadow-md rounded-xl p-6`}>
          <h3 className="text-lg font-bold mb-4">🗑️ Eliminar Categoría</h3>
          <select
            value={categoriaSeleccionada?.id || ''}
            onChange={(e) => {
              const id = parseInt(e.target.value);
              const seleccionada = categorias.find(cat => Number(cat.id) === id);
              setCategoriaSeleccionada(seleccionada || null);
              setError('');
            }}
            className={inputClase}
          >
            <option value="">Selecciona categoría</option>
            {categorias.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.nombre ?? cat.descripcion}</option>
            ))}
          </select>
          <button
            disabled={!categoriaSeleccionada || busy}
            onClick={() => setMostrarModal(true)}
            className={`mt-4 w-full py-2 rounded text-white ${
              !categoriaSeleccionada || busy ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'
            }`}
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
