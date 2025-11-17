import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import IsLoading from '../../components/isLoading';
import api, { getToken, clearToken } from '../../services/api';
import { jwtDecode } from 'jwt-decode';

/* ─────────── Helpers ─────────── */
const asList = (raw) => {
  if (!raw) return [];
  const d = raw?.data ?? raw;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.results)) return d.results;
  if (Array.isArray(d?.items)) return d.items;
  return [];
};

const tryGetList = async (pathsOrPath, signal) => {
  const paths = Array.isArray(pathsOrPath) ? pathsOrPath : [pathsOrPath];
  const variants = [];
  for (const p of paths) {
    const base = p.startsWith('/') ? p : `/${p}`;
    variants.push(base, base.endsWith('/') ? base.slice(0, -1) : `${base}/`);
  }
  const uniq = [...new Set(variants)];
  for (const url of uniq) {
    try {
      const r = await api.get(url, { signal });
      return asList(r);
    } catch (e) {
      const st = e?.response?.status;
      if (st === 401 || st === 403) throw e;
      continue;
    }
  }
  return [];
};

const firstNonEmpty = (...vals) => {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return '';
};

const normalizeJugador = (j, sucMap, catMap) => {
  const rut = String(
    firstNonEmpty(
      j.rut,
      j.jugador_rut,
      j.rut_jugador,
      j.rut_sin_dv,
      j.rutJugador,
      j.rut_num,
      j.rutnum
    )
  );

  const nombre = String(
    firstNonEmpty(
      j.nombre_jugador,
      j.nombre,
      [j.nombres, j.apellidos].filter(Boolean).join(' ').trim()
    ) || '-'
  );

  // Sucursal
  const sucId = firstNonEmpty(j.sucursal_id, j.sucursalId, j.id_sucursal);
  const sucAnidadaNombre = firstNonEmpty(
    j.sucursal?.nombre,
    j.sucursal?.descripcion,
    j.sucursal_nombre
  );
  const sucFromMap = sucId && sucMap ? sucMap[Number(sucId)] : undefined;
  const sucursal = String(firstNonEmpty(sucAnidadaNombre, sucFromMap) || '-');

  // Categoría
  const catId =
    firstNonEmpty(j.categoria_id, j.categoriaId, j.id_categoria, j.categoria?.id) || null;
  const catAnidadaNombre = firstNonEmpty(
    j.categoria?.nombre,
    j.categoria_nombre,
    typeof j.categoria === 'string' ? j.categoria : ''
  );
  const catFromMap = catId && catMap ? catMap[Number(catId)] : undefined;
  const categoriaNombre = String(firstNonEmpty(catAnidadaNombre, catFromMap) || 'Sin categoría');

  return { rut, nombre, sucursal, categoria: { id: catId ? Number(catId) : null, nombre: categoriaNombre } };
};

