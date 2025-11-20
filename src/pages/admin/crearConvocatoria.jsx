import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { useTheme } from "../../context/ThemeContext";
import api, { getToken, clearToken } from "../../services/api";
import IsLoading from "../../components/isLoading";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useMobileAutoScrollTop } from "../../hooks/useMobileScrollTop";

// ---------- Helpers ----------
const toArray = (resp) => {
  const d = resp?.data ?? resp ?? [];
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.items)) return d.items;
  if (Array.isArray(d?.results)) return d.results;
  if (d?.ok && Array.isArray(d.items)) return d.items;
  if (d?.ok && Array.isArray(d.data)) return d.data;
  return [];
};

const getList = async (basePath, signal) => {
  const urls = basePath.endsWith("/")
    ? [basePath, basePath.slice(0, -1)]
    : [basePath, `${basePath}/`];

  for (const url of urls) {
    try {
      const r = await api.get(url, { signal });
      return toArray(r);
    } catch (e) {
      if (e?.name === "CanceledError") return [];
      const st = e?.response?.status;
      if (st === 401 || st === 403) throw e;
    }
  }
  return [];
};

const jugadorKey = (j, idx) =>
  String(j?.rut_jugador ?? j?.rut ?? j?.rutJugador ?? j?.id ?? `tmp-${idx}`);

const dateOnly = (d) => {
  const x = new Date(d);
  if (isNaN(x.getTime())) return null;
  return new Date(x.getFullYear(), x.getMonth(), x.getDate());
};

