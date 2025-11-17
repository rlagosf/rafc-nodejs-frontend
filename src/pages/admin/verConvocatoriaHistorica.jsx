// src/pages/admin/verConvocacionHistorica.jsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { useTheme } from '../../context/ThemeContext';
import api, { getToken, clearToken } from '../../services/api';
import IsLoading from '../../components/isLoading';
import { FileText } from 'lucide-react';
import { useMobileAutoScrollTop } from '../../hooks/useMobileScrollTop';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const toArray = (resp) => {
  const d = resp?.data ?? resp ?? [];
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.items)) return d.items;
  if (Array.isArray(d?.results)) return d.results;
  if (d?.ok && Array.isArray(d.items)) return d.items;
  if (d?.ok && Array.isArray(d.data)) return d.data;
  return [];
};

const getEventoId = (ev) => {
  if (ev == null) return null;
  const cand = ev.id ?? ev.evento_id ?? ev.eventId ?? ev.eventoId;
  const n = Number(cand);
  return Number.isFinite(n) ? n : null;
};

const FUCHSIA = [232, 45, 137]; // #e82d89
let _logoDataURL = null;
const loadLogoDataURL = async () => {
  if (_logoDataURL) return _logoDataURL;
  const candidates = ['/LOGO_SIN_FONDO_ROSA.png', '/assets/LOGO_SIN_FONDO_ROSA.png'];
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const blob = await res.blob();
      const reader = new FileReader();
      const p = new Promise((resolve) => { reader.onload = () => resolve(reader.result); });
      reader.readAsDataURL(blob);
      _logoDataURL = await p;
      if (typeof _logoDataURL === 'string') return _logoDataURL;
    } catch {}
  }
  return null;
};

/* ==================== Normalización & helpers ==================== */
const normalizeRut = (raw) => {
  if (raw == null) return { full: '', num: '' };
  const s = String(raw).toUpperCase().replace(/[^0-9K]/g, ''); // quita puntos/guion/espacios
  if (!s) return { full: '', num: '' };
  const body = s; // ya está normalizado
  const num = body.replace(/K$/, '').replace(/^0+/, '');
  return { full: body, num };
};

const isNonEmptyStr = (s) => typeof s === 'string' && s.trim().length > 0;
const coalesceStr = (...vals) => vals.find(isNonEmptyStr) || '';

const nombreDesdeJugador = (j) => coalesceStr(
  j?.nombre_jugador, // ← prioridad: nombre_jugador (tu endpoint)
  j?.nombre_completo,
  j?.full_name,
  [j?.nombres, j?.apellidos].filter(isNonEmptyStr).join(' ').trim(),
  [j?.primer_nombre, j?.segundo_nombre, j?.apellido_paterno, j?.apellido_materno].filter(isNonEmptyStr).join(' ').trim(),
  j?.nombre,
  j?.display_name,
);

const nombreDesdeConvocado = (c) => coalesceStr(
  c?.nombre_jugador,  // por si convocatorias ya trae el nombre
  c?.jugador_nombre,
  c?.nombre,
  c?.nombre_completo,
  [c?.nombres, c?.apellidos].filter(isNonEmptyStr).join(' ').trim(),
  [c?.primer_nombre, c?.apellido_paterno, c?.apellido_materno].filter(isNonEmptyStr).join(' ').trim(),
  nombreDesdeJugador(c?.jugador),
  nombreDesdeJugador(c?.persona),
);
/* ================================================================ */

