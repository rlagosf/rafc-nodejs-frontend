// src/pages/admin/config/EstablecimientosEducacionales.jsx
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import api, { getToken, clearToken } from '../../../services/api';
import { useTheme } from '../../../context/ThemeContext';
import Modal from '../../../components/modal';
import { useMobileAutoScrollTop } from '../../../hooks/useMobileScrollTop';


export default function EstablecimientosEducacionales() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [establecimientos, setEstablecimientos] = useState([]);
  const [nuevo, setNuevo] = useState('');
  const [editarId, setEditarId] = useState(null);
  const [editarNombre, setEditarNombre] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [mostrarModal, setMostrarModal] = useState(false);
  const [seleccionado, setSeleccionado] = useState(null);
  const [busy, setBusy] = useState(false);

  /* ───────────────────────────────
     📌 Breadcrumb abreviado (solo móvil)
  ─────────────────────────────── */
  const abreviar = (txt) => {
    if (!txt) return '';
    if (window.innerWidth > 640) return txt; // no abreviar en desktop/tablet

    if (txt.length <= 14) return txt;

    return txt
      .split(' ')
      .map((p) => (p.length > 6 ? p.slice(0, 6) + '.' : p))
      .join(' ');
  };

  // Breadcrumb
  useMobileAutoScrollTop();


  useEffect(() => {
    const currentPath = location.pathname;
    const bc = Array.isArray(location.state?.breadcrumb) ? location.state.breadcrumb : [];
    const last = bc[bc.length - 1];

    if (!last || last.label !== 'Establecimientos Educacionales') {
      navigate(currentPath, {
        replace: true,
        state: {
          ...(location.state || {}),
          breadcrumb: [
            { label: abreviar('Configuración'), to: '/admin/configuracion' },
            { label: abreviar('Establecimientos Educacionales'), to: currentPath },
          ],
        },
      });
    }
  }, [location.pathname]);

  /* ───────────────────────────────
     🔐 Auth solo admins
  ─────────────────────────────── */
  useEffect(() => {
    try {
      const token = getToken();
      if (!token) throw new Error('no-token');
      const decoded = jwtDecode(token);
      const now = Math.floor(Date.now() / 1000);
      if (decoded?.exp && decoded.exp < now) throw new Error('expired');

      const rawRol = decoded?.rol_id ?? decoded?.role_id ?? decoded?.role;
      const rol = Number(rawRol);
      if (rol !== 1) navigate('/admin', { replace: true });
    } catch {
      clearToken();
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  /* ───────────────────────────────
     Utils
  ─────────────────────────────── */
  const sanitizar = (texto) =>
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

  const toArray = (resp) => {
    const d = resp?.data ?? resp;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.items)) return d.items;
    if (Array.isArray(d?.results)) return d.results;
    if (d?.ok && Array.isArray(d.items)) return d.items;
    return [];
  };

  const withVariants = (fn) => async (base, ...args) => {
    const urls = base.endsWith('/') ? [base, base.slice(0, -1)] : [base, `${base}/`];
    for (const u of urls) {
      try {
        return await fn(u, ...args);
      } catch (e) {
        if ([401, 403].includes(e?.response?.status)) throw e;
      }
    }
    throw new Error('ENDPOINT_VARIANTS_FAILED');
  };

  const getVar = withVariants((u, c) => api.get(u, c));
  const postVar = withVariants((u, p, c) => api.post(u, p, c));
  const putVar = withVariants((u, p, c) => api.put(u, p, c));
  const delVar = withVariants((u, c) => api.delete(u, c));

  /* ───────────────────────────────
     Fetch
  ─────────────────────────────── */
  const fetchDatos = async () => {
    try {
      const res = await getVar('/establecimientos-educ');
      setEstablecimientos(toArray(res));
    } catch (err) {
      if ([401, 403].includes(err?.response?.status)) {
        clearToken();
        navigate('/login', { replace: true });
        return;
      }
      setError('❌ Error al obtener establecimientos');
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      await fetchDatos();
      if (!alive) return;
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* ───────────────────────────────
     Crear
  ─────────────────────────────── */
  const crear = async () => {
    const nombre = sanitizar(nuevo);
    if (nombre.length < 3) return setError('❌ Nombre muy corto');
    setBusy(true);
    try {
      await postVar('/establecimientos-educ', { nombre });
      setNuevo('');
      flash('✅ Establecimiento creado');
      await fetchDatos();
    } catch (err) {
      handleErr(err, '❌ Error al crear');
    } finally {
      setBusy(false);
    }
  };

  /* ───────────────────────────────
     Actualizar
  ─────────────────────────────── */
  const actualizar = async () => {
    if (!editarId) return setError('❌ Debes seleccionar un establecimiento');
    const nombre = sanitizar(editarNombre);
    if (nombre.length < 3) return setError('❌ Nombre muy corto');

    setBusy(true);
    try {
      await putVar(`/establecimientos-educ/${editarId}`, { nombre });
      setEditarId(null);
      setEditarNombre('');
      flash('✅ Actualizado');
      await fetchDatos();
    } catch (err) {
      handleErr(err, '❌ Error al actualizar');
    } finally {
      setBusy(false);
    }
  };

  /* ───────────────────────────────
     Eliminar
  ─────────────────────────────── */
  const eliminar = async () => {
    if (!seleccionado?.id) return setMostrarModal(false);

    setBusy(true);
    try {
      await delVar(`/establecimientos-educ/${seleccionado.id}`);
      flash('✅ Eliminado');
      await fetchDatos();
    } catch (err) {
      handleErr(err, '❌ Error al eliminar');
    } finally {
      setBusy(false);
      setMostrarModal(false);
      setSeleccionado(null);
    }
  };

  const handleErr = (err, fallback) => {
    const st = err?.response?.status;
    if (st === 401 || st === 403) {
      clearToken();
      navigate('/login', { replace: true });
      return;
    }
    setError(err?.response?.data?.detail || err?.response?.data?.message || fallback);
  };

  /* ───────────────────────────────
     UI
  ─────────────────────────────── */
  const fondo = darkMode ? 'bg-[#111827] text-white' : 'bg-white text-[#1d0b0b]';
  const tarjeta = darkMode ? 'bg-[#1f2937] border-gray-700' : 'bg-white border-gray-200';
  const inputClase =
    (darkMode
      ? 'bg-[#1f2937] text-white border border-gray-600 placeholder-gray-400'
      : 'bg-white text-black border border-gray-300 placeholder-gray-500') +
    ' w-full p-2 rounded';

  return (
    <div className={`${fondo} min-h-screen px-4 pt-4 pb-16 font-realacademy`}>
      <h2 className="text-2xl font-bold mb-6 text-center">Establecimientos Educacionales</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-6xl mx-auto">
        {/* Listado */}
        <div className={`${tarjeta} border shadow-md rounded-xl p-6`}>
          <h3 className="text-lg font-bold mb-4">📋 Listado</h3>
          {establecimientos.length === 0 ? (
            <p className="opacity-60">Sin establecimientos registrados.</p>
          ) : (
            <ul className="list-disc pl-5 space-y-1">
              {establecimientos.map((e) => (
                <li key={e.id}>{e.nombre ?? `#${e.id}`}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Crear */}
        <div className={`${tarjeta} border shadow-md rounded-xl p-6`}>
          <h3 className="text-lg font-bold mb-4">➕ Crear</h3>
          <input
            value={nuevo}
            onChange={(e) => {
              setNuevo(e.target.value);
              setError('');
            }}
            placeholder="Nombre"
            className={inputClase}
          />
          <button
            onClick={crear}
            disabled={busy}
            className={`mt-4 w-full py-2 rounded text-white ${busy ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
          >
            Guardar
          </button>
        </div>

        {/* Editar */}
        <div className={`${tarjeta} border shadow-md rounded-xl p-6`}>
          <h3 className="text-lg font-bold mb-4">✏️ Editar</h3>
          <select
            value={editarId || ''}
            onChange={(e) => {
              const id = Number(e.target.value);
              setEditarId(id || null);
              setEditarNombre(establecimientos.find((x) => x.id === id)?.nombre || '');
              setError('');
            }}
            className={`${inputClase} mb-2`}
          >
            <option value="">Selecciona</option>
            {establecimientos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>

          <input
            value={editarNombre}
            onChange={(e) => setEditarNombre(e.target.value)}
            placeholder="Nuevo nombre"
            className={inputClase}
          />

          <button
            onClick={actualizar}
            disabled={busy || !editarId}
            className={`mt-4 w-full py-2 rounded text-white ${busy || !editarId ? 'bg-gray-400 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-700'
              }`}
          >
            Actualizar
          </button>
        </div>

        {/* Eliminar */}
        <div className={`${tarjeta} border shadow-md rounded-xl p-6`}>
          <h3 className="text-lg font-bold mb-4">🗑️ Eliminar</h3>
          <select
            value={seleccionado?.id || ''}
            onChange={(e) => {
              const id = Number(e.target.value);
              const sel = establecimientos.find((x) => x.id === id);
              setSeleccionado(sel || null);
              setError('');
            }}
            className={inputClase}
          >
            <option value="">Selecciona</option>
            {establecimientos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>

          <button
            onClick={() => setMostrarModal(true)}
            disabled={!seleccionado || busy}
            className={`mt-4 w-full py-2 rounded text-white ${!seleccionado || busy ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'
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

      <Modal visible={mostrarModal} onConfirm={eliminar} onCancel={() => setMostrarModal(false)} />
    </div>
  );
}
