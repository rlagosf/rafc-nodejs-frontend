// src/pages/admin/EstadosCuenta.jsx
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import api, { getToken, clearToken } from '../../services/api';
import { Chart, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import IsLoading from '../../components/isLoading';
import { jwtDecode } from 'jwt-decode';
import { Pencil, Trash2, X } from 'lucide-react';
import { useMobileAutoScrollTop } from '../../hooks/useMobileScrollTop';
import { formatRutWithDV } from '../../services/rut';

Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

// Config mensualidad
const MENSUALIDAD_TIPO_PAGO_ID = 3; // ajusta según tu catálogo real
const DIA_CORTE_VENCIDO = 5;

export default function EstadosCuenta() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();

  const [pagos, setPagos] = useState([]);          // TODOS los pagos (mensualidad, torneo, etc.)
  const [jugadores, setJugadores] = useState([]);  // lista completa de jugadores

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [rol, setRol] = useState(null);

  // Diccionarios para resolver IDs → nombres
  const [tipoPagoMap, setTipoPagoMap] = useState(new Map());
  const [medioPagoMap, setMedioPagoMap] = useState(new Map());
  const [situacionPagoMap, setSituacionPagoMap] = useState(new Map());
  const [jugadoresMap, setJugadoresMap] = useState(new Map()); // rut → { nombre, categoria: {id,nombre} }

  // Filtros (aplicados sobre jugadores/estados)
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');        // PAGADO / PENDIENTE / VENCIDO
  const [filtroTipoPago, setFiltroTipoPago] = useState('');    // id tipo_pago
  const [filtroCategoriaSel, setFiltroCategoriaSel] = useState('');
  const [filtroMedioPago, setFiltroMedioPago] = useState('');  // id medio_pago

  // Paginación (para filas de jugadores)
  const PAGE_SIZE = 10;
  const MAX_PAGES = 200;
  const [page, setPage] = useState(1);

  // Modal edición
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

  useMobileAutoScrollTop();

  // ───────── Auth ─────────
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

  // ───────── Helpers fetch ─────────
  const normalizeListResponse = (res) => {
    if (!res || res.status === 204) return [];
    const d = res?.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.results)) return d.results;
    if (Array.isArray(d?.items)) return d.items;
    if (Array.isArray(d?.rows)) return d.rows;
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

  const buildIdNameMap = (arr, idKey = 'id', nameKey = 'nombre') => {
    const m = new Map();
    for (const x of Array.isArray(arr) ? arr : []) {
      const id = x?.[idKey];
      const name = x?.[nameKey] ?? String(id ?? '—');
      if (id != null) m.set(String(id), name);
    }
    return m;
  };

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

  // ───────── Carga catálogos, jugadores y pagos ─────────
  useEffect(() => {
    if (rol !== 1) return;
    const abort = new AbortController();

    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const [tipos, medios, situaciones, jugadoresList, categorias] = await Promise.all([
          tryGetList(['/tipo-pago', '/tipo_pago'], abort.signal),
          tryGetList(['/medio-pago', '/medio_pago'], abort.signal),
          tryGetList(['/situacion-pago', '/situacion_pago', '/estado-pago', '/estado_pago'], abort.signal),
          tryGetList(['/jugadores'], abort.signal),
          tryGetList(['/categorias'], abort.signal),
        ]);

        if (abort.signal.aborted) return;

        setJugadores(jugadoresList);

        setTipoPagoMap(buildIdNameMap(tipos, 'id', 'nombre'));
        setMedioPagoMap(buildIdNameMap(medios, 'id', 'nombre'));
        setSituacionPagoMap(buildIdNameMap(situaciones, 'id', 'nombre'));
        const categoriasMap = buildIdNameMap(categorias, 'id', 'nombre');

        const jm = new Map();
        for (const j of jugadoresList) {
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

        const respPagos = await api.get('/pagos-jugador', { signal: abort.signal });
        if (abort.signal.aborted) return;

        const rawPagos = normalizeListResponse(respPagos);
        const pagosNorm = normalizePagos(rawPagos, {
          tipoPagoMap: buildIdNameMap(tipos),
          medioPagoMap: buildIdNameMap(medios),
          situacionPagoMap: buildIdNameMap(situaciones),
          jugadoresMap: jm,
        });

        // 🔹 Ahora guardamos TODOS los pagos (mensualidad, torneo, matrícula, etc.)
        setPagos(pagosNorm);
      } catch (e) {
        if (abort.signal.aborted) return;
        const st = e?.response?.status;
        if (st === 401 || st === 403) {
          clearToken();
          navigate('/login', { replace: true });
          return;
        }
        setError('❌ No se pudieron cargar los estados de cuenta (jugadores o pagos).');
      } finally {
        if (!abort.signal.aborted) setIsLoading(false);
      }
    })();

    return () => abort.abort();
  }, [rol, navigate]);

  // ───────── UI helpers ─────────
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

  const toCLP = (n) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
      .format(Number(n || 0));

  const colores = useMemo(
    () => [
      '#4dc9f6',
      '#f67019',
      '#f53794',
      '#537bc4',
      '#acc236',
      '#166a8f',
      '#00a950',
      '#58595b',
      '#8549ba',
      '#ffa600',
      '#ff6384',
      '#36a2eb',
    ],
    []
  );

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  const mesActualLabel = new Intl.DateTimeFormat('es-CL', {
    month: 'long',
    year: 'numeric',
  }).format(now);

  const baseEstadoSinPago = currentDay <= DIA_CORTE_VENCIDO ? 'PENDIENTE' : 'VENCIDO';

  // ───────── Opciones de filtros (tipo, categoría, medio) ─────────
  const opcionesTipoPago = useMemo(() => {
    const m = new Map();
    for (const p of pagos) {
      const id = p?.tipo_pago?.id;
      const nombre = p?.tipo_pago?.nombre;
      if (!id || !nombre) continue;
      m.set(String(id), nombre);
    }
    return Array.from(m, ([value, label]) => ({ value, label }));
  }, [pagos]);

  const opcionesCategoria = useMemo(() => {
    const s = new Set();
    for (const j of jugadores) {
      const rut = String(j?.rut_jugador ?? j?.rut ?? '');
      const catNombre =
        j?.categoria?.nombre ??
        j?.categoria_nombre ??
        (typeof j?.categoria === 'string'
          ? j.categoria
          : jugadoresMap.get(rut)?.categoria?.nombre);
      if (catNombre) s.add(catNombre);
    }
    return Array.from(s).map((label) => ({ value: label, label }));
  }, [jugadores, jugadoresMap]);

  const opcionesMedioPago = useMemo(() => {
    const m = new Map();
    for (const p of pagos) {
      const id = p?.medio_pago?.id;
      const nombre = p?.medio_pago?.nombre;
      if (!id || !nombre) continue;
      m.set(String(id), nombre);
    }
    return Array.from(m, ([value, label]) => ({ value, label }));
  }, [pagos]);

  // ───────── Cálculo de estado por jugador ─────────
  const filas = useMemo(() => {
    if (!Array.isArray(jugadores) || jugadores.length === 0) return [];

    // Agrupamos TODOS los pagos por RUT
    const pagosPorRut = new Map();
    for (const p of pagos) {
      const rut = String(p?.jugador?.rut_jugador ?? p?.jugador_rut ?? p?.rut_jugador ?? '');
      if (!rut) continue;

      const d = p?.fecha_pago ? new Date(p.fecha_pago) : null;
      const year = d && !isNaN(d) ? d.getFullYear() : null;
      const month = d && !isNaN(d) ? d.getMonth() + 1 : null;

      const arr = pagosPorRut.get(rut) || [];
      arr.push({ pago: p, year, month });
      pagosPorRut.set(rut, arr);
    }

    return jugadores.map((j) => {
      const rut = String(j?.rut_jugador ?? j?.rut ?? '');
      const nombre =
        j?.nombre_jugador ?? j?.nombre ?? j?.nombre_completo ?? '—';
      const categoria =
        j?.categoria?.nombre ??
        j?.categoria_nombre ??
        (typeof j?.categoria === 'string'
          ? j.categoria
          : jugadoresMap.get(rut)?.categoria?.nombre) ??
        'Sin categoría';

      const arrAll = rut ? pagosPorRut.get(rut) || [] : [];

      // Solo pagos de Mensualidad para el estado mensual
      const arrMensual = arrAll.filter(
        (x) => Number(x.pago?.tipo_pago?.id) === MENSUALIDAD_TIPO_PAGO_ID
      );

      const pagosMensualMesActual = arrMensual
        .filter((x) => x.year === currentYear && x.month === currentMonth)
        .map((x) => x.pago);

      let estado = baseEstadoSinPago;
      if (pagosMensualMesActual.length > 0) {
        estado = 'PAGADO';
      }

      // Último pago de cualquier tipo (mensualidad, torneo, matrícula, etc.)
      let lastPago = null;
      if (arrAll.length > 0) {
        arrAll.sort((a, b) => {
          const da = a?.pago?.fecha_pago ? new Date(a.pago.fecha_pago).getTime() : 0;
          const db = b?.pago?.fecha_pago ? new Date(b.pago.fecha_pago).getTime() : 0;
          return db - da;
        });
        lastPago = arrAll[0].pago;
      }

      return {
        rut,
        nombre,
        categoria,
        estadoMensualidad: estado,
        lastPago,
      };
    });
  }, [jugadores, pagos, jugadoresMap, currentYear, currentMonth, baseEstadoSinPago]);

  // ───────── Filtros + paginación ─────────
  const filasFiltradas = useMemo(() => {
    const f = (filtroTexto || '').toLowerCase().trim();

    return filas.filter((row) => {
      let okTexto = true;
      if (f) {
        const rut = row.rut || '';
        const nombre = row.nombre || '';
        const categoria = row.categoria || '';
        okTexto =
          rut.includes(f) ||
          nombre.toLowerCase().includes(f) ||
          categoria.toLowerCase().includes(f);
      }

      let okEstado = true;
      if (filtroEstado) {
        okEstado = row.estadoMensualidad === filtroEstado;
      }

      let okTipo = true;
      if (filtroTipoPago) {
        const idTipo = row.lastPago?.tipo_pago?.id
          ? String(row.lastPago.tipo_pago.id)
          : '';
        okTipo = idTipo === filtroTipoPago;
      }

      let okCat = true;
      if (filtroCategoriaSel) {
        okCat = row.categoria === filtroCategoriaSel;
      }

      let okMedio = true;
      if (filtroMedioPago) {
        const idMedio = row.lastPago?.medio_pago?.id
          ? String(row.lastPago.medio_pago.id)
          : '';
        okMedio = idMedio === filtroMedioPago;
      }

      return okTexto && okEstado && okTipo && okCat && okMedio;
    });
  }, [filas, filtroTexto, filtroEstado, filtroTipoPago, filtroCategoriaSel, filtroMedioPago]);

  const filasOrdenadas = useMemo(() => {
    const pesoEstado = (estado) => {
      if (estado === 'VENCIDO') return 0;
      if (estado === 'PENDIENTE') return 1;
      if (estado === 'PAGADO') return 2;
      return 3;
    };

    const arr = [...filasFiltradas];
    arr.sort((a, b) => {
      const ea = pesoEstado(a.estadoMensualidad);
      const eb = pesoEstado(b.estadoMensualidad);
      if (ea !== eb) return ea - eb;
      return a.nombre.localeCompare(b.nombre, 'es');
    });
    return arr;
  }, [filasFiltradas]);

  const totalPages = useMemo(() => {
    const tp = Math.ceil(filasOrdenadas.length / PAGE_SIZE);
    return Math.max(1, Math.min(tp, MAX_PAGES));
  }, [filasOrdenadas]);

  useEffect(() => {
    setPage(1);
  }, [filtroTexto, filtroEstado, filtroTipoPago, filtroCategoriaSel, filtroMedioPago]);

  const pageData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return filasOrdenadas.slice(start, end);
  }, [filasOrdenadas, page]);

  // ───────── Gráficos (TODOS los pagos) ─────────
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

  const chartOpts = useMemo(
    () => ({
      indexAxis: 'x',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: darkMode ? 'white' : '#1d0b0b' } } },
      scales: {
        x: { ticks: { color: darkMode ? 'white' : '#1d0b0b' } },
        y: { ticks: { color: darkMode ? 'white' : '#1d0b0b' } },
      },
    }),
    [darkMode]
  );

  const datasetFrom = (labels, data, label = 'Total (CLP)') => ({
    labels,
    datasets: [
      {
        label,
        data,
        backgroundColor: labels.map((_, i) => colores[i % colores.length]),
      },
    ],
  });

  const estadoPillClass = (estado) => {
    if (estado === 'PAGADO') {
      return 'bg-green-100 text-green-800 border border-green-300';
    }
    if (estado === 'VENCIDO') {
      return 'bg-red-100 text-red-800 border border-red-300';
    }
    if (estado === 'PENDIENTE') {
      return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
    }
    return 'bg-gray-100 text-gray-800 border border-gray-300';
  };

  // ───────── Acciones ─────────
  const openEdit = (pago) => {
    if (!pago) return;
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
    if (!pago) return;
    const ok = window.confirm(`¿Eliminar el pago #${pago.id}? Esta acción es irreversible.`);
    if (!ok) return;
    try {
      await api.delete(`/pagos-jugador/${pago.id}`);
      setPagos((prev) => prev.filter((p) => p.id !== pago.id));
    } catch (err) {
      alert(err?.message || 'No se pudo eliminar el pago');
    }
  };

  // ───────── Render ─────────
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
      <h2 className="text-2xl font-bold mb-2 text-center">Estado de Cuenta — Mensualidad</h2>
      <p className="text-center mb-6 text-sm opacity-80">
        Mes en curso:{' '}
        <span className="font-semibold capitalize">{mesActualLabel}</span> · Corte:{' '}
        <span className="font-semibold">{DIA_CORTE_VENCIDO}</span> (desde ese día, sin pago de{' '}
        <span className="font-semibold">Mensualidad</span> =&gt;{' '}
        <span className="font-semibold text-red-500">VENCIDO</span>)
      </p>

      {/* Filtros */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-3 items-end">
        <input
          type="text"
          placeholder="Buscar por RUT, nombre o categoría"
          value={filtroTexto}
          onChange={(e) => setFiltroTexto(e.target.value)}
          className={controlClase}
        />

        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className={controlClase}
        >
          <option value="">Estado (todos)</option>
          <option value="PAGADO">PAGADO</option>
          <option value="PENDIENTE">PENDIENTE</option>
          <option value="VENCIDO">VENCIDO</option>
        </select>

        <select
          value={filtroTipoPago}
          onChange={(e) => setFiltroTipoPago(e.target.value)}
          className={controlClase}
        >
          <option value="">Tipo de pago (todos)</option>
          {opcionesTipoPago.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={filtroCategoriaSel}
          onChange={(e) => setFiltroCategoriaSel(e.target.value)}
          className={controlClase}
        >
          <option value="">Categoría (todas)</option>
          {opcionesCategoria.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={filtroMedioPago}
          onChange={(e) => setFiltroMedioPago(e.target.value)}
          className={controlClase}
        >
          <option value="">Medio de pago (todos)</option>
          {opcionesMedioPago.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tabla por jugador */}
      <div className={`${tarjetaClase}`}>
        <div className="w-full overflow-x-auto">
          <table className="w-full text-xs sm:text-sm min-w-[1100px]">
            <thead className={`${tablaCabecera}`}>
              <tr>
                <th className="py-2 px-4 border min-w-[120px]">RUT Jugador</th>
                <th className="py-2 px-4 border min-w-[220px] break-all">Nombre del Jugador</th>
                <th className="py-2 px-4 border min-w-[150px] break-all">Categoría</th>
                <th className="py-2 px-4 border min-w-[140px] break-all text-center">
                  Tipo de Pago (último)
                </th>
                <th className="py-2 px-4 border min-w-[160px] break-all text-center">
                  Estado Mensualidad (mes actual)
                </th>
                <th className="py-2 px-4 border min-w-[130px]">Fecha último pago</th>
                <th className="py-2 px-4 border min-w-[130px]">Monto último pago</th>
                <th className="py-2 px-4 border min-w-[150px] break-all">Medio de pago</th>
                <th className="py-2 px-4 border min-w-[120px] text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pageData.map((row) => {
                const estado = row.estadoMensualidad;
                const pago = row.lastPago;

                return (
                  <tr
                    key={row.rut || row.nombre}
                    className={`${filaHover}`}
                  >
                    <td className="py-2 px-4 border text-center">
                      {row.rut ? formatRutWithDV(row.rut) : '—'}
                    </td>

                    <td className="py-2 px-4 border text-center break-all">
                      {row.nombre}
                    </td>

                    <td className="py-2 px-4 border text-center break-all">
                      {row.categoria}
                    </td>

                    <td className="py-2 px-4 border text-center break-all">
                      {pago?.tipo_pago?.nombre ?? '—'}
                    </td>

                    <td className="py-2 px-4 border text-center">
                      <span
                        className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold ${estadoPillClass(
                          estado
                        )}`}
                      >
                        {estado}
                      </span>
                    </td>

                    <td className="py-2 px-4 border text-center">
                      {pago?.fecha_pago
                        ? new Date(pago.fecha_pago).toLocaleDateString('es-CL')
                        : '—'}
                    </td>

                    <td className="py-2 px-4 border text-center">
                      {pago ? toCLP(pago.monto) : '—'}
                    </td>

                    <td className="py-2 px-4 border text-center break-all">
                      {pago?.medio_pago?.nombre ?? '—'}
                    </td>

                    <td className="py-2 px-2 border text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(pago)}
                          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-50"
                          title={pago ? 'Editar último pago' : 'Sin pago para editar'}
                          disabled={!pago}
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={() => removePago(pago)}
                          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-50"
                          title={pago ? 'Eliminar último pago' : 'Sin pago para eliminar'}
                          disabled={!pago}
                        >
                          <Trash2 size={18} color="#D32F2F" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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
            className={`px-3 py-1 rounded border ${
              page <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-[#111827]'
            }`}
          >
            Anterior
          </button>
          <span className="px-2">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className={`px-3 py-1 rounded border ${
              page >= totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-[#111827]'
            }`}
          >
            Siguiente
          </button>
        </div>
      </div>

      {/* Gráficos (TODOS los pagos) */}
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
            <Bar
              data={datasetFrom(datosPorCategoria.labels, datosPorCategoria.data, 'Total (CLP)')}
              options={chartOpts}
            />
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
          <div
            className={`${
              darkMode ? 'bg-[#1f2937] text-white' : 'bg-white'
            } w-[95%] max-w-2xl rounded-lg p-5 shadow-lg`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Editar pago #{editForm.id}</h3>
              <button
                className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
                onClick={closeEdit}
                disabled={editBusy}
              >
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
                  onChange={(e) => setEditForm((f) => ({ ...f, jugador_rut: e.target.value }))}
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
                  onChange={(e) => setEditForm((f) => ({ ...f, monto: e.target.value }))}
                  className={controlClase}
                  required
                />
              </div>

              <div>
                <label className="block text-xs mb-1 opacity-80">Fecha pago</label>
                <input
                  type="date"
                  value={editForm.fecha_pago}
                  onChange={(e) => setEditForm((f) => ({ ...f, fecha_pago: e.target.value }))}
                  className={controlClase}
                  required
                />
              </div>

              <div>
                <label className="block text-xs mb-1 opacity-80">Tipo de pago</label>
                <select
                  value={editForm.tipo_pago_id}
                  onChange={(e) => setEditForm((f) => ({ ...f, tipo_pago_id: e.target.value }))}
                  className={controlClase}
                  required
                >
                  <option value="">Seleccione…</option>
                  {Array.from(tipoPagoMap, ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs mb-1 opacity-80">Medio de pago</label>
                <select
                  value={editForm.medio_pago_id}
                  onChange={(e) => setEditForm((f) => ({ ...f, medio_pago_id: e.target.value }))}
                  className={controlClase}
                  required
                >
                  <option value="">Seleccione…</option>
                  {Array.from(medioPagoMap, ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs mb-1 opacity-80">Situación</label>
                <select
                  value={editForm.situacion_pago_id}
                  onChange={(e) => setEditForm((f) => ({ ...f, situacion_pago_id: e.target.value }))}
                  className={controlClase}
                  required
                >
                  <option value="">Seleccione…</option>
                  {Array.from(situacionPagoMap, ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs mb-1 opacity-80">Observaciones</label>
                <textarea
                  value={editForm.observaciones}
                  onChange={(e) => setEditForm((f) => ({ ...f, observaciones: e.target.value }))}
                  className={`${controlBase} w-full min-h-[80px] rounded-md p-3 text-sm`}
                  placeholder="Opcional"
                />
              </div>

              <div className="md:col-span-2 flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={editBusy}
                  className="px-3 py-1 rounded border hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editBusy}
                  className="px-3 py-1 rounded bg-[#e82d89] text-white hover:bg-pink-700 disabled:opacity-50"
                >
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