export default function VerConvocacionHistorica() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [historicos, setHistoricos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState({ open: false, evento: null, jugadores: [] });
  const generatingRef = useRef(false);

  // Mapas de cruce
  const mapByFullRutRef = useRef(new Map()); // '12345678K' -> nombre
  const mapByNumRutRef  = useRef(new Map()); // '12345678'   -> nombre
  const mapByIdRef      = useRef(new Map()); // jugador_id   -> nombre (si existe)

  // Breadcrumb
  useEffect(() => {
    const currentPath = '/admin/ver-convocaciones-historicas';
    const bc = Array.isArray(location.state?.breadcrumb) ? location.state.breadcrumb : [];
    const last = bc[bc.length - 1];
    if (!last || last.label !== 'Histórico de Convocatorias') {
      navigate(currentPath, {
        replace: true,
        state: { ...(location.state || {}), breadcrumb: [{ label: 'Histórico de Convocatorias', to: currentPath }] },
      });
    }
  }, [location.pathname, navigate]);

  useMobileAutoScrollTop();


  // Auth
  useEffect(() => {
    try {
      const token = getToken();
      if (!token) throw new Error('no-token');
      const decoded = jwtDecode(token);
      const now = Math.floor(Date.now() / 1000);
      if (decoded?.exp && decoded.exp < now) throw new Error('expired');
      const rawRol = decoded?.rol_id ?? decoded?.role_id ?? decoded?.role;
      const rol = Number.isFinite(Number(rawRol)) ? Number(rawRol) : 0;
      if (![1, 2].includes(rol)) navigate('/admin', { replace: true });
    } catch {
      clearToken();
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  // Carga eventos + históricos
  useEffect(() => {
    const abort = new AbortController();
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const [evRes, hRes] = await Promise.all([
          api.get('/eventos', { signal: abort.signal }),
          api.get('/convocatorias-historico', { signal: abort.signal }),
        ]);
        if (abort.signal.aborted) return;
        setEventos(toArray(evRes));
        setHistoricos(toArray(hRes));
      } catch (err) {
        if (abort.signal.aborted) return;
        const st = err?.response?.status;
        if (st === 401 || st === 403) {
          clearToken();
          navigate('/login', { replace: true });
          return;
        }
        setError('No se pudo cargar la información');
      } finally {
        if (!abort.signal.aborted) setIsLoading(false);
      }
    })();
    return () => abort.abort();
  }, [navigate]);

  // Precarga jugadores -> arma mapas por RUT (normalizado) e ID si existe
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const resp = await api.get('/jugadores');
        const jugadores = toArray(resp);

        const byFull = new Map();
        const byNum  = new Map();
        const byId   = new Map();

        for (const j of jugadores) {
          // ← usa rut_jugador como principal
          const rutRaw =
            j?.rut_jugador ?? j?.rut ?? j?.jugador_rut ?? j?.RUT ?? j?.id_rut ?? j?.documento ?? '';
          const { full, num } = normalizeRut(rutRaw);

          const nombre = nombreDesdeJugador(j); // prioriza nombre_jugador
          if (isNonEmptyStr(nombre)) {
            if (full) byFull.set(full, nombre);
            if (num)  byNum.set(num, nombre);
          }

          const jid = j?.id_jugador ?? j?.jugador_id ?? j?.id;
          if (jid != null && isNonEmptyStr(nombre)) {
            byId.set(String(jid), nombre);
          }
        }

        if (!cancel) {
          mapByFullRutRef.current = byFull;
          mapByNumRutRef.current  = byNum;
          mapByIdRef.current      = byId;
        }
      } catch {
        // si falla, seguimos; se intentará inline/otras variantes
      }
    })();
    return () => { cancel = true; };
  }, []);

  // Último histórico (conservado por si lo necesitas)
  const lastByEvento = (() => {
    const map = new Map();
    for (const h of historicos) {
      const key = Number(h.evento_id);
      const prev = map.get(key);
      if (!prev) map.set(key, h);
      else {
        const prevDate = new Date(prev.fecha_generacion || 0).getTime();
        const curDate  = new Date(h.fecha_generacion || 0).getTime();
        if (curDate > prevDate || (curDate === prevDate && Number(h.id) > Number(prev.id))) map.set(key, h);
      }
    }
    return map;
  })();

  const fondoClase   = darkMode ? 'bg-[#111827] text-white' : 'bg-white text-[#1d0b0b]';
  const tablaCabecera= darkMode ? 'bg-[#1f2937] text-white' : 'bg-gray-100 text-[#1d0b0b]';
  const filaHover    = darkMode ? 'hover:bg-[#1f2937]' : 'hover:bg-gray-100';
  const tarjetaClase = darkMode
    ? 'bg-[#1f2937] shadow-lg rounded-lg p-4 border border-gray-700'
    : 'bg-white shadow-md rounded-lg p-4 border border-gray-200';

  const nombreEvento = (e) => e?.titulo ?? e?.nombre ?? `Evento #${e?.id ?? '—'}`;
  const fechaEvento  = (e) => String(e?.fecha_inicio ?? e?.fecha ?? '').slice(0, 10) || '—';

  const ordenarConvocados = (lista) => {
    const arr = Array.isArray(lista) ? [...lista] : [];
    arr.sort((a, b) => {
      const fa = new Date(a.fecha_partido || a.fecha || 0).getTime();
      const fb = new Date(b.fecha_partido || b.fecha || 0).getTime();
      if (fa !== fb) return fa - fb;
      return String(a.jugador_rut ?? a.rut ?? '').localeCompare(String(b.jugador_rut ?? b.rut ?? ''));
    });
    return arr;
  };

  // Resolver nombre con todas las variantes: inline, por ID, por RUT (full y num)
  const resolverNombre = (c) => {
    // 1) Inline desde la fila (por si convocatorias ya trae nombre)
    const inline = nombreDesdeConvocado(c);
    if (isNonEmptyStr(inline)) return inline;

    // 2) Por ID (si convocatorias trae id de jugador)
    const jid = c?.jugador_id ?? c?.id_jugador ?? c?.idJugador;
    if (jid != null) {
      const byId = mapByIdRef.current.get(String(jid));
      if (isNonEmptyStr(byId)) return byId;
    }

    // 3) Por RUT normalizado (convocatorias puede traer varias claves)
    const rutRaw =
      c?.rut_jugador ?? c?.jugador_rut ?? c?.rut ?? c?.RUT ??
      c?.jugador?.rut_jugador ?? c?.jugador?.rut ?? '';
    const { full, num } = normalizeRut(rutRaw);

    const byFull = full ? mapByFullRutRef.current.get(full) : '';
    if (isNonEmptyStr(byFull)) return byFull;

    const byNum  = num ? mapByNumRutRef.current.get(num) : '';
    if (isNonEmptyStr(byNum)) return byNum;

    return ''; // sin nombre, pero no se rompe la UI
  };

  /* ======================== PDF RAFC ======================== */
  const exportarPDFDesdeDatos = async (evento, jugadores) => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const now = new Date();
    const pad2 = (n) => String(n).padStart(2, '0');
    const folio = [
      now.getFullYear(), pad2(now.getMonth() + 1), pad2(now.getDate()),
      pad2(now.getHours()), pad2(now.getMinutes()), pad2(now.getSeconds()),
    ].join('') + '-' + (getEventoId(evento) ?? '0');

    try {
      const logo = await loadLogoDataURL();
      if (logo) doc.addImage(logo, 'PNG', 10, 6, 26, 16);
    } catch {}
    const titulo = `Convocados — ${nombreEvento(evento)} (${fechaEvento(evento)})`;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text(titulo, pageW / 2, 16, { align: 'center' });

    autoTable(doc, {
      head: [['RUT', 'Nombre', 'Fecha', 'Asiste', 'Titular', 'Obs']],
      body: ordenarConvocados(jugadores).map((c) => [
        c.jugador_rut ?? c.rut ?? c.rut_jugador ?? '',
        resolverNombre(c),
        String(c.fecha_partido ?? c.fecha ?? '').slice(0, 10),
        c.asistio ? 'Sí' : 'No',
        c.titular ? 'Sí' : 'No',
        c.observaciones ?? '',
      ]),
      startY: 28,
      styles: { fontSize: 8, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.2 },
      headStyles: { halign: 'center', fillColor: FUCHSIA, textColor: [255, 255, 255], fontSize: 9 },
      columnStyles: {
        0: { halign: 'center' }, // RUT
        1: { },                   // Nombre
        2: { halign: 'center' },  // Fecha
        3: { halign: 'center' },  // Asiste
        4: { halign: 'center' },  // Titular
        5: { cellWidth: 'wrap' }, // Obs
      },
      didDrawPage: (data) => {
        const y = pageH - 10;
        doc.setFontSize(9);
        doc.setTextColor(90, 90, 90);
        doc.text(
          `Creado por Real Academy FC - APP  •  Folio: ${folio}  •  Página ${data.pageNumber}`,
          pageW / 2,
          y,
          { align: 'center' }
        );
      },
    });

    const blob = doc.output('blob');
    const url  = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      const a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  /* ========================================================= */

  const verPDFPorEvento = async (eventoLike) => {
    if (generatingRef.current) return;
    generatingRef.current = true;
    try {
      const eid = getEventoId(eventoLike);
      if (eid == null) { alert('No se pudo identificar el evento: ID inválido'); return; }
      const res = await api.get(`/convocatorias/evento/${eid}`);
      const lista = toArray(res);
      if (!Array.isArray(lista) || lista.length === 0) { alert('Sin registros de convocatorias para exportar.'); return; }
      await exportarPDFDesdeDatos(eventoLike, lista);
    } catch (err) {
      const st = err?.response?.status;
      if (st === 401 || st === 403) { clearToken(); navigate('/login', { replace: true }); return; }
      alert('No se pudo obtener el listado desde las convocatorias.');
    } finally {
      generatingRef.current = false;
    }
  };

  const verConvocados = async (evento) => {
    try {
      const res = await api.get(`/convocatorias/evento/${evento.id}`);
      const lista = toArray(res);
      setModal({ open: true, evento, jugadores: lista });
    } catch (e) {
      const st = e?.response?.status;
      if (st === 401 || st === 403) { clearToken(); navigate('/login', { replace: true }); return; }
      alert('No fue posible cargar los convocados.');
    }
  };

  if (isLoading) return <IsLoading />;

  return (
    <div className={`${fondoClase} px-2 sm:px-4 pt-4 pb-16 font-realacademy`}>
      {error && <p className="text-red-500 mb-4 text-center">{error}</p>}

      <h2 className="text-2xl font-bold mb-6 text-center">Eventos y Convocatorias</h2>

      <div className={`${tarjetaClase}`}>
        <div className="w-full overflow-x-auto">
          {eventos.length === 0 ? (
            <p className="text-center text-gray-400 py-4">No hay eventos registrados.</p>
          ) : (
            <table className="w-full text-xs sm:text-sm table-fixed sm:table-auto">
              <thead className={`${tablaCabecera} text-[10px] sm:text-xs`}>
                <tr>
                  <th className="p-2 border text-center w-16">ID</th>
                  <th className="p-2 border text-center w-64">Evento</th>
                  <th className="p-2 border text-center w-32">Fecha</th>
                  <th className="p-2 border text-center w-24">Listado</th>
                  <th className="p-2 border text-center w-28">Convocados</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((e, idx) => (
                  <tr key={e.id ?? `ev-${idx}`} className={filaHover}>
                    <td className="p-2 border text-center">{e.id}</td>
                    <td className="p-2 border text-center">{nombreEvento(e)}</td>
                    <td className="p-2 border text-center">{fechaEvento(e)}</td>
                    <td className="p-2 border text-center">
                      <button
                        onClick={() => verPDFPorEvento(e)}
                        className="hover:opacity-80"
                        title="Exportar listado (PDF en vivo)"
                        aria-label={`Exportar listado evento ${e.id}`}
                      >
                        <FileText size={24} color="#D32F2F" />
                      </button>
                    </td>
                    <td className="p-2 border text-center">
                      <button
                        onClick={() => verConvocados(e)}
                        className="px-3 py-1 rounded bg-[#e82d89] text-white hover:bg-pink-700"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal convocados */}
      {modal.open && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
          <div className={`${darkMode ? 'bg-[#1f2937] text-white' : 'bg-white'} w-[95%] max-w-3xl rounded-lg p-6 shadow-lg`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">
                Convocados — {nombreEvento(modal.evento)} ({fechaEvento(modal.evento)})
              </h3>
              <button
                onClick={() => setModal({ open: false, evento: null, jugadores: [] })}
                className="px-3 py-1 rounded border"
              >
                Cerrar
              </button>
            </div>
            {modal.jugadores.length === 0 ? (
              <p className="text-center opacity-70">Sin registros de convocatorias para este evento.</p>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-[11px] sm:text-[12px]">
                  <thead className={`${tablaCabecera}`}>
                    <tr>
                      <th className="px-2 py-1 border text-center">RUT</th>
                      <th className="px-2 py-1 border text-center">Nombre</th>
                      <th className="px-2 py-1 border text-center">Fecha</th>
                      <th className="px-2 py-1 border text-center">Asiste</th>
                      <th className="px-2 py-1 border text-center">Titular</th>
                      <th className="px-2 py-1 border text-center">Obs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenarConvocados(modal.jugadores).map((c) => {
                      const nombre = resolverNombre(c);
                      return (
                        <tr key={c.id ?? `${c.jugador_rut ?? c.rut ?? c.rut_jugador}-${c.fecha_partido}`}>
                          <td className="px-2 py-1 border text-center">{c.jugador_rut ?? c.rut ?? c.rut_jugador ?? ''}</td>
                          <td className="px-2 py-1 border text-center">{nombre}</td>
                          <td className="px-2 py-1 border text-center">{String(c.fecha_partido ?? c.fecha ?? '').slice(0, 10)}</td>
                          <td className="px-2 py-1 border text-center">{c.asistio ? 'Sí' : 'No'}</td>
                          <td className="px-2 py-1 border text-center">{c.titular ? 'Sí' : 'No'}</td>
                          <td className="px-2 py-1 border text-center">{c.observaciones ?? ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
