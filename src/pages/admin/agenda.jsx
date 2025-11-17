// pages/admin/agenda.jsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import IsLoading from '../../components/isLoading';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addDays } from 'date-fns';
import esES from 'date-fns/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const TOKEN_KEY = 'rafc_token';
const THEME = '#e82d89';

const locales = { es: esES };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

const toDateSafe = (v) => {
  const d = new Date(v);
  return isNaN(d) ? null : d;
};

// Normaliza a 'YYYY-MM-DD HH:MM:SS' (coincide con backend)
const toSQLDateTime = (dateObj) => {
  if (!(dateObj instanceof Date) || isNaN(dateObj)) return null;
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = dateObj.getFullYear();
  const mm = pad(dateObj.getMonth() + 1);
  const dd = pad(dateObj.getDate());
  const HH = pad(dateObj.getHours());
  const MM = pad(dateObj.getMinutes());
  const SS = pad(dateObj.getSeconds());
  return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}`;
};

const getList = async (path, signal) => {
  const variants = path.endsWith('/') ? [path, path.slice(0, -1)] : [path, `${path}/`];
  for (const url of variants) {
    try {
      const r = await api.get(url, { signal });
      const d = r?.data;
      if (Array.isArray(d)) return d;
      if (Array.isArray(d?.items)) return d.items;
      if (Array.isArray(d?.results)) return d.results;
      return [];
    } catch (e) {
      const st = e?.response?.status;
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED' || e?.message?.includes('canceled')) {
        return [];
      }
      if (st === 401 || st === 403) throw e;
    }
  }
  return [];
};

const isHoliday = (title = '') => {
  const t = String(title).toLowerCase();
  return t.includes('feriado') || t.includes('festivo');
};

export default function Agenda() {
  const navigate = useNavigate();
  const { darkMode } = useTheme();

  const [rol, setRol] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [eventos, setEventos] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [modalAbierto, setModalAbierto] = useState(false);
  const [nuevoEvento, setNuevoEvento] = useState({
    titulo: '',
    descripcion: '',
    fecha_inicio: new Date(),
    fecha_fin: new Date(),
  });
  const [eventoSel, setEventoSel] = useState(null);
  const [modalDetalle, setModalDetalle] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const eventPropGetter = (event) => {
    const base = isHoliday(event.title) ? THEME : (darkMode ? '#3b82f6' : '#10b981');
    return {
      style: {
        backgroundColor: base,
        borderRadius: 999,
        color: 'white',
        fontSize: '0.82rem',
        padding: '3px 10px',
        margin: '3px auto',
        width: '92%',
        height: '22px',
        lineHeight: '20px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
      },
    };
  };

  const dayPropGetter = (date) => {
    const isCurrentMonth = date.getMonth() === currentDate.getMonth();
    const style = {
      margin: '2px',
      padding: '6px 1px',
      borderRadius: '12px',
      boxSizing: 'border-box',
      minHeight: '90px',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      alignItems: 'flex-end',
      background: 'transparent',
      border: '1.4px solid ' + THEME + '22',
    };
    if (!isCurrentMonth) return { style: { ...style, opacity: 0.85, filter: 'grayscale(0.2)' } };
    return { style: { ...style, opacity: 1 } };
  };

  const Toolbar = (props) => (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
      <div className="flex items-center gap-2">
        <button
          className={'px-3 py-1 rounded-lg border ' + (darkMode ? 'border-white/30' : 'border-[#1d0b0b]/30') + ' hover:opacity-80'}
          onClick={() => props.onNavigate('PREV')}
        >
          ◀
        </button>
        <button
          className="px-4 py-1 rounded-lg text-white"
          style={{ backgroundColor: THEME }}
          onClick={() => props.onNavigate('TODAY')}
        >
          Hoy
        </button>
        <button
          className={'px-3 py-1 rounded-lg border ' + (darkMode ? 'border-white/30' : 'border-[#1d0b0b]/30') + ' hover:opacity-80'}
          onClick={() => props.onNavigate('NEXT')}
        >
          ▶
        </button>
      </div>
      <div className="text-xl sm:text-2xl font-extrabold uppercase tracking-wide text-center">
        {format(props.date, 'MMMM yyyy', { locale: esES })}
      </div>
    </div>
  );

  const calendarShell = useMemo(() => {
    return {
      wrapper: (darkMode ? 'bg-[#1f2937]' : 'bg-white') + ' p-4 rounded-xl shadow overflow-x-hidden',
      styleTag: `
        .rbc-calendar, .rbc-month-view, .rbc-time-view, .rbc-agenda-view { border: none !important; }
        .rbc-month-row, .rbc-header, .rbc-row-content { border: none !important; }
        .rbc-date-cell { position: relative; }
        .rbc-header {
          background: ${THEME};
          color: #fff;
          border-radius: 6px;
          font-weight: 700;
          padding: 6px 0;
          margin: 2px;
        }
        .rbc-header + .rbc-header { margin-left: 2px; }
        .rbc-month-view .rbc-row-bg .rbc-day-bg { border-right: 1px solid ${THEME}44 !important; }
        .rbc-month-view .rbc-month-row { border-bottom: 1px solid ${THEME}44 !important; }
        .rbc-today { background-color: ${THEME}14 !important; }
        .rbc-off-range-bg { background: transparent !important; }
        .rbc-off-range .rbc-date-cell > a { color: ${THEME}; font-weight: 800; }
        @media (max-width: 640px) {
          .rbc-month-view { min-height: 520px !important; }
          .rbc-event { font-size: 0.75rem !important; }
        }
      `,
    };
  }, [darkMode]);

  // Auth
  useEffect(() => {
    (async () => {
      try {
        let token = localStorage.getItem(TOKEN_KEY);
        let decoded = null;

        if (!token) {
          decoded = await renovarTokenSilenciosamente();
          if (!decoded) return navigate('/login', { replace: true });
        } else {
          try {
            decoded = jwtDecode(token);
          } catch (e) {
            decoded = await renovarTokenSilenciosamente();
            if (!decoded) return navigate('/login', { replace: true });
          }
          if (!decoded?.exp || decoded.exp * 1000 < Date.now()) {
            decoded = await renovarTokenSilenciosamente();
            if (!decoded) return navigate('/login', { replace: true });
          }
        }

        const rawRol = decoded?.rol_id ?? decoded?.role_id ?? decoded?.role;
        const parsed = Number(rawRol);
        setRol(Number.isFinite(parsed) ? parsed : 0);
      } catch {
        navigate('/login', { replace: true });
      }
    })();
  }, [navigate]);

  // Carga de eventos
  useEffect(() => {
    const abort = new AbortController();
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const arr = await getList('/eventos', abort.signal);
        const mapped = arr
          .map((e) => {
            const start = toDateSafe(e?.fecha_inicio ?? e?.start);
            const end = toDateSafe(e?.fecha_fin ?? e?.end);
            if (!start || !end) return null;
            return {
              id: e.id,
              title: e.titulo ?? e.title ?? ('Evento #' + e.id),
              desc: e.descripcion ?? e.desc ?? '',
              start,
              end,
              allDay:
                (e.allDay === true) ||
                (start.getHours() === 0 && end.getHours() === 0 && start.toDateString() !== end.toDateString()),
            };
          })
          .filter(Boolean);
        setEventos(mapped);
      } catch (e) {
        const st = e?.response?.status;
        if (st === 401 || st === 403) {
          navigate('/login', { replace: true });
          return;
        }
        setError('❌ Error al cargar eventos.');
      } finally {
        setIsLoading(false);
      }
    })();
    return () => abort.abort();
  }, [navigate]);

  // Acciones
  const abrirModal = (slotInfo) => {
    const clickedDate = slotInfo.start;
    const isSameMonth = clickedDate.getMonth() === currentDate.getMonth();
    if (!isSameMonth) return;
    setNuevoEvento({
      titulo: '',
      descripcion: '',
      fecha_inicio: clickedDate,
      fecha_fin: clickedDate,
    });
    setMensaje('');
    setError('');
    setModalAbierto(true);
  };

  const guardarEvento = async () => {
    setMensaje('');
    setError('');

    const inicio = new Date(nuevoEvento.fecha_inicio);
    const fin = new Date(nuevoEvento.fecha_fin);
    if (isNaN(inicio) || isNaN(fin)) {
      setError('Fechas inválidas.');
      return;
    }

    // Si son días completos 00:00 → ajusta fin al día siguiente para mostrar rango en calendario
    let finAjustado = fin;
    if (inicio.toDateString() !== fin.toDateString() && inicio.getHours() === 0 && fin.getHours() === 0) {
      finAjustado = addDays(fin, 1);
    }

    // Validación de rango
    if (finAjustado <= inicio) {
      setError('La fecha/hora de término debe ser mayor a la de inicio.');
      return;
    }

    const startSQL = toSQLDateTime(inicio);
    const endSQL = toSQLDateTime(finAjustado);
    if (!startSQL || !endSQL) {
      setError('Error formateando fechas.');
      return;
    }

    try {
      const payload = {
        titulo: (nuevoEvento.titulo || '').trim(),
        descripcion: (nuevoEvento.descripcion || '').trim() || null,
        fecha_inicio: startSQL,
        fecha_fin: endSQL,
      };
      if (!payload.titulo) {
        setError('El título es obligatorio.');
        return;
      }

      const res = await api.post('/eventos', payload);
      const creado = res?.data?.item; // backend: { ok, item }
      if (!creado) {
        setMensaje('Evento creado, pero la respuesta no incluyó el item.');
        setModalAbierto(false);
        return;
      }

      const start = toDateSafe(creado?.fecha_inicio);
      const end = toDateSafe(creado?.fecha_fin);
      if (!start || !end) {
        setMensaje('Evento creado. (No se pudo parsear fechas retornadas)');
        setModalAbierto(false);
        return;
      }

      setEventos((prev) => [
        ...prev,
        {
          id: creado.id,
          title: creado.titulo,
          desc: creado.descripcion ?? '',
          start,
          end,
          allDay:
            (start.getHours() === 0 && end.getHours() === 0 && start.toDateString() !== end.toDateString()),
        },
      ]);
      setMensaje('✅ Evento creado correctamente.');
      setModalAbierto(false);
    } catch (e) {
      const st = e?.response?.status;
      const msg = e?.response?.data?.message || e?.message || 'Error al guardar evento';
      setError(`❌ (${st || 500}) ${msg}`);
    }
  };

  const eliminarEvento = async () => {
    if (!eventoSel?.id) return;
    setError('');
    setMensaje('');
    try {
      await api.delete('/eventos/' + eventoSel.id);
      setEventos((prev) => prev.filter((e) => e.id !== eventoSel.id));
      setModalDetalle(false);
      setMensaje('✅ Evento eliminado.');
    } catch (e) {
      const st = e?.response?.status;
      const msg = e?.response?.data?.message || e?.message || 'Error al eliminar evento';
      setError(`❌ (${st || 500}) ${msg}`);
    }
  };

  if (isLoading || rol === null) return <IsLoading />;

  const fondo = darkMode ? 'bg-[#111827] text-white' : 'bg-white text-[#1d0b0b]';

  return (
    <div className={fondo + ' min-h-screen px-4 sm:px-6 pb-16 overflow-x-hidden'}>
      <h1 className="text-3xl font-bold text-center mb-3">Agenda</h1>

      {error && <p className="text-red-500 text-center mb-2">{error}</p>}
      {mensaje && <p className="text-green-600 text-center mb-2">{mensaje}</p>}

      <div className={calendarShell.wrapper}>
        <style>{calendarShell.styleTag}</style>
        <Calendar
          localizer={localizer}
          events={eventos}
          date={currentDate}
          onNavigate={setCurrentDate}
          startAccessor="start"
          endAccessor="end"
          views={['month']}
          popup={false}
          /* 🔧 Habilita selección por click incluso si hay eventos */
          selectable="ignoreEvents"
          /* 🔧 Click rápido = selección (útil en móviles y para single click) */
          longPressThreshold={1}
          /* 🔧 No bloquees ninguna selección */
          onSelecting={() => true}
          /* Selección de día/slot */
          onSelectSlot={(slotInfo) => {
            // Algunas versiones envían { action: 'doubleClick' } para doble click:
            if (slotInfo?.action === 'doubleClick') {
              abrirModal(slotInfo);
              return;
            }
            // Single-click normal:
            abrirModal(slotInfo);
          }}
          /* Doble click sobre un evento: abrimos detalle (ya lo tenías) */
          onDoubleClickEvent={(e) => { setEventoSel(e); setModalDetalle(true); }}
          dayLayoutAlgorithm="no-overlap"
          style={{ minHeight: 680, height: '100%', width: '100%' }}
          onSelectEvent={(e) => { setEventoSel(e); setModalDetalle(true); }}
          components={{
            toolbar: Toolbar,
            month: {
              dateHeader: ({ date }) => {
                const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                return (
                  <div
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 10,
                      fontWeight: 800,
                      fontSize: '0.9rem',
                      color: isCurrentMonth ? (darkMode ? '#fff' : '#000') : THEME,
                      zIndex: 1,
                      pointerEvents: 'none',
                    }}
                  >
                    {format(date, 'd')}
                  </div>
                );
              },
            },
          }}
          eventPropGetter={eventPropGetter}
          dayPropGetter={dayPropGetter}
          messages={{
            next: 'Siguiente',
            previous: 'Anterior',
            today: 'Hoy',
            month: 'Mes',
            week: 'Semana',
            day: 'Día',
            agenda: 'Agenda',
            date: 'Fecha',
            time: 'Hora',
            event: 'Evento',
            noEventsInRange: 'No hay eventos',
          }}
        />
      </div>

      {/* Modal crear */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className={(darkMode ? 'bg-[#1f2937] text-white' : 'bg-white') + ' p-6 rounded-xl shadow w-full max-w-lg border-4'}
            style={{ borderColor: THEME }}
          >
            <h3 className="text-2xl font-bold mb-4 text-center" style={{ color: THEME }}>Crear evento</h3>

            <label className="block font-semibold mb-1">Título</label>
            <input
              className={(darkMode ? 'bg-[#374151] text-white border-gray-600' : 'text-black border-gray-300') + ' w-full p-2 mb-3 border rounded'}
              value={nuevoEvento.titulo}
              onChange={(e) => setNuevoEvento({ ...nuevoEvento, titulo: e.target.value })}
            />

            <label className="block font-semibold mb-1">Descripción</label>
            <textarea
              rows={3}
              className={(darkMode ? 'bg-[#374151] text-white border-gray-600' : 'text-black border-gray-300') + ' w-full p-2 mb-3 border rounded'}
              value={nuevoEvento.descripcion}
              onChange={(e) => setNuevoEvento({ ...nuevoEvento, descripcion: e.target.value })}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Inicio</label>
                <DatePicker
                  selected={new Date(nuevoEvento.fecha_inicio)}
                  onChange={(date) => setNuevoEvento({ ...nuevoEvento, fecha_inicio: date })}
                  showTimeSelect
                  timeFormat="HH:mm"
                  timeIntervals={15}
                  dateFormat="dd-MM-yyyy HH:mm"
                  className={(darkMode ? 'bg-[#374151] text-white border-gray-600' : 'text-black border-gray-300') + ' w-full p-2 border rounded'}
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Fin</label>
                <DatePicker
                  selected={new Date(nuevoEvento.fecha_fin)}
                  onChange={(date) => setNuevoEvento({ ...nuevoEvento, fecha_fin: date })}
                  showTimeSelect
                  timeFormat="HH:mm"
                  timeIntervals={15}
                  dateFormat="dd-MM-yyyy HH:mm"
                  className={(darkMode ? 'bg-[#374151] text-white border-gray-600' : 'text-black border-gray-300') + ' w-full p-2 border rounded'}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setModalAbierto(false)} className="px-4 py-2 rounded bg-red-600 text-white">Cancelar</button>
              <button onClick={guardarEvento} className="px-4 py-2 rounded text-white" style={{ backgroundColor: THEME }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle/eliminar */}
      {modalDetalle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={(darkMode ? 'bg-[#1f2937] text-white' : 'bg-white') + ' p-6 rounded-xl shadow w-full max-w-md'}>
            <h3 className="text-lg font-bold mb-2">Detalle Evento</h3>
            <p><strong>Título:</strong> {eventoSel?.title}</p>
            <p><strong>Descripción:</strong> {eventoSel?.desc}</p>
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={eliminarEvento} className="px-4 py-2 rounded bg-red-600 text-white">Eliminar</button>
              <button onClick={() => setModalDetalle(false)} className="px-4 py-2 rounded bg-blue-600 text-white">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