/* ─────────── COMPONENTE ─────────── */
export default function ListarPagos() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [isLoading, setIsLoading] = useState(true);
  const [jugadoresRaw, setJugadoresRaw] = useState([]);
  const [sucursalesRaw, setSucursalesRaw] = useState([]);
  const [categoriasRaw, setCategoriasRaw] = useState([]);
  const [error, setError] = useState('');
  const [rol, setRol] = useState(null);
  const [q, setQ] = useState('');

  /* 🧭 Breadcrumb base: Inicio / Gestionar pagos */
  useEffect(() => {
    if (!Array.isArray(location.state?.breadcrumb)) {
      navigate(location.pathname + location.search, {
        replace: true,
        state: {
          ...(location.state || {}),
          breadcrumb: [{ label: 'Gestionar pagos', to: '/admin/gestionar-pagos' }]
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  /* 🔐 Autenticación y roles */
  useEffect(() => {
    try {
      const token = getToken();
      if (!token) throw new Error('no-token');
      const decoded = jwtDecode(token);
      const now = Math.floor(Date.now() / 1000);
      if (decoded?.exp && decoded.exp < now) throw new Error('expired');

      const raw = decoded?.rol_id ?? decoded?.role_id ?? decoded?.role;
      const parsed = Number.isFinite(Number(raw)) ? Number(raw) : 0;
      if (![1, 2].includes(parsed)) {
        navigate('/admin', { replace: true });
        return;
      }
      setRol(parsed);
    } catch {
      clearToken();
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  /* 📦 Carga de datos */
  useEffect(() => {
    if (rol == null) return;
    const abort = new AbortController();
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const [jugadores, sucursales, categorias] = await Promise.all([
          tryGetList(['/jugadores'], abort.signal),
          tryGetList(['/sucursales-real'], abort.signal),
          tryGetList(['/categorias'], abort.signal),
        ]);
        setJugadoresRaw(Array.isArray(jugadores) ? jugadores : []);
        setSucursalesRaw(Array.isArray(sucursales) ? sucursales : []);
        setCategoriasRaw(Array.isArray(categorias) ? categorias : []);
        if (!jugadores?.length) setError('⚠️ No se encontraron jugadores.');
      } catch (e) {
        const st = e?.response?.status;
        if (st === 401 || st === 403) {
          clearToken();
          navigate('/login', { replace: true });
          return;
        }
        setError('❌ Error al cargar jugadores/sucursales/categorías');
      } finally {
        if (!abort.signal.aborted) setIsLoading(false);
      }
    })();
    return () => abort.abort();
  }, [rol, navigate]);

  /* 🧭 Handler de navegación al detalle (registrar pago) */
  const handleRegistrarPago = (rut) => {
    navigate(
      {
        pathname: '/admin/registrar-pago',
        search: `?rut=${encodeURIComponent(rut)}`
      },
      {
        state: {
          rut,
          from: '/admin/gestionar-pagos',
          breadcrumb: [{ label: 'Gestionar pagos', to: '/admin/gestionar-pagos' }]
        }
      }
    );
  };

  /* 🧮 Procesamiento de datos */
  const sucMap = useMemo(() => {
    const map = {};
    for (const s of sucursalesRaw) {
      const id = Number(firstNonEmpty(s.id, s.value, s.key));
      const nombre = String(firstNonEmpty(s.nombre, s.descripcion, s.label, s.alias) || '').trim();
      if (Number.isFinite(id) && nombre) map[id] = nombre;
    }
    return map;
  }, [sucursalesRaw]);

  const catMap = useMemo(() => {
    const map = {};
    for (const c of categoriasRaw) {
      const id = Number(firstNonEmpty(c.id, c.value, c.key));
      const nombre = String(firstNonEmpty(c.nombre, c.label, c.descripcion, c.alias) || '').trim();
      if (Number.isFinite(id) && nombre) map[id] = nombre;
    }
    return map;
  }, [categoriasRaw]);

  const jugadores = useMemo(
    () => jugadoresRaw.map((j) => normalizeJugador(j, sucMap, catMap)),
    [jugadoresRaw, sucMap, catMap]
  );

  const filtrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return jugadores;
    return jugadores.filter((j) =>
      j.rut.toLowerCase().includes(s) ||
      j.nombre.toLowerCase().includes(s) ||
      j.sucursal.toLowerCase().includes(s)
    );
  }, [q, jugadores]);

  // Agrupación por categoría (solo presentación)
  const gruposPorCategoria = useMemo(() => {
    const map = new Map();
    for (const j of filtrados) {
      const key = j?.categoria?.nombre || 'Sin categoría';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(j);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, 'es'));
  }, [filtrados]);

  /* 🎨 Estilos */
  const fondo = darkMode ? 'bg-[#111827] text-white' : 'bg-white text-[#1d0b0b]';
  const tarjeta = darkMode
    ? 'bg-[#1f2937] text-white border border-gray-700'
    : 'bg-white text-[#1d0b0b] border border-gray-200';
  const input = darkMode
    ? 'bg-[#1f2937] border border-gray-600 text-white'
    : 'bg-white border border-gray-300 text-black';

  /* 🌀 Loader */
  if (isLoading) return <IsLoading />;

  /* 🧾 Render */
  return (
    <div className={`${fondo} px-4 pt-4 pb-10 font-realacademy`}>
      {/* 🧭 Breadcrumb lo pinta el Layout: Inicio / Gestionar pagos */}
      <h2 className="text-2xl font-bold mb-4 text-center">Listado de Jugadores</h2>

      {/* Buscador global */}
      <div className="max-w-5xl mx-auto mb-4">
        <input
          className={`${input} w-full p-2 rounded`}
          placeholder="Buscar por RUT, nombre o sucursal..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* Tarjetas por categoría */}
      <div className="max-w-6xl mx-auto space-y-6">
        {gruposPorCategoria.map(([categoriaNombre, lista]) => (
          <div key={categoriaNombre} className={`${tarjeta} rounded-2xl p-4 shadow-lg`}>
            <h3 className="text-xl font-semibold mb-3 text-center">
              Categoría {categoriaNombre}
            </h3>

            {/* ======= Vista TABLE para ≥ sm ======= */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full text-sm table-fixed">
                <colgroup>
                  <col className="w-[160px]" />   {/* RUT */}
                  <col className="w-[40%]" />      {/* Nombre */}
                  <col className="w-[25%]" />      {/* Sucursal */}
                  <col className="w-[160px]" />    {/* Acciones */}
                </colgroup>
                <thead>
                  <tr className="text-left">
                    <th className="px-3 py-2">RUT</th>
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">Sucursal</th>
                    <th className="px-3 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((j) => (
                    <tr key={j.rut || `${j.nombre}-${j.sucursal}`} className="border-t border-gray-600/20 align-middle">
                      <td className="px-3 py-2 break-words">{j.rut}</td>
                      <td className="px-3 py-2 break-words">{j.nombre}</td>
                      <td className="px-3 py-2 break-words">{j.sucursal}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => handleRegistrarPago(j.rut)}
                            className="text-white bg-[#e82d89] hover:bg-[#c61f74] px-3 py-1 rounded whitespace-nowrap"
                          >
                            Registrar Pago
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!lista.length && (
                    <tr>
                      <td className="px-3 py-4 italic text-gray-400" colSpan={4}>
                        Sin resultados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ======= Vista CARDS para < sm ======= */}
            <div className="sm:hidden space-y-3">
              {lista.map((j) => (
                <div
                  key={j.rut || `${j.nombre}-${j.sucursal}`}
                  className="rounded-xl border border-gray-600/20 p-3"
                >
                  <div className="text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="opacity-70">RUT</span>
                      <span className="font-medium break-all text-right">{j.rut}</span>
                    </div>
                    <div className="flex justify-between gap-3 mt-1">
                      <span className="opacity-70">Nombre</span>
                      <span className="font-medium break-words text-right">{j.nombre}</span>
                    </div>
                    <div className="flex justify-between gap-3 mt-1">
                      <span className="opacity-70">Sucursal</span>
                      <span className="font-medium break-words text-right">{j.sucursal}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRegistrarPago(j.rut)}
                    className="mt-3 w-full text-center text-white bg-[#e82d89] hover:bg-[#c61f74] px-3 py-2 rounded"
                  >
                    Registrar Pago
                  </button>
                </div>
              ))}

              {!lista.length && (
                <div className="rounded-xl border border-gray-600/20 p-3">
                  <p className="text-center italic text-gray-400">Sin resultados</p>
                </div>
              )}
            </div>

          </div>
        ))}

        {!gruposPorCategoria.length && (
          <div className={`${tarjeta} rounded-2xl p-4 shadow-lg`}>
            <p className="text-center italic text-gray-400">Sin resultados</p>
          </div>
        )}

        {error && (
          <div className={`${tarjeta} rounded-2xl p-4 shadow-lg`}>
            <p className="text-red-500 text-center">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
