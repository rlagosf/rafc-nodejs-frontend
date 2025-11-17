// src/pages/admin/estadisticasGlobales.jsx
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pie, Bar } from 'react-chartjs-2';
import {
  Chart,
  ArcElement,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale
} from 'chart.js';
import api, { getToken, clearToken } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import IsLoading from '../../components/isLoading';
import { jwtDecode } from 'jwt-decode';

Chart.register(ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

/* ───────── Valor centrado en la porción ───────── */
const PieValueInsidePlugin = {
  id: 'pieValueInside',
  afterDatasetsDraw(chart, _args, pluginOptions) {
    const { ctx } = chart;
    const ds = chart.data.datasets?.[0];
    if (!ds) return;
    const meta = chart.getDatasetMeta(0);
    const values = ds.data || [];

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = (pluginOptions && pluginOptions.font) || '12px sans-serif';
    ctx.fillStyle =
      (pluginOptions && pluginOptions.color) ||
      (chart.options?.plugins?.legend?.labels?.color || '#111');

    meta.data.forEach((arc, i) => {
      const val = Number(values[i] || 0);
      if (!arc || !Number.isFinite(val)) return;
      if ((arc.circumference || 0) < 0.1) return;
      const p = arc.tooltipPosition();
      ctx.fillText(String(val), p.x, p.y);
    });

    ctx.restore();
  }
};

/* ───────── Leyenda HTML horizontal (una fila con scroll-x) ───────── */
const HtmlLegendPlugin = {
  id: 'htmlLegend',
  afterUpdate(chart, _args, options) {
    const containerID = options?.containerID;
    if (!containerID) return;
    const legendContainer = document.getElementById(containerID);
    if (!legendContainer) return;

    while (legendContainer.firstChild) legendContainer.firstChild.remove();

    const ul = document.createElement('ul');
    ul.className =
      'inline-flex flex-nowrap items-center gap-2 text-[10px] sm:text-xs';

    const items = chart.options.plugins.legend.labels.generateLabels(chart);

    items.forEach((item) => {
      const li = document.createElement('li');
      li.className =
        'shrink-0 inline-flex items-center gap-2 px-2 py-1 rounded ' +
        'border border-gray-300 dark:border-gray-600 cursor-pointer ' +
        'hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors';

      const box = document.createElement('span');
      box.className = 'inline-block w-3 h-3 rounded';
      box.style.background = item.fillStyle;
      box.style.opacity = item.hidden ? '0.3' : '1';

      const value =
        chart.data?.datasets?.[item.datasetIndex]?.data?.[item.index] ?? 0;

      const labelSpan = document.createElement('span');
      labelSpan.textContent = `${item.text} (${value})`;
      labelSpan.style.opacity = item.hidden ? '0.5' : '1';

      li.onclick = () => {
        chart.toggleDataVisibility(item.index);
        chart.update();
      };

      li.appendChild(box);
      li.appendChild(labelSpan);
      ul.appendChild(li);
    });

    legendContainer.appendChild(ul);
  }
};

Chart.register(PieValueInsidePlugin, HtmlLegendPlugin);

export default function EstadisticasGlobales() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const [jugadores, setJugadores] = useState([]);
  const [estadisticas, setEstadisticas] = useState([]);

  const [categorias, setCategorias] = useState([]);
  const [posiciones, setPosiciones] = useState([]);
  const [estados, setEstados] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [rol, setRol] = useState(null);

  // Clases de UI según tema
  const fondoClase = darkMode ? 'bg-[#111827] text-white' : 'bg-white text-[#1d0b0b]';
  const tarjetaClase = darkMode
    ? 'bg-[#1f2937] text-white border border-gray-700'
    : 'bg-white text-[#1d0b0b] border border-gray-200';

  /* ───────────────── Título dinámico para el layout ───────────────── */
  useEffect(() => {
    const title = 'Estadísticas Globales de Jugadores';
    // Título del documento (útil si el layout lo usa)
    document.title = `RAFC — ${title}`;
    // Eventos opcionales por si tu layout escucha alguno
    document.dispatchEvent(new CustomEvent('updateBreadcrumb', { detail: { title } }));
    document.dispatchEvent(new CustomEvent('rafc:setTitle', { detail: { title } }));
  }, []);

  /* ───────────────── Auth robusto ───────────────── */
  useEffect(() => {
    try {
      const token = getToken(); // 'rafc_token'
      if (!token) throw new Error('no-token');
      const decoded = jwtDecode(token);
      const now = Math.floor(Date.now() / 1000);
      if (decoded?.exp && decoded.exp < now) throw new Error('expired');

      const rawRol = decoded?.rol_id ?? decoded?.role_id ?? decoded?.role;
      const parsedRol = Number.isFinite(Number(rawRol)) ? Number(rawRol) : 0;
      if (![1, 2].includes(parsedRol)) {
        navigate('/admin', { replace: true });
        return;
      }
      setRol(parsedRol);
    } catch {
      clearToken();
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  /* ───────────────── Helpers de fetch tolerantes ───────────────── */
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
      variants.push(p.endsWith('/') ? p : `${p}/`);
      variants.push(p.endsWith('/') ? p.slice(0, -1) : p);
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

  const normalizeCatalog = (arr) =>
    (Array.isArray(arr) ? arr : [])
      .map(x => ({
        id: Number(x?.id ?? x?.categoria_id ?? x?.posicion_id ?? x?.estado_id),
        nombre: String(x?.nombre ?? x?.descripcion ?? '')
      }))
      .filter(x => Number.isFinite(x.id) && x.nombre);

  /* ───────────────── Carga de datos ───────────────── */
  useEffect(() => {
    if (rol == null) return;
    const abort = new AbortController();

    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const jugPaths = rol === 2 ? ['/jugadores/staff', '/jugadores'] : ['/jugadores', '/jugadores/staff'];
        const [jugs, cats, poss, ests, stats] = await Promise.all([
          tryGetList(jugPaths, abort.signal),
          tryGetList(['/categorias'], abort.signal),
          tryGetList(['/posiciones'], abort.signal),
          tryGetList(['/estado'], abort.signal),
          tryGetList(['/estadisticas'], abort.signal),
        ]);
        if (abort.signal.aborted) return;

        setJugadores(Array.isArray(jugs) ? jugs : []);
        setCategorias(normalizeCatalog(cats));
        setPosiciones(normalizeCatalog(poss));
        setEstados(normalizeCatalog(ests));
        setEstadisticas(Array.isArray(stats) ? stats : []);
      } catch (e) {
        if (abort.signal.aborted) return;
        const st = e?.response?.status;
        if (st === 401 || st === 403) {
          clearToken();
          navigate('/login', { replace: true });
          return;
        }
        setError('Error al cargar datos');
      } finally {
        if (!abort.signal.aborted) setIsLoading(false);
      }
    })();

    return () => abort.abort();
  }, [rol, navigate]);

  /* ───────────────── Definiciones ───────────────── */
  const grupos = {
    ofensivas: ['goles', 'asistencias', 'tiros_libres', 'penales', 'tiros_arco', 'tiros_fuera', 'tiros_bloqueados', 'regates_exitosos', 'centros_acertados', 'pases_clave'],
    defensivas: ['intercepciones', 'despejes', 'duelos_ganados', 'entradas_exitosas', 'bloqueos', 'recuperaciones'],
    tecnicas: ['pases_completados', 'pases_errados', 'posesion_perdida', 'offsides', 'faltas_cometidas', 'faltas_recibidas'],
    fisicas: ['distancia_recorrida_km', 'sprints', 'duelos_aereos_ganados', 'minutos_jugados', 'partidos_jugados'],
    medicas: ['lesiones', 'dias_baja'],
    disciplina: ['tarjetas_amarillas', 'tarjetas_rojas', 'sanciones_federativas'],
  };

  const traducciones = {
    goles: 'Goles', asistencias: 'Asistencias', tiros_libres: 'Tiros Libres', penales: 'Penales',
    tiros_arco: 'Tiros al Arco', tiros_fuera: 'Tiros Fuera', tiros_bloqueados: 'Tiros Bloqueados',
    regates_exitosos: 'Regates Exitosos', centros_acertados: 'Centros Acertados', pases_clave: 'Pases Clave',
    intercepciones: 'Intercepciones', despejes: 'Despejes', duelos_ganados: 'Duelos Ganados',
    entradas_exitosas: 'Entradas Exitosas', bloqueos: 'Bloqueos', recuperaciones: 'Recuperaciones',
    pases_completados: 'Pases Completados', pases_errados: 'Pases Errados', posesion_perdida: 'Pérdidas de Posesión',
    offsides: 'Offsides', faltas_cometidas: 'Faltas Cometidas', faltas_recibidas: 'Faltas Recibidas',
    distancia_recorrida_km: 'Distancia Recorrida (Km)', sprints: 'Sprints', duelos_aereos_ganados: 'Duelos Aéreos Ganados',
    minutos_jugados: 'Minutos Jugados', partidos_jugados: 'Partidos Jugados',
    lesiones: 'Lesiones', dias_baja: 'Días de Baja',
    tarjetas_amarillas: 'Tarjetas Amarillas', tarjetas_rojas: 'Tarjetas Rojas', sanciones_federativas: 'Sanciones Federativas',
  };

  const coloresFijos = [
    '#4dc9f6', '#f67019', '#f53794', '#537bc4', '#acc236', '#166a8f',
    '#00a950', '#58595b', '#8549ba', '#ffa600', '#ff6384', '#36a2eb'
  ];

  /* ───────────────── Mapeos & agregaciones ───────────────── */
  const catMap = useMemo(() => new Map((categorias || []).map(c => [Number(c.id), c.nombre])), [categorias]);
  const posMap = useMemo(() => new Map((posiciones || []).map(p => [Number(p.id), p.nombre])), [posiciones]);
  const estMap = useMemo(() => new Map((estados || []).map(e => [Number(e.id), e.nombre])), [estados]);

  // Conteos por categoría/posición/estado/edad
  const conteos = useMemo(() => {
    const sumBy = (extractor) => {
      const m = new Map();
      (jugadores || []).forEach(j => {
        const key = extractor(j) || '—';
        m.set(key, (m.get(key) || 0) + 1);
      });
      return Object.fromEntries(m);
    };

    const getCategoriaNombre = (j) =>
      j?.categoria?.nombre ??
      (j?.categoria_id != null ? catMap.get(Number(j.categoria_id)) : undefined);

    const getPosicionNombre = (j) =>
      j?.posicion?.nombre ??
      (j?.posicion_id != null ? posMap.get(Number(j.posicion_id)) : undefined);

    const getEstadoNombre = (j) =>
      j?.estado?.nombre ??
      (j?.estado_id != null ? estMap.get(Number(j.estado_id)) : undefined);

    const edades = {};
    (jugadores || []).forEach(j => {
      const e = Number(j?.edad);
      const key = Number.isFinite(e) && e >= 0 ? String(e) : '—';
      edades[key] = (edades[key] || 0) + 1;
    });

    return {
      edades,
      categorias: sumBy(getCategoriaNombre),
      posiciones: sumBy(getPosicionNombre),
      estados: sumBy(getEstadoNombre),
    };
  }, [jugadores, catMap, posMap, estMap]);

  // Sumas de métricas por grupo
  const sumasPorGrupo = useMemo(() => {
    const sumGroup = (campos) => {
      const r = {};
      for (const campo of campos) {
        r[campo] = (estadisticas || []).reduce((acc, est) => acc + (Number(est?.[campo]) || 0), 0);
      }
      return r;
    };
    return Object.fromEntries(
      Object.entries(grupos).map(([nombre, campos]) => [nombre, sumGroup(campos)])
    );
  }, [estadisticas]);

  const generatePieData = (conteo) => {
    const labels = Object.keys(conteo || {});
    const data = Object.values(conteo || {});
    const colores = labels.map((_, idx) => coloresFijos[idx % coloresFijos.length]);
    return { labels, datasets: [{ data, backgroundColor: colores }] };
  };

  const crearDatosBar = (datos) => ({
    labels: Object.keys(datos).map(k => traducciones[k]),
    datasets: [{
      label: 'Total',
      data: Object.values(datos),
      backgroundColor: coloresFijos.slice(0, Object.keys(datos).length)
    }]
  });

  if (isLoading) return <IsLoading />;

  if (error) {
    return (
      <div className={`${fondoClase} min-h-screen flex items-center justify-center`}>
        <p className="text-red-500 text-xl">{error}</p>
      </div>
    );
  }

  const tarjetasPie = [
    { key: 'edades', label: 'Edades', data: conteos.edades },
    { key: 'categorias', label: 'Categorías', data: conteos.categorias },
    { key: 'posiciones', label: 'Posiciones', data: conteos.posiciones },
    { key: 'estados', label: 'Estado', data: conteos.estados },
  ];

  return (
    <div className={`${fondoClase} min-h-screen px-2 sm:px-4 pt-4 pb-16 font-realacademy`}>
      <h1 className="text-2xl font-bold mb-8 text-center">Estadísticas Globales de Jugadores</h1>

      {/* Pies: Edades / Categorías / Posiciones / Estado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        {tarjetasPie.map(({ label, data }, idx) => {
          const total = Object.values(data || {}).reduce((a, b) => a + (Number(b) || 0), 0);
          return (
            <div key={idx} className={`p-4 rounded-lg shadow ${tarjetaClase}`}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-base sm:text-lg">{label}</h2>
                <span className="text-xs sm:text-sm opacity-80">Total: {total}</span>
              </div>
              <div className="relative h-[240px] sm:h-[280px]">
                <Pie
                  data={generatePieData(data)}
                  options={{
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                          color: darkMode ? 'white' : '#1d0b0b',
                          font: { size: 10 },
                          padding: 12,
                          boxHeight: 8,
                        }
                      },
                      pieValueInside: {
                        font: '12px sans-serif',
                        color: darkMode ? '#fff' : '#111'
                      }
                    }
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Barras por grupos de métricas */}
      {Object.entries(sumasPorGrupo).map(([grupoNombre, datos], idx) => (
        <div key={idx} className={`p-6 rounded-lg shadow mb-10 ${tarjetaClase}`}>
          <h2 className="font-semibold mb-4 text-lg text-center">{grupoNombre.toUpperCase()}</h2>
          <div className="relative" style={{ height: '400px' }}>
            <Bar
              data={crearDatosBar(datos)}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { labels: { color: darkMode ? 'white' : '#1d0b0b' } }
                },
                scales: {
                  x: { ticks: { color: darkMode ? 'white' : '#1d0b0b' } },
                  y: { ticks: { color: darkMode ? 'white' : '#1d0b0b' } }
                }
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