// ---------- componente ----------
export default function CrearConvocatorias() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();

  const [jugadoresRaw, setJugadoresRaw] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [convocatorias, setConvocatorias] = useState({});
  const [error, setError] = useState("");
  const [mostrarModal, setMostrarModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ---------- Auth ----------
  useEffect(() => {
    try {
      const token = getToken();
      if (!token) throw new Error("no-token");

      const decoded = jwtDecode(token);
      const now = Math.floor(Date.now() / 1000);
      if (decoded?.exp && decoded.exp < now) throw new Error("expired");

      const rol = Number(decoded?.rol_id ?? decoded?.role_id ?? decoded?.role);
      if (![1, 2].includes(rol)) throw new Error("no-role");
    } catch {
      clearToken();
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  useMobileAutoScrollTop();

  // ---------- Load ----------
  useEffect(() => {
    const abort = new AbortController();

    (async () => {
      setIsLoading(true);
      setError("");

      try {
        const [js, es, cs] = await Promise.all([
          getList("/jugadores", abort.signal),
          getList("/eventos", abort.signal),
          getList("/categorias", abort.signal),
        ]);

        const init = {};
        js.forEach((j, idx) => {
          init[jugadorKey(j, idx)] = {
            fecha_partido: "",
            evento_id: "",
            asistio: false,
            titular: false,
            observaciones: "",
          };
        });

        setJugadoresRaw(js);
        setEventos(es);
        setCategorias(cs);
        setConvocatorias(init);
      } catch {
        if (!abort.signal.aborted) setError("❌ Error al cargar datos");
      } finally {
        if (!abort.signal.aborted) setIsLoading(false);
      }
    })();

    return () => abort.abort();
  }, [navigate]);

  // ---------- Mappers ----------
  const catMap = useMemo(
    () => new Map(categorias.map((c) => [Number(c.id), c.nombre])),
    [categorias]
  );

  const jugadores = useMemo(() => {
    return jugadoresRaw.map((j, idx) => {
      const key = jugadorKey(j, idx);
      const categoriaNombre =
        j?.categoria?.nombre ||
        catMap.get(Number(j?.categoria_id)) ||
        "Sin categoría";

      const nombre =
        j?.nombre_jugador ??
        j?.nombre_completo ??
        (j?.nombres && j?.apellidos ? `${j.nombres} ${j.apellidos}` : j?.nombre) ??
        "—";

      return {
        _key: key,
        rut_jugador: Number(j?.rut_jugador ?? j?.rut ?? j?.id ?? 0),
        nombre_jugador: nombre,
        categoriaNombre,
      };
    });
  }, [jugadoresRaw, catMap]);

  // ---------- Eventos futuros ----------
  const today = dateOnly(new Date());

  const eventosFuturos = useMemo(() => {
    return eventos.filter((e) => {
      const d = dateOnly(e?.fecha_inicio ?? e?.fecha);
      return d && d >= today;
    });
  }, [eventos, today]);

  const fechasDisponibles = useMemo(
    () =>
      Array.from(
        new Set(eventosFuturos.map((e) => String(e?.fecha_inicio ?? e?.fecha).slice(0, 10)))
      ).sort(),
    [eventosFuturos]
  );

  // ---------- Handlers ----------
  const handleFechaChange = (key, fecha) => {
    const ev = eventosFuturos.find(
      (e) => String(e?.fecha_inicio ?? e?.fecha).slice(0, 10) === fecha
    );

    setConvocatorias((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        fecha_partido: fecha,
        evento_id: ev ? String(ev.id) : prev[key]?.evento_id,
      },
    }));
  };

  const handleEventoChange = (key, eventoId) => {
    const ev = eventosFuturos.find((e) => Number(e.id) === Number(eventoId));

    setConvocatorias((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        evento_id: eventoId,
        fecha_partido: ev
          ? String(ev.fecha_inicio).slice(0, 10)
          : prev[key]?.fecha_partido,
      },
    }));
  };

  const handleAsistencia = (key, checked) => {
    setConvocatorias((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        asistio: checked,
        titular: checked,
      },
    }));
  };

  const handleObservaciones = (key, text) => {
    setConvocatorias((prev) => ({
      ...prev,
      [key]: { ...prev[key], observaciones: text },
    }));
  };

  // ---------- Guardar ----------
  const guardarConvocatorias = async () => {
    setError("");

    try {
      const datosEnviar = jugadores
        .map((j) => {
          const d = convocatorias[j._key];
          if (!d.fecha_partido || !d.evento_id) return null;
          return {
            jugador_rut: j.rut_jugador,
            fecha_partido: d.fecha_partido,
            evento_id: Number(d.evento_id),
            asistio: d.asistio,
            titular: d.titular,
            observaciones: d.observaciones || null,
          };
        })
        .filter(Boolean);

      if (!datosEnviar.length)
        return setError("⚠️ Debe seleccionar al menos un evento.");

      if (!datosEnviar.some((d) => d.asistio))
        return setError("⚠️ Marque asistencia de al menos 1 jugador.");

      await api.post("/convocatorias/", datosEnviar);
      setMostrarModal(true);
    } catch {
      setError("❌ Error al guardar convocatorias");
    }
  };

  // ---------- PDF + Histórico ----------
  const generarListado = async () => {
    try {
      const convocados = jugadores
        .map((j) => {
          const d = convocatorias[j._key];
          if (!(d.asistio && d.evento_id)) return null;

          return {
            ...d,
            nombre: j.nombre_jugador,
            categoria: j.categoriaNombre,
            jugador_rut: j.rut_jugador,
          };
        })
        .filter(Boolean);

      if (!convocados.length)
        return alert("⚠️ No hay jugadores asistentes.");

      // PDF
      const doc = new jsPDF({
        unit: "mm",
        format: [330, 216],
        orientation: "landscape",
        compress: true,
      });

      autoTable(doc, {
        head: [["Jugador", "Categoría", "Rol", "Observaciones"]],
        body: convocados.map((c) => [
          c.nombre,
          c.categoria,
          "Titular",
          c.observaciones || "",
        ]),
      });

      const base64 = doc.output("datauristring").split(",")[1];

      await api.post("/convocatorias-historico", {
        evento_id: Number(convocados[0].evento_id),
        fecha_generacion: new Date().toISOString(),
        listado_base64: base64,
      });

      // reset
      const init = {};
      jugadores.forEach((j, idx) => {
        init[jugadorKey(j, idx)] = {
          fecha_partido: "",
          evento_id: "",
          asistio: false,
          titular: false,
          observaciones: "",
        };
      });
      setConvocatorias(init);

      setMostrarModal(false);
      alert("Listado generado y guardado en el histórico.");
    } catch {
      alert("❌ Error al generar el PDF");
    }
  };

  // ---------- UI ----------
  const fondoClase = darkMode ? "bg-[#111827] text-white" : "bg-white text-[#1d0b0b]";
  const tablaCabecera = darkMode ? "bg-[#1f2937] text-white" : "bg-gray-100 text-[#1d0b0b]";
  const filaHover = darkMode ? "hover:bg-[#1f2937]" : "hover:bg-gray-100";
  const tarjetaClase = darkMode
    ? "bg-[#1f2937] shadow-lg rounded-lg p-4 border border-gray-700"
    : "bg-white shadow-md rounded-lg p-4 border border-gray-200";
  const inputClase = darkMode
    ? "bg-[#374151] text-white border border-gray-600"
    : "bg-gray-50 text-black border border-gray-300";

  // ---------- Agrupar ----------
  const grupos = useMemo(() => {
    const m = new Map();
    jugadores.forEach((j) => {
      if (!m.has(j.categoriaNombre)) m.set(j.categoriaNombre, []);
      m.get(j.categoriaNombre).push(j);
    });
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [jugadores]);

  // ---------- Render ----------
  if (isLoading) return <IsLoading />;

  return (
    <div className={`${fondoClase} px-2 sm:px-4 pt-4 pb-16 font-realacademy`}>

      <h2 className="text-2xl font-bold mb-6 text-center">
        Registro de Convocatorias
      </h2>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      <div className="space-y-6">
        {grupos.map(([categoria, lista]) => (
          <div key={categoria} className={tarjetaClase}>

            <h3 className="text-xl font-semibold mb-3 text-center">
              Categoría {categoria}
            </h3>

            <div className="w-full overflow-x-auto">
              <table className="w-full text-xs sm:text-sm table-fixed">
                <thead className={`${tablaCabecera} text-[10px] sm:text-xs`}>
                  <tr>
                    <th className="p-2 border text-center w-40">Nombre Jugador</th>
                    <th className="p-2 border text-center w-36">Categoría</th>
                    <th className="p-2 border text-center w-36">Fecha Partido</th>
                    <th className="p-2 border text-center w-44">Torneo</th>
                    <th className="p-2 border text-center w-20">Asistencia</th>
                    <th className="p-2 border text-center w-64">Observaciones</th>
                  </tr>
                </thead>

                <tbody>
                  {lista.map((j) => {
                    const row = convocatorias[j._key];

                    return (
                      <tr key={j._key} className={filaHover}>
                        <td className="p-2 border text-center">{j.nombre_jugador}</td>

                        <td className="p-2 border text-center">{j.categoriaNombre}</td>

                        <td className="p-2 border text-center">
                          <select
                            className={`w-full p-1 rounded ${inputClase}`}
                            value={row.fecha_partido}
                            onChange={(e) => handleFechaChange(j._key, e.target.value)}
                          >
                            <option value="">Seleccionar fecha</option>
                            {fechasDisponibles.map((f) => (
                              <option key={f} value={f}>
                                {f}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="p-2 border text-center">
                          <select
                            className={`w-full p-1 rounded ${inputClase}`}
                            value={row.evento_id}
                            onChange={(e) => handleEventoChange(j._key, e.target.value)}
                          >
                            <option value="">Seleccionar torneo</option>
                            {eventosFuturos.map((ev) => (
                              <option key={ev.id} value={ev.id}>
                                {ev.titulo ?? ev.nombre ?? `Evento #${ev.id}`}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="p-2 border text-center">
                          <input
                            type="checkbox"
                            checked={row.asistio}
                            onChange={(e) => handleAsistencia(j._key, e.target.checked)}
                          />
                        </td>

                        <td className="p-2 border text-center">
                          <input
                            type="text"
                            className={`w-full p-1 rounded ${inputClase}`}
                            value={row.observaciones}
                            placeholder="Observaciones"
                            onChange={(e) => handleObservaciones(j._key, e.target.value)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>
        ))}
      </div>

      <div className="text-center mt-6">
        <button
          onClick={guardarConvocatorias}
          className="bg-[#e82d89] text-white px-8 py-2 rounded-xl shadow hover:bg-pink-700"
        >
          Guardar
        </button>
      </div>

      {mostrarModal && (
        <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50">
          <div
            className={`${
              darkMode ? "bg-[#1f2937] text-white" : "bg-white"
            } p-6 rounded-lg shadow-lg text-center`}
          >
            <h2 className="text-xl font-bold mb-4">✅ Convocatoria creada</h2>

            <button
              className="bg-red-600 text-white px-6 py-2 rounded"
              onClick={generarListado}
            >
              Aceptar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
