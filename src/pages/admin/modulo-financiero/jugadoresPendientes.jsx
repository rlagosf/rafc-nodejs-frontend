// src/pages/admin/modulo-financiero/jugadoresPendientes.jsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../../../context/ThemeContext';
import api, { getToken, clearToken } from '../../../services/api';
import { jwtDecode } from 'jwt-decode';
import { formatRutWithDV } from '../../../services/rut';
import { useMobileAutoScrollTop } from '../../../hooks/useMobileScrollTop';

export default function JugadoresPendientes() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [mensualidadFilas, setMensualidadFilas] = useState([]);
  const [mensualidadMes, setMensualidadMes] = useState(null);

  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroCategoriaSel, setFiltroCategoriaSel] = useState('');

  useMobileAutoScrollTop();

  // 🔐 Auth solo admin (rol = 1)
  useEffect(() => {
    try {
      const token = getToken();
      if (!token) throw new Error('no-token');

      const decoded = jwtDecode(token);
      const now = Math.floor(Date.now() / 1000);

      if (!decoded?.exp || decoded.exp <= now) {
        clearToken();
        navigate('/login', { replace: true });
        return;
      }

      const rawRol = decoded?.rol_id ?? decoded?.role_id ?? decoded?.role;
      const rol = Number.isFinite(Number(rawRol)) ? Number(rawRol) : 0;

      if (rol !== 1) {
        navigate('/admin', { replace: true });
        return;
      }
    } catch {
      clearToken();
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  // 🧭 Inyectar breadcrumb si no viene desde el dashboard
  useEffect(() => {
    if (!Array.isArray(location.state?.breadcrumb)) {
      navigate(location.pathname + location.search, {
        replace: true,
        state: {
          ...(location.state || {}),
          breadcrumb: [
            { label: 'Panel Admin', path: '/admin' },
            { label: 'Módulo financiero', path: '/admin/estados-cuenta' },
            { label: 'Jugadores con mensualidad vencida', path: location.pathname },
          ],
        },
      });
    }
  }, [location, navigate]);

  // 📡 Cargar mensualidad vencida desde el backend
  useEffect(() => {
    const abort = new AbortController();
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const resp = await api.get('/pagos-jugador/mensualidad-estado', {
          signal: abort.signal,
        });

        if (abort.signal.aborted) return;

        const filas = Array.isArray(resp?.data?.filas) ? resp.data.filas : [];
        setMensualidadFilas(filas);
        setMensualidadMes(resp?.data?.mes ?? null);
      } catch (err) {
        if (abort.signal.aborted) return;
        const st = err?.response?.status;
        if (st === 401 || st === 403) {
          clearToken();
          navigate('/login', { replace: true });
          return;
        }
        setError('❌ No se pudo cargar el estado de mensualidad.');
      } finally {
        if (!abort.signal.aborted) setIsLoading(false);
      }
    })();

    return () => abort.abort();
  }, [navigate]);

  // 🎨 Estilos
  const fondoClase = darkMode ? 'bg-[#111827] text-white' : 'bg-white text-[#1d0b0b]';
  const tablaCabecera = darkMode ? 'bg-[#1f2937] text-white' : 'bg-gray-100 text-[#1d0b0b]';
  const filaHover = darkMode ? 'hover:bg-[#111827]' : 'hover:bg-gray-50';

  const controlBase = darkMode
    ? 'border border-gray-500 bg-[#1f2937] text-white placeholder-gray-400'
    : 'border border-gray-300 bg-white text-black placeholder-gray-500';

  const controlClase = `${controlBase} w-full h-9 px-3 rounded-md text-xs leading-none`;

  const estadoPillClass = (estadoRaw) => {
    const estado = (estadoRaw ?? '').toString().trim().toUpperCase();
    if (estado === 'VENCIDO') {
      return 'bg-red-100 text-red-800 border border-red-300';
    }
    if (estado === 'PAGADO') {
      return 'bg-green-100 text-green-800 border border-green-300';
    }
    return 'bg-gray-100 text-gray-800 border border-gray-300';
  };

  const labelMensual =
    mensualidadMes?.label ??
    new Intl.DateTimeFormat('es-CL', {
      month: 'long',
      year: 'numeric',
    }).format(new Date());

  // Opciones de categoría (para el select)
  const opcionesCategoria = useMemo(() => {
    const s = new Set();
    for (const row of mensualidadFilas || []) {
      if (row.categoria) s.add(row.categoria);
    }
    return Array.from(s);
  }, [mensualidadFilas]);

  // Filtrado local
  const filasFiltradas = useMemo(() => {
    const f = filtroTexto.toLowerCase().trim();
    return (mensualidadFilas || []).filter((row) => {
      const rut = String(row.rut ?? '');
      const nombre = row.nombre ?? '—';
      const categoria = row.categoria ?? 'Sin categoría';

      let okTexto = true;
      if (f) {
        okTexto =
          rut.includes(f) ||
          nombre.toLowerCase().includes(f) ||
          categoria.toLowerCase().includes(f);
      }

      let okCat = true;
      if (filtroCategoriaSel) {
        okCat = categoria === filtroCategoriaSel;
      }

      // Estas filas ya representan mensualidad vencida
      return okTexto && okCat;
    });
  }, [mensualidadFilas, filtroTexto, filtroCategoriaSel]);

  // 🧩 Render
  if (isLoading) {
    return (
      <div className={`${fondoClase} min-h-[calc(100vh-100px)] px-4 pt-4 pb-16 flex items-center justify-center`}>
        <p className="opacity-80 text-sm">Cargando jugadores con mensualidad vencida…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${fondoClase} min-h-[calc(100vh-100px)] px-4 pt-4 pb-16 flex items-center justify-center`}>
        <p className="text-red-500 text-sm sm:text-base">{error}</p>
      </div>
    );
  }

  return (
    <div className={`${fondoClase} min-h-[calc(100vh-100px)] px-4 pt-4 pb-16 font-realacademy`}>
      <h2 className="text-2xl font-bold mb-2 text-center">Jugadores con Mensualidad Vencida</h2>
      <p className="text-center mb-5 text-xs sm:text-sm opacity-80">
        Mes de referencia:{' '}
        <span className="font-semibold capitalize">{labelMensual}</span>.{' '}
        Se listan solo los jugadores que <span className="font-semibold">deben mensualidad (tipo_pago = Mensualidad)</span>. Al pagar, desaparecen de este listado.
      </p>

      {/* Filtros propios de esta página */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end mb-4 max-w-5xl mx-auto">
        <input
          type="text"
          placeholder="Buscar por RUT, nombre o categoría"
          value={filtroTexto}
          onChange={(e) => setFiltroTexto(e.target.value)}
          className={controlClase}
        />

        <select
          value={filtroCategoriaSel}
          onChange={(e) => setFiltroCategoriaSel(e.target.value)}
          className={controlClase}
        >
          <option value="">Categoría (todas)</option>
          {opcionesCategoria.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <p className="text-[11px] sm:text-xs opacity-70">
          Al registrar la mensualidad del mes en curso, el jugador se elimina automáticamente de
          este panel y queda visible en el módulo de <span className="font-semibold">Pagos centralizados</span>.
        </p>
      </div>

      {/* Tabla principal */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-xs sm:text-sm min-w-[800px]">
          <thead className={tablaCabecera}>
            <tr>
              <th className="py-2 px-4 border min-w-[120px]">RUT Jugador</th>
              <th className="py-2 px-4 border min-w-[220px] break-all">Nombre del Jugador</th>
              <th className="py-2 px-4 border min-w-[150px] break-all">Categoría</th>
              <th className="py-2 px-4 border min-w-[140px] break-all text-center">
                Estado mensualidad
              </th>
            </tr>
          </thead>
          <tbody>
            {filasFiltradas.map((row) => (
              <tr key={row.rut} className={filaHover}>
                <td className="py-2 px-4 border text-center">
                  {row.rut ? formatRutWithDV(row.rut) : '—'}
                </td>
                <td className="py-2 px-4 border text-center break-all">
                  {row.nombre ?? '—'}
                </td>
                <td className="py-2 px-4 border text-center break-all">
                  {row.categoria ?? 'Sin categoría'}
                </td>
                <td className="py-2 px-4 border text-center">
                  <span
                    className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold ${estadoPillClass(
                      row.estadoMensualidad
                    )}`}
                  >
                    {row.estadoMensualidad ?? '—'}
                  </span>
                </td>
              </tr>
            ))}
            {filasFiltradas.length === 0 && (
              <tr>
                <td className="py-4 px-4 border text-center" colSpan={4}>
                  No hay jugadores con mensualidad vencida que coincidan con los filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
