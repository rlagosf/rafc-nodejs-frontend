// src/pages/admin/Pagos.jsx
import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import api, { getToken, clearToken } from '../../services/api';
import { Chart, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import IsLoading from '../../components/isLoading';
import { jwtDecode } from 'jwt-decode';
import { Pencil, Trash2, X } from 'lucide-react';
import { useMobileAutoScrollTop } from '../../hooks/useMobileScrollTop';

Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function Pagos() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();

  const [pagos, setPagos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [rol, setRol] = useState(null);

  // Diccionarios para resolver IDs → nombres
  const [tipoPagoMap, setTipoPagoMap] = useState(new Map());
  const [medioPagoMap, setMedioPagoMap] = useState(new Map());
  const [situacionPagoMap, setSituacionPagoMap] = useState(new Map());
  const [jugadoresMap, setJugadoresMap] = useState(new Map()); // rut → { nombre, categoria: {id,nombre} }

  // Filtros
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroTipoPago, setFiltroTipoPago] = useState('');
  const [filtroMedioPago, setFiltroMedioPago] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  // Paginación
  const PAGE_SIZE = 10;
  const MAX_PAGES = 100;
  const [page, setPage] = useState(1);

  // ─────────────── Modal edición ───────────────
  const [editOpen, setEditOpen] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState('');
  const [editForm, setEditForm] = useState({
    id: null,
    jugador_rut: '',
    monto: '',
    fecha_pago: '',
    tipo_pago_id: '',
    medio_pago_id: '',
    situacion_pago_id: '',
    observaciones: '',
  });

  // ─────────────── Auth (token + exp + rol admin=1) ───────────────
  useEffect(() => {
    try {
      const token = getToken();
      if (!token) throw new Error('no-token');
      const decoded = jwtDecode(token);
      const now = Math.floor(Date.now() / 1000);
      if (decoded?.exp && decoded.exp < now) throw new Error('expired');

      const rawRol = decoded?.rol_id ?? decoded?.role_id ?? decoded?.role;
      const parsedRol = Number.isFinite(Number(rawRol)) ? Number(rawRol) : 0;
      if (parsedRol !== 1) {
        navigate('/admin', { replace: true });
        return;
      }
      setRol(parsedRol);
    } catch {
      clearToken();
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  useMobileAutoScrollTop();


  // ─────────────── Helpers de fetch tolerantes ───────────────
  const normalizeListResponse = (res) => {
    if (!res || res.status === 204) return [];
    const d = res?.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.results)) return d.results;
    if (Array.isArray(d?.items)) return d.items;
    return [];
  };

  const tryGetList = async (paths, signal) => {
    const variants = [];
    for (const p of paths) {
      if (p.endsWith('/')) variants.push(p, p.slice(0, -1));
      else variants.push(p, `${p}/`);
    }
    const uniq = [...new Set(variants)];
    for (const url of uniq) {
      try {
        const r = await api.get(url, { signal });
        return normalizeListResponse(r);
      } catch (e) {
        const st = e?.response?.status;
        if (st === 401 || st === 403) throw e;
        continue;
      }
    }
    return [];
  };

  // Construye Map<ID, Nombre> desde un array
  const buildIdNameMap = (arr, idKey = 'id', nameKey = 'nombre') => {
    const m = new Map();
    for (const x of Array.isArray(arr) ? arr : []) {
      const id = x?.[idKey];
      const name = x?.[nameKey] ?? String(id ?? '—');
      if (id != null) m.set(String(id), name);
    }
    return m;
  };

  // Normalización de un pago, resolviendo IDs → nombres
  const normalizePagos = (arr, { tipoPagoMap, medioPagoMap, situacionPagoMap, jugadoresMap }) => {
    const list = Array.isArray(arr) ? arr : [];
    return list.map((p, idx) => {
      const tipoId = p?.tipo_pago_id ?? p?.tipo_id ?? p?.tipoPagoId ?? p?.tipo_pago?.id ?? null;
      const medioId = p?.medio_pago_id ?? p?.medio_id ?? p?.medioPagoId ?? p?.medio_pago?.id ?? null;
      const situId = p?.situacion_pago_id ?? p?.estado_pago_id ?? p?.estado_id ?? p?.situacion_pago?.id ?? null;

      const rutPlano = p?.jugador_rut ?? p?.rut_jugador ?? p?.rut ?? p?.jugador?.rut_jugador ?? null;
      const jAnidado = p?.jugador ?? {};

      const jFromMap = rutPlano != null ? jugadoresMap.get(String(rutPlano)) : null;
      const jugadorNombre =
        jAnidado?.nombre_jugador ??
        jAnidado?.nombre ??
        jAnidado?.nombre_completo ??
        jFromMap?.nombre ??
        p?.jugador_nombre ??
        p?.nombre_jugador ??
        '—';

      const catId =
        jAnidado?.categoria?.id ??
        jAnidado?.categoria_id ??
        jFromMap?.categoria?.id ??
        null;

      const catNombre =
        jAnidado?.categoria?.nombre ??
        jAnidado?.categoria_nombre ??
        jFromMap?.categoria?.nombre ??
        (typeof jAnidado?.categoria === 'string' ? jAnidado?.categoria : null) ??
        'Sin categoría';

      const tipoNombre =
        p?.tipo_pago?.nombre ??
        p?.tipo_pago_nombre ??
        (tipoId != null ? (tipoPagoMap.get(String(tipoId)) ?? String(tipoId)) : '—');

      const medioNombre =
        p?.medio_pago?.nombre ??
        p?.medio_pago_nombre ??
        (medioId != null ? (medioPagoMap.get(String(medioId)) ?? String(medioId)) : '—');

      const situNombre =
        p?.situacion_pago?.nombre ??
        p?.estado_pago_nombre ??
        p?.estado_nombre ??
        (situId != null ? (situacionPagoMap.get(String(situId)) ?? String(situId)) : '—');

      const fecha = p?.fecha_pago ?? p?.fecha ?? null;

      return {
        id: p?.id ?? p?.ID ?? idx,
        monto: Number(p?.monto ?? 0),
        fecha_pago: fecha,
        jugador: {
          rut_jugador: rutPlano ?? '—',
          nombre_jugador: jugadorNombre,
          categoria: { id: catId, nombre: catNombre },
        },
        tipo_pago: { id: tipoId, nombre: tipoNombre },
        situacion_pago: { id: situId, nombre: situNombre },
        medio_pago: { id: medioId, nombre: medioNombre },
        observaciones: p?.observaciones ?? '',
      };
    });
  };

  // Carga catálogos y jugadores → luego pagos (con categorías)
  useEffect(() => {
    if (rol !== 1) return;
    const abort = new AbortController();

    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const [tipos, medios, situaciones, jugadores, categorias] = await Promise.all([
          tryGetList(['/tipo-pago', '/tipo_pago'], abort.signal),
          tryGetList(['/medio-pago', '/medio_pago'], abort.signal),
          tryGetList(['/situacion-pago', '/situacion_pago', '/estado-pago', '/estado_pago'], abort.signal),
          tryGetList(['/jugadores'], abort.signal),
          tryGetList(['/categorias'], abort.signal),
        ]);

        if (abort.signal.aborted) return;

        setTipoPagoMap(buildIdNameMap(tipos, 'id', 'nombre'));
        setMedioPagoMap(buildIdNameMap(medios, 'id', 'nombre'));
        setSituacionPagoMap(buildIdNameMap(situaciones, 'id', 'nombre'));
        const categoriasMap = buildIdNameMap(categorias, 'id', 'nombre');

        const jm = new Map();
        for (const j of jugadores) {
          const rut = j?.rut_jugador ?? j?.rut ?? null;
          if (rut != null) {
            const categoriaId = j?.categoria_id ?? j?.categoria?.id ?? null;
            const categoriaNombre =
              j?.categoria?.nombre ??
              j?.categoria_nombre ??
              (categoriaId != null ? (categoriasMap.get(String(categoriaId)) ?? String(categoriaId)) : null) ??
              j?.categoria ??
              'Sin categoría';
            jm.set(String(rut), {
              nombre: j?.nombre_jugador ?? j?.nombre ?? j?.nombre_completo ?? '—',
              categoria: { id: categoriaId, nombre: categoriaNombre },
            });
          }
        }
        setJugadoresMap(jm);

        const raw = await tryGetList(['/pagos-jugador'], abort.signal);
        if (abort.signal.aborted) return;
        setPagos(
          normalizePagos(raw, {
            tipoPagoMap: buildIdNameMap(tipos),
            medioPagoMap: buildIdNameMap(medios),
            situacionPagoMap: buildIdNameMap(situaciones),
            jugadoresMap: jm,
          })
        );
      } catch (e) {
        if (abort.signal.aborted) return;
        const st = e?.response?.status;
        if (st === 401 || st === 403) {
          clearToken();
          navigate('/login', { replace: true });
          return;
        }
        setError('❌ No se pudieron cargar los pagos o catálogos.');
      } finally {
        if (!abort.signal.aborted) setIsLoading(false);
      }
    })();

    return () => abort.abort();
  }, [rol, navigate]);

  // UI helpers
  const fondoClase = darkMode ? 'bg-[#111827] text-white' : 'bg-white text-[#1d0b0b]';
  const tablaCabecera = darkMode ? 'bg-[#1f2937] text-white' : 'bg-gray-100 text-[#1d0b0b]';
  const filaHover = darkMode ? 'hover:bg-[#1f2937]' : 'hover:bg-gray-50';
  const tarjetaClase = darkMode
    ? 'bg-[#1f2937] shadow-lg rounded-lg p-4 border border-gray-700'
    : 'bg-white shadow-md rounded-lg p-4 border border-gray-200';

  const controlBase = darkMode
    ? 'border border-gray-500 bg-[#1f2937] text-white placeholder-gray-400'
    : 'border border-gray-300 bg-white text-black placeholder-gray-500';

  const controlClase = `${controlBase} w-full h-10 px-3 rounded-md text-sm leading-none`;
  const controlFechaClase = `${controlClase} appearance-none min-w-0
    [-webkit-appearance:none] [-moz-appearance:textfield]
    [&::-webkit-calendar-picker-indicator]:opacity-70
    [&::-webkit-calendar-picker-indicator]:h-4
    [&::-webkit-calendar-picker-indicator]:w-4`;

  const toCLP = (n) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
      .format(Number(n || 0));

  const colores = useMemo(
    () => ['#4dc9f6','#f67019','#f53794','#537bc4','#acc236','#166a8f','#00a950','#58595b','#8549ba','#ffa600','#ff6384','#36a2eb'],
    []
  );

  // Opciones de selects para el modal (desde los mapas)
  const opcionesTipoPagoFull = useMemo(
    () => Array.from(tipoPagoMap, ([value, label]) => ({ value, label })),
    [tipoPagoMap]
  );
  const opcionesMedioPagoFull = useMemo(
    () => Array.from(medioPagoMap, ([value, label]) => ({ value, label })),
    [medioPagoMap]
  );
  const opcionesSituacionPagoFull = useMemo(
    () => Array.from(situacionPagoMap, ([value, label]) => ({ value, label })),
    [situacionPagoMap]
  );

  // Opciones de filtros (desde pagos ya normalizados → nombres)
  const opcionesTipoPago = useMemo(() => {
    const m = new Map();
    for (const p of pagos) {
      const key = String(p?.tipo_pago?.id ?? p?.tipo_pago?.nombre ?? '—');
      const label = p?.tipo_pago?.nombre ?? String(p?.tipo_pago?.id ?? '—');
      m.set(key, label);
    }
    return Array.from(m, ([value, label]) => ({ value, label }));
  }, [pagos]);

  const opcionesMedioPago = useMemo(() => {
    const m = new Map();
    for (const p of pagos) {
      const key = String(p?.medio_pago?.id ?? p?.medio_pago?.nombre ?? '—');
      const label = p?.medio_pago?.nombre ?? String(p?.medio_pago?.id ?? '—');
      m.set(key, label);
    }
    return Array.from(m, ([value, label]) => ({ value, label }));
  }, [pagos]);

  // Filtrado (solo tabla)
  const pagosFiltrados = useMemo(() => {
    const f = (filtroTexto || '').toLowerCase().trim();
    const fd = fechaDesde ? new Date(fechaDesde) : null;
    const fh = fechaHasta ? new Date(fechaHasta) : null;

    return pagos.filter((p) => {
      let okTexto = true;
      if (f) {
        const rut = String(p?.jugador?.rut_jugador ?? '');
        const nombre = String(p?.jugador?.nombre_jugador ?? '');
        okTexto = rut.includes(f) || nombre.toLowerCase().includes(f);
      }

      let okTipo = true;
      if (filtroTipoPago) {
        const key = String(p?.tipo_pago?.id ?? p?.tipo_pago?.nombre ?? '');
        okTipo = key === filtroTipoPago;
      }

      let okMedio = true;
      if (filtroMedioPago) {
        const key = String(p?.medio_pago?.id ?? p?.medio_pago?.nombre ?? '');
        okMedio = key === filtroMedioPago;
      }

      let okFecha = true;
      if (fd || fh) {
        const d = p?.fecha_pago ? new Date(p.fecha_pago) : null;
        if (!d || isNaN(d)) okFecha = false;
        if (fd && d && d < fd) okFecha = false;
        if (fh && d && d > fh) okFecha = false;
      }

      return okTexto && okTipo && okMedio && okFecha;
    });
  }, [pagos, filtroTexto, filtroTipoPago, filtroMedioPago, fechaDesde, fechaHasta]);

  // Orden y paginación de tabla
  const pagosOrdenados = useMemo(() => {
    const arr = [...pagosFiltrados];
    arr.sort((a, b) => {
      const da = a?.fecha_pago ? new Date(a.fecha_pago).getTime() : 0;
      const db = b?.fecha_pago ? new Date(b.fecha_pago).getTime() : 0;
      if (db !== da) return db - da;
      return (b?.id ?? 0) - (a?.id ?? 0);
    });
    return arr;
  }, [pagosFiltrados]);

  const totalPages = useMemo(() => {
    const tp = Math.ceil(pagosOrdenados.length / PAGE_SIZE);
    return Math.max(1, Math.min(tp, MAX_PAGES));
  }, [pagosOrdenados]);

  useEffect(() => { setPage(1); }, [filtroTexto, filtroTipoPago, filtroMedioPago, fechaDesde, fechaHasta]);

  const pageData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return pagosOrdenados.slice(start, end);
  }, [pagosOrdenados, page]);

  // Gráficos
  const datosPorTipo = useMemo(() => {
    const agg = new Map();
    for (const p of pagos) {
      const key = p?.tipo_pago?.nombre || '—';
      agg.set(key, (agg.get(key) || 0) + Number(p?.monto || 0));
    }
    return { labels: Array.from(agg.keys()), data: Array.from(agg.values()) };
  }, [pagos]);

  const datosPorMedio = useMemo(() => {
    const agg = new Map();
    for (const p of pagos) {
      const key = p?.medio_pago?.nombre || '—';
      agg.set(key, (agg.get(key) || 0) + Number(p?.monto || 0));
    }
    return { labels: Array.from(agg.keys()), data: Array.from(agg.values()) };
  }, [pagos]);

  const datosPorCategoria = useMemo(() => {
    const agg = new Map();
    for (const p of pagos) {
      const key = p?.jugador?.categoria?.nombre ?? p?.jugador?.categoria ?? 'Sin categoría';
      agg.set(key, (agg.get(key) || 0) + Number(p?.monto || 0));
    }
    return { labels: Array.from(agg.keys()), data: Array.from(agg.values()) };
  }, [pagos]);

  const datosPorMes = useMemo(() => {
    const agg = new Map();
    for (const p of pagos) {
      if (!p?.fecha_pago) continue;
      const d = new Date(p.fecha_pago);
      if (isNaN(d)) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      agg.set(key, (agg.get(key) || 0) + Number(p?.monto || 0));
    }
    const sortedKeys = Array.from(agg.keys()).sort();
    const last6 = sortedKeys.slice(-6);
    const values = last6.map((k) => agg.get(k));
    const labels = last6.map((k) => {
      const [y, m] = k.split('-').map(Number);
      const dt = new Date(y, m - 1, 1);
      return new Intl.DateTimeFormat('es-CL', { month: 'short', year: 'numeric' }).format(dt);
    });
    return { labels, data: values };
  }, [pagos]);

  const chartOpts = useMemo(() => ({
    indexAxis: 'x',
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: darkMode ? 'white' : '#1d0b0b' } } },
    scales: {
      x: { ticks: { color: darkMode ? 'white' : '#1d0b0b' } },
      y: { ticks: { color: darkMode ? 'white' : '#1d0b0b' } }
    }
  }), [darkMode]);

  const datasetFrom = (labels, data, label = 'Total (CLP)') => ({
    labels,
    datasets: [{
      label,
      data,
      backgroundColor: labels.map((_, i) => colores[i % colores.length])
    }]
  });

  // ─────────────── Acciones ───────────────
  const openEdit = (pago) => {
    setEditError('');
    setEditForm({
      id: pago.id,
      jugador_rut: pago?.jugador?.rut_jugador ?? '',
      monto: pago?.monto ?? '',
      fecha_pago: pago?.fecha_pago ? String(pago.fecha_pago).slice(0, 10) : '',
      tipo_pago_id: pago?.tipo_pago?.id ? String(pago.tipo_pago.id) : '',
      medio_pago_id: pago?.medio_pago?.id ? String(pago.medio_pago.id) : '',
      situacion_pago_id: pago?.situacion_pago?.id ? String(pago.situacion_pago.id) : '',
      observaciones: pago?.observaciones ?? '',
    });
    setEditOpen(true);
  };

  const closeEdit = () => {
    if (editBusy) return;
    setEditOpen(false);
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    setEditBusy(true);
    setEditError('');
    try {
      const payload = {
        jugador_rut: editForm.jugador_rut,
        monto: editForm.monto,
        fecha_pago: editForm.fecha_pago,
        tipo_pago_id: editForm.tipo_pago_id,
        medio_pago_id: editForm.medio_pago_id,
        situacion_pago_id: editForm.situacion_pago_id,
        observaciones: editForm.observaciones,
      };
      await api.put(`/pagos-jugador/${editForm.id}`, payload);
      // Actualiza estado local
      setPagos((prev) =>
        prev.map((p) =>
          p.id === editForm.id
            ? {
                ...p,
                monto: Number(payload.monto),
                fecha_pago: payload.fecha_pago,
                tipo_pago: {
                  id: Number(payload.tipo_pago_id),
                  nombre: tipoPagoMap.get(String(payload.tipo_pago_id)) ?? p.tipo_pago?.nombre,
                },
                medio_pago: {
                  id: Number(payload.medio_pago_id),
                  nombre: medioPagoMap.get(String(payload.medio_pago_id)) ?? p.medio_pago?.nombre,
                },
                situacion_pago: {
                  id: Number(payload.situacion_pago_id),
                  nombre: situacionPagoMap.get(String(payload.situacion_pago_id)) ?? p.situacion_pago?.nombre,
                },
                observaciones: payload.observaciones ?? '',
              }
            : p
        )
      );
      setEditOpen(false);
    } catch (err) {
      setEditError(err?.message || 'No se pudo actualizar el pago');
    } finally {
      setEditBusy(false);
    }
  };

  const removePago = async (pago) => {
    const ok = window.confirm(`¿Eliminar el pago #${pago.id}? Esta acción es irreversible.`);
    if (!ok) return;
    try {
      await api.delete(`/pagos-jugador/${pago.id}`);
      setPagos((prev) => prev.filter((p) => p.id !== pago.id));
    } catch (err) {
      alert(err?.message || 'No se pudo eliminar el pago');
    }
  };

  // ─────────────── Render ───────────────
  if (isLoading) return <IsLoading />;

  if (error) {
    return (
      <div className={`${fondoClase} min-h-screen flex items-center justify-center`}>
        <p className="text-red-500 text-xl">{error}</p>
      </div>
    );
  }

  return (
    <div className={`${fondoClase} px-2 sm:px-4 pt-4 pb-16 font-realacademy`}>
      <h2 className="text-2xl font-bold mb-6 text-center">Pagos Registrados</h2>

      {/* Filtros */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <input
          type="text"
          placeholder="Buscar por RUT o nombre"
          value={filtroTexto}
          onChange={(e) => setFiltroTexto(e.target.value)}
          className={controlClase}
        />

        <select
          value={filtroTipoPago}
          onChange={(e) => setFiltroTipoPago(e.target.value)}
          className={controlClase}
        >
          <option value="">Tipo de pago</option>
          {opcionesTipoPago.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <select
          value={filtroMedioPago}
          onChange={(e) => setFiltroMedioPago(e.target.value)}
          className={controlClase}
        >
          <option value="">Medio de pago</option>
          {opcionesMedioPago.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <input
          type="date"
          value={fechaDesde}
          onChange={(e) => setFechaDesde(e.target.value)}
          className={controlFechaClase}
          title="Desde"
        />

        <input
          type="date"
          value={fechaHasta}
          onChange={(e) => setFechaHasta(e.target.value)}
          className={controlFechaClase}
          title="Hasta"
        />
      </div>

      {/* Tabla */}
      <div className={`${tarjetaClase}`}>
        <div className="w-full overflow-x-auto">
          <table className="w-full text-xs sm:text-sm min-w-[1100px]">
            <thead className={`${tablaCabecera}`}>
              <tr>
                <th className="py-2 px-4 border min-w-[120px]">RUT Jugador</th>
                <th className="py-2 px-4 border min-w-[200px] break-all">Nombre del Jugador</th>
                <th className="py-2 px-4 border min-w-[150px] break-all">Tipo de Pago</th>
                <th className="py-2 px-4 border min-w-[130px] break-all">Situación</th>
                <th className="py-2 px-4 border min-w-[100px]">Monto</th>
                <th className="py-2 px-4 border min-w-[130px]">Fecha</th>
                <th className="py-2 px-4 border min-w-[150px] break-all">Medio de pago</th>
                <th className="py-2 px-4 border min-w-[150px] break-all">Categoría</th>
                <th className="py-2 px-4 border min-w-[120px] text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pageData.map((pago) => (
                <tr key={pago.id ?? `${pago.jugador?.rut_jugador}-${pago.fecha_pago}-${pago.monto}`} className={`${filaHover}`}>
                  <td className="py-2 px-4 border text-center">
                    {pago?.jugador?.rut_jugador ?? '—'}
                  </td>
                  <td className="py-2 px-4 border text-center break-all">
                    {pago?.jugador?.nombre_jugador ?? '—'}
                  </td>
                  <td className="py-2 px-4 border text-center break-all">
                    {pago?.tipo_pago?.nombre ?? '—'}
                  </td>
                  <td className="py-2 px-4 border text-center break-all">
                    {pago?.situacion_pago?.nombre ?? '—'}
                  </td>
                  <td className="py-2 px-4 border text-center">
                    {toCLP(pago?.monto)}
                  </td>
                  <td className="py-2 px-4 border text-center">
                    {pago?.fecha_pago
                      ? new Date(pago.fecha_pago).toLocaleDateString('es-CL')
                      : '—'}
                  </td>
                  <td className="py-2 px-4 border text-center break-all">
                    {pago?.medio_pago?.nombre ?? '—'}
                  </td>
                  <td className="py-2 px-4 border text-center break-all">
                    {pago?.jugador?.categoria?.nombre ?? 'Sin categoría'}
                  </td>
                  <td className="py-2 px-2 border text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEdit(pago)}
                        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
                        title="Editar pago"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        onClick={() => removePago(pago)}
                        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
                        title="Eliminar pago"
                      >
                        <Trash2 size={18} color="#D32F2F" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {pageData.length === 0 && (
                <tr>
                  <td className="py-4 px-4 border text-center" colSpan={9}>
                    No hay registros que coincidan con los filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className={`px-3 py-1 rounded border ${page <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-[#111827]'}`}
          >
            Anterior
          </button>
          <span className="px-2">Página {page} de {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className={`px-3 py-1 rounded border ${page >= totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-[#111827]'}`}
          >
            Siguiente
          </button>
        </div>
      </div>

      {/* Grid 2×2 de gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-10">
        <div className={`${tarjetaClase}`}>
          <h3 className="text-lg font-semibold mb-4 text-center">Total por Tipo de Pago</h3>
          <div style={{ height: '420px' }}>
            <Bar data={datasetFrom(datosPorTipo.labels, datosPorTipo.data, 'Total (CLP)')} options={chartOpts} />
          </div>
        </div>

        <div className={`${tarjetaClase}`}>
          <h3 className="text-lg font-semibold mb-4 text-center">Total por Medio de Pago</h3>
          <div style={{ height: '420px' }}>
            <Bar data={datasetFrom(datosPorMedio.labels, datosPorMedio.data, 'Total (CLP)')} options={chartOpts} />
          </div>
        </div>

        <div className={`${tarjetaClase}`}>
          <h3 className="text-lg font-semibold mb-4 text-center">Total por Categoría</h3>
          <div style={{ height: '420px' }}>
            <Bar data={datasetFrom(datosPorCategoria.labels, datosPorCategoria.data, 'Total (CLP)')} options={chartOpts} />
          </div>
        </div>

        <div className={`${tarjetaClase}`}>
          <h3 className="text-lg font-semibold mb-4 text-center">Total por Mes (últimos 6)</h3>
          <div style={{ height: '420px' }}>
            <Bar data={datasetFrom(datosPorMes.labels, datosPorMes.data, 'Total (CLP)')} options={chartOpts} />
          </div>
        </div>
      </div>

      {/* Modal Edición */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className={`${darkMode ? 'bg-[#1f2937] text-white' : 'bg-white'} w-[95%] max-w-2xl rounded-lg p-5 shadow-lg`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Editar pago #{editForm.id}</h3>
              <button className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10" onClick={closeEdit} disabled={editBusy}>
                <X size={18} />
              </button>
            </div>

            {editError && <p className="mb-3 text-red-500 text-sm">{editError}</p>}

            <form onSubmit={submitEdit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1 opacity-80">RUT Jugador</label>
                <input
                  type="text"
                  value={editForm.jugador_rut}
                  onChange={(e) => setEditForm(f => ({ ...f, jugador_rut: e.target.value }))}
                  className={controlClase}
                  disabled
                  title="No editable"
                />
              </div>

              <div>
                <label className="block text-xs mb-1 opacity-80">Monto (CLP)</label>
                <input
                  type="number"
                  value={editForm.monto}
                  onChange={(e) => setEditForm(f => ({ ...f, monto: e.target.value }))}
                  className={controlClase}
                  required
                />
              </div>

              <div>
                <label className="block text-xs mb-1 opacity-80">Fecha pago</label>
                <input
                  type="date"
                  value={editForm.fecha_pago}
                  onChange={(e) => setEditForm(f => ({ ...f, fecha_pago: e.target.value }))}
                  className={controlFechaClase}
                  required
                />
              </div>

              <div>
                <label className="block text-xs mb-1 opacity-80">Tipo de pago</label>
                <select
                  value={editForm.tipo_pago_id}
                  onChange={(e) => setEditForm(f => ({ ...f, tipo_pago_id: e.target.value }))}
                  className={controlClase}
                  required
                >
                  <option value="">Seleccione…</option>
                  {opcionesTipoPagoFull.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs mb-1 opacity-80">Medio de pago</label>
                <select
                  value={editForm.medio_pago_id}
                  onChange={(e) => setEditForm(f => ({ ...f, medio_pago_id: e.target.value }))}
                  className={controlClase}
                  required
                >
                  <option value="">Seleccione…</option>
                  {opcionesMedioPagoFull.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs mb-1 opacity-80">Situación</label>
                <select
                  value={editForm.situacion_pago_id}
                  onChange={(e) => setEditForm(f => ({ ...f, situacion_pago_id: e.target.value }))}
                  className={controlClase}
                  required
                >
                  <option value="">Seleccione…</option>
                  {opcionesSituacionPagoFull.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs mb-1 opacity-80">Observaciones</label>
                <textarea
                  value={editForm.observaciones}
                  onChange={(e) => setEditForm(f => ({ ...f, observaciones: e.target.value }))}
                  className={`${controlBase} w-full min-h-[80px] rounded-md p-3 text-sm`}
                  placeholder="Opcional"
                />
              </div>

              <div className="md:col-span-2 flex justify-end gap-2 mt-2">
                <button type="button" onClick={closeEdit} disabled={editBusy}
                  className="px-3 py-1 rounded border hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-50">
                  Cancelar
                </button>
                <button type="submit" disabled={editBusy}
                  className="px-3 py-1 rounded bg-[#e82d89] text-white hover:bg-pink-700 disabled:opacity-50">
                  {editBusy ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
