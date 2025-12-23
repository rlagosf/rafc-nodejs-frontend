// src/pages/admin/config/Categorias.jsx
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import api, { getToken, clearToken } from '../../../services/api';
import { useTheme } from '../../../context/ThemeContext';
import Modal from '../../../components/modal';
import { useMobileAutoScrollTop } from '../../../hooks/useMobileScrollTop';

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

  useMobileAutoScrollTop();

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
      if (rol !== 1) navigate('/admin', { replace: true });
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
    setTimeout(() => {
      setMensaje('');
      setError('');
    }, 2500);
  };

  // ✅ Con tu api.js interceptor: el error viene normalizado (status/data/message)
  const getErrStatus = (err) => err?.status ?? err?.response?.status ?? 0;
  const getErrData = (err) => err?.data ?? err?.response?.data ?? null;

  const prettyError = (err, fallback) => {
    const st = getErrStatus(err);
    const data = getErrData(err);

    // Mensaje directo desde backend si viene
    const backendMsg =
      data?.message || data?.detail || data?.error || err?.message || null;

    // Auth
    if (st === 401 || st === 403) {
      return '🔒 Sesión expirada o sin permisos. Vuelve a iniciar sesión.';
    }

    // Validación / zod
    if (st === 400) {
      return backendMsg || '⚠️ Datos inválidos. Revisa el nombre.';
    }

    // Conflicto: duplicado / FK / regla negocio
    if (st === 409) {
      // Si backend no lo traduce, intentamos detectar patrón MySQL
      if (data?.errno === 1451 || data?.code === 'ER_ROW_IS_REFERENCED_2') {
        return '⚠️ No se puede eliminar: la categoría está en uso por otros registros.';
      }
      if (data?.errno === 1062 || data?.code === 'ER_DUP_ENTRY') {
        return '⚠️ Ya existe una categoría con ese nombre.';
      }
      return backendMsg || '⚠️ No se pudo completar la acción por una restricción del sistema.';
    }

    if (st === 404) {
      return backendMsg || '⚠️ Registro no encontrado (puede que ya haya sido eliminado).';
    }

    // Default (500 / red)
    return backendMsg || fallback || '❌ Error inesperado.';
  };

  const handleAuth = () => {
    clearToken();
    navigate('/login', { replace: true });
  };

  // ───────── Helpers endpoints tolerantes (slash final) ─────────
  const withVariants = (fn) => async (base, ...args) => {
    const urls = base.endsWith('/') ? [base, base.slice(0, -1)] : [base, `${base}/`];
    let lastErr = null;

    for (const u of urls) {
      try {
        return await fn(u, ...args);
      } catch (e) {
        lastErr = e;
        const st = getErrStatus(e);
        if (st === 401 || st === 403) throw e;
      }
    }
    throw lastErr || new Error('ENDPOINT_VARIANTS_FAILED');
  };

  const getVar = withVariants((u, c) => api.get(u, c));
  const postVar = withVariants((u, p, c) => api.post(u, p, c));
  const putVar = withVariants((u, p, c) => api.put(u, p, c));
  const delVar = withVariants((u, c) => api.delete(u, c));

  // ───────── Fetch ─────────
  const fetchCategorias = async () => {
    try {
      const res = await getVar('/categorias');
      const d = res?.data;

      const lista = Array.isArray(d)
        ? d
        : Array.isArray(d?.items)
        ? d.items
        : Array.isArray(d?.results)
        ? d.results
        : [];

      setCategorias(lista);
    } catch (err) {
      const st = getErrStatus(err);
      if (st === 401 || st === 403) return handleAuth();
      setError(prettyError(err, '❌ Error al obtener categorías'));
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      await fetchCategorias();
      if (!alive) return;
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ───────── Crear ─────────
  const crearCategoria = async () => {
    const nombre = limpiarTexto(nuevaCategoria);
    if (nombre.length < 3) return setError('⚠️ El nombre debe tener al menos 3 caracteres.');

    setBusy(true);
    try {
      await postVar('/categorias', { nombre });
      setNuevaCategoria('');
      flash('✅ Categoría creada');
      await fetchCategorias();
    } catch (err) {
      const st = getErrStatus(err);
      if (st === 401 || st === 403) return handleAuth();
      setError(prettyError(err, '❌ No se pudo crear la categoría.'));
    } finally {
      setBusy(false);
    }
  };

  // ───────── Actualizar ─────────
  const actualizarCategoria = async () => {
    if (!editarId) return setError('⚠️ Debes seleccionar una categoría.');
    const nombre = limpiarTexto(editarNombre);
    if (nombre.length < 3) return setError('⚠️ El nombre debe tener al menos 3 caracteres.');

    setBusy(true);
    try {
      await putVar(`/categorias/${editarId}`, { nombre });
      setEditarId(null);
      setEditarNombre('');
      flash('✅ Categoría actualizada');
      await fetchCategorias();
    } catch (err) {
      const st = getErrStatus(err);
      if (st === 401 || st === 403) return handleAuth();
      setError(prettyError(err, '❌ No se pudo actualizar la categoría.'));
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
      await delVar(`/categorias/${categoriaSeleccionada.id}`);
      flash('✅ Categoría eliminada');
      await fetchCategorias();
    } catch (err) {
      const st = getErrStatus(err);
      if (st === 401 || st === 403) return handleAuth();
      setError(prettyError(err, '❌ No se pudo eliminar la categoría.'));
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
      : 'bg-white text-black border border-gray-300 placeholder-gray-500') +
    ' w-full p-2 rounded';

  return (
    <div className={`${fondo} min-h-screen px-4 pt-4 pb-16 font-realacademy`}>
      <h2 className="text-2xl font-bold mb-6 text-center">Gestión de Categorías</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-6xl mx-auto">
        {/* Listado */}
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

        {/* Crear */}
        <div className={`${tarjeta} border shadow-md rounded-xl p-6`}>
          <h3 className="text-lg font-bold mb-4">➕ Crear Categoría</h3>
          <input
            type="text"
            value={nuevaCategoria}
            onChange={(e) => {
              setError('');
              setNuevaCategoria(e.target.value);
            }}
            placeholder="Nombre categoría"
            className={inputClase}
          />
          <button
            onClick={crearCategoria}
            disabled={busy}
            className={`mt-4 w-full py-2 rounded text-white ${
              busy ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            Guardar
          </button>
        </div>

        {/* Editar */}
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
              <option key={cat.id} value={cat.id}>
                {cat.nombre ?? cat.descripcion}
              </option>
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
            className={`mt-4 w-full py-2 rounded text-white ${
              busy || !editarId ? 'bg-gray-400 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-700'
            }`}
          >
            Actualizar
          </button>
        </div>

        {/* Eliminar */}
        <div className={`${tarjeta} border shadow-md rounded-xl p-6`}>
          <h3 className="text-lg font-bold mb-4">🗑️ Eliminar Categoría</h3>
          <select
            value={categoriaSeleccionada?.id || ''}
            onChange={(e) => {
              const id = parseInt(e.target.value);
              const seleccionada = categorias.find((cat) => Number(cat.id) === id);
              setCategoriaSeleccionada(seleccionada || null);
              setError('');
            }}
            className={inputClase}
          >
            <option value="">Selecciona categoría</option>
            {categorias.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.nombre ?? cat.descripcion}
              </option>
            ))}
          </select>

          <button
            disabled={!categoriaSeleccionada || busy}
            onClick={() => setMostrarModal(true)}
            className={`mt-4 w-full py-2 rounded text-white ${
              !categoriaSeleccionada || busy
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700'
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
