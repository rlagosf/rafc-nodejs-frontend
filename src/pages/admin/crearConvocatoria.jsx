import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { useTheme } from "../../context/ThemeContext";
import api, { getToken, clearToken } from "../../services/api";
import IsLoading from "../../components/isLoading";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ───────── helpers ─────────
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
  const candidates = basePath.endsWith("/")
    ? [basePath, basePath.slice(0, -1)]
    : [basePath, `${basePath}/`];

  let lastErr = null;
  for (const url of candidates) {
    try {
      const r = await api.get(url, { signal });
      return toArray(r);
    } catch (e) {
      lastErr = e;
      const st = e?.response?.status;
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED' || e?.message?.includes('canceled')) {
        return [];
      }
      if (st === 401 || st === 403) throw e;
    }
  }
  if (process.env.NODE_ENV !== "production") {
    console.warn("[Convocatorias] GET falló:", basePath, lastErr?.response?.data || lastErr?.message);
  }
  return [];
};

const jugadorKey = (j, idx = 0) =>
  String(j?.rut_jugador ?? j?.rut ?? j?.rutJugador ?? j?.id ?? `tmp-${idx}`);

const dateOnly = (d) => {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  return new Date(x.getFullYear(), x.getMonth(), x.getDate());
};

// Aproxima bytes desde base64
const approxBase64Bytes = (b64) => Math.floor((b64.length * 3) / 4);

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
  const [mensaje, setMensaje] = useState("");

  // Auth
  useEffect(() => {
    try {
      const token = getToken();
      if (!token) throw new Error("no-token");
      const decoded = jwtDecode(token);
      const now = Math.floor(Date.now() / 1000);
      if (decoded?.exp && decoded.exp < now) throw new Error("expired");
      const rawRol = decoded?.rol_id ?? decoded?.role_id ?? decoded?.role;
      const rol = Number.isFinite(Number(rawRol)) ? Number(rawRol) : 0;
      if (![1, 2].includes(rol)) throw new Error("no-role");
    } catch {
      clearToken();
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  // Load
  useEffect(() => {
    const abort = new AbortController();
    (async () => {
      setIsLoading(true);
      setError("");
      setMensaje("");
      try {
        const [js, es, cs] = await Promise.all([
          getList("/jugadores", abort.signal),
          getList("/eventos", abort.signal),
          getList("/categorias", abort.signal),
        ]);

        const init = {};
        js.forEach((j, idx) => {
          const key = jugadorKey(j, idx);
          init[key] = {
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
      } catch (err) {
        if (abort.signal.aborted) return;
        const st = err?.response?.status;
        if (st === 401 || st === 403) {
          clearToken();
          navigate("/login", { replace: true });
          return;
        }
        setError("❌ Error al cargar datos");
      } finally {
        if (!abort.signal.aborted) setIsLoading(false);
      }
    })();
    return () => abort.abort();
  }, [navigate]);

  // Maps y normalización
  const catMap = useMemo(
    () => new Map((categorias || []).map((c) => [Number(c?.id), String(c?.nombre ?? "")])),
    [categorias]
  );

  const jugadores = useMemo(() => {
    return (jugadoresRaw || []).map((j, idx) => {
      const key = jugadorKey(j, idx);
      const categoriaNombre =
        j?.categoria?.nombre ||
        (j?.categoria_id != null ? catMap.get(Number(j.categoria_id)) : undefined) ||
        "Sin categoría";

      const nombre =
        j?.nombre_jugador ??
        j?.nombre_completo ??
        (j?.nombres && j?.apellidos ? `${j.nombres} ${j.apellidos}` : j?.nombre) ??
        "—";

      return {
        _key: key,
        rut_jugador: Number(j?.rut_jugador ?? j?.rut ?? j?.id ?? 0) || null,
        nombre_jugador: nombre,
        categoriaNombre,
      };
    });
  }, [jugadoresRaw, catMap]);

  // Solo eventos futuros (incluye hoy)
  const today = dateOnly(new Date());
  const eventosFuturos = useMemo(() => {
    return (eventos || []).filter((e) => {
      const d = dateOnly(e?.fecha_inicio ?? e?.fecha);
      return d && d.getTime() >= today.getTime();
    });
  }, [eventos, today]);

  const fechasDisponibles = useMemo(() => {
    const set = new Set(
      (eventosFuturos || [])
        .map((e) => String(e?.fecha_inicio ?? e?.fecha ?? "").slice(0, 10))
        .filter(Boolean)
    );
    return Array.from(set).sort();
  }, [eventosFuturos]);

  // Handlers UI
  const handleEventoChange = (key, eventoIdStr) => {
    const evento = eventosFuturos.find((e) => Number(e?.id) === Number(eventoIdStr));
    setConvocatorias((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? {}),
        evento_id: String(eventoIdStr || ""),
        fecha_partido: evento?.fecha_inicio
          ? String(evento.fecha_inicio).slice(0, 10)
          : prev[key]?.fecha_partido || "",
      },
    }));
  };

  const handleFechaChange = (key, nuevaFecha) => {
    const ev = eventosFuturos.find(
      (e) => String(e?.fecha_inicio ?? e?.fecha ?? "").slice(0, 10) === nuevaFecha
    );
    setConvocatorias((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? {}),
        fecha_partido: nuevaFecha,
        evento_id: ev ? String(ev.id) : prev[key]?.evento_id || "",
      },
    }));
  };

  const handleChange = (key, campo, valor) =>
    setConvocatorias((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? {}), [campo]: valor },
    }));

  // Guardar (bulk)
  const guardarConvocatorias = async () => {
    setMensaje("");
    setError("");
    try {
      const datosEnviar = jugadores
        .map((j) => {
          const d = convocatorias[j._key] ?? {};
          if (!d.fecha_partido || !d.evento_id) return null;
          return {
            jugador_rut: Number(j.rut_jugador),
            fecha_partido: d.fecha_partido,
            evento_id: Number(d.evento_id),
            asistio: !!d.asistio,
            titular: !!d.titular,
            observaciones: d.observaciones?.trim() || null,
          };
        })
        .filter(Boolean);

      if (!datosEnviar.length) {
        setError("⚠️ Debe seleccionar al menos un evento (columna Torneo).");
        return;
      }

      if (!datosEnviar.some((d) => d.asistio)) {
        setError("⚠️ Debe marcar al menos un jugador como asistente.");
        return;
      }

      await api.post("/convocatorias/bulk", datosEnviar);

      setMostrarModal(true);
      setMensaje("✅ Convocatoria registrada.");
      setError("");
    } catch (err) {
      const st = err?.response?.status;
      if (st === 401 || st === 403) {
        clearToken();
        navigate("/login", { replace: true });
        return;
      }
      const data = err?.response?.data;
      setError(
        (Array.isArray(data?.detail) && data.detail.map((x) => x?.msg).join(" | ")) ||
          data?.detail ||
          data?.message ||
          "❌ Error al guardar convocatorias"
      );
    }
  };

  // Generar PDF + guardar histórico
  const generarListado = async () => {
    try {
      const convocados = jugadores
        .map((j) => {
          const d = convocatorias[j._key] ?? {};
          if (!(d.asistio && d.evento_id)) return null;
          return {
            ...d,
            jugador_rut: Number(j.rut_jugador),
            nombre: j.nombre_jugador || "",
            categoria: j.categoriaNombre || "",
          };
        })
        .filter(Boolean);

      if (!convocados.length) {
        alert("⚠️ No hay jugadores marcados como asistentes.");
        return;
      }

      // Folio simple (solo para display)
      let folio = "0001";
      try {
        const historico = toArray(await api.get("/convocatorias-historico"));
        const count = Array.isArray(historico) ? historico.length + 1 : 1;
        folio = String(count).padStart(4, "0");
      } catch {}

      // PDF comprimido
      const doc = new jsPDF({
        unit: "mm",
        format: [330, 216],
        orientation: "landscape",
        compress: true, // ⬅️ reduce tamaño
      });

      try {
        const logo = new Image();
        logo.src = "/logo-en-negativo.png";
        await new Promise((resolve) => {
          logo.onload = resolve;
          logo.onerror = resolve;
        });
        doc.addImage(logo, "PNG", 15, 10, 40, 25);
      } catch {}

      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor("#e82d89");
      doc.text("Listado de Convocados", 165, 24, { align: "center" });

      doc.setFontSize(12);
      doc.setTextColor("#000");
      doc.setFont("helvetica", "normal");
      doc.text(`Folio RAFC-${folio}`, 330 - 18, 24, { align: "right" });

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`Fecha evento: ${convocados[0].fecha_partido}`, 18, 42);

      autoTable(doc, {
        startY: 48,
        head: [["Jugador", "Categoría", "Rol", "Observaciones"]],
        body: convocados.map((c) => [
          c.nombre,
          c.categoria,
          c.titular ? "Titular" : "Suplente",
          c.observaciones || "",
        ]),
        styles: { fontSize: 11, halign: "center", cellPadding: 3 },
        headStyles: { fillColor: [232, 45, 137], textColor: 255, fontStyle: "bold" },
        theme: "grid",
        margin: { left: 18, right: 18 },
        didDrawPage: () => {
          const pageHeight = doc.internal.pageSize.height;
          doc.setFontSize(10);
          doc.setTextColor("#777");
          doc.setFont("helvetica", "normal");
          doc.text(
            "Documento generado automáticamente por Real Academy – Uso interno confidencial",
            279 - 18,
            pageHeight - 10,
            { align: "right" }
          );
        },
      });

      const dataUri = doc.output("datauristring");
      const base64 = dataUri.split(",")[1];

      // Guardrail: ~bytes y límite de 12MB (coincidir con backend)
      const bytes = approxBase64Bytes(base64);
      const MAX_BYTES = 12 * 1024 * 1024;
      if (bytes > MAX_BYTES) {
        alert("❌ El PDF es demasiado grande para guardar en el histórico. Intenta reducir datos.");
        return;
      }

      try {
        await api.post("/convocatorias-historico", {
          evento_id: Number(convocados[0].evento_id),
          fecha_generacion: new Date().toISOString().slice(0, 19).replace("T", " "),
          listado_base64: base64, // sin prefijo
        });
      } catch (err) {
        console.warn("No se pudo guardar en histórico:", err?.response?.data || err?.message);
      }

      alert("✅ Listado generado y guardado en el histórico.");
      setMostrarModal(false);
    } catch (e) {
      console.error(e);
      alert("❌ Error al generar o guardar el PDF.");
    }
  };

  // Tailwind helpers
  const fondoClase = darkMode ? "bg-[#111827] text-white" : "bg-white text-[#1d0b0b]";
  const tablaCabecera = darkMode ? "bg-[#1f2937] text-white" : "bg-gray-100 text-[#1d0b0b]";
  const filaHover = darkMode ? "hover:bg-[#1f2937]" : "hover:bg-gray-100";
  const tarjetaClase = darkMode
    ? "bg-[#1f2937] shadow-lg rounded-lg p-4 border border-gray-700"
    : "bg-white shadow-md rounded-lg p-4 border border-gray-200";
  const inputClase = darkMode
    ? "bg-[#374151] text-white border border-gray-600"
    : "bg-gray-50 text-black border border-gray-300";

  // Agrupación por categoría (presentación)
  const grupos = useMemo(() => {
    const m = new Map();
    for (const j of jugadores) {
      const key = j.categoriaNombre || "Sin categoría";
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(j);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b, "es"));
  }, [jugadores]);

  if (isLoading) return <IsLoading />;

  return (
    <div className={`${fondoClase} px-2 sm:px-4 pt-4 pb-16 font-realacademy`}>
      <h2 className="text-2xl font-bold mb-6 text-center">Registro de Convocatorias</h2>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      {/* Una tarjeta/tabla por categoría */}
      <div className="space-y-6">
        {grupos.map(([categoria, lista]) => (
          <div key={categoria} className={tarjetaClase}>
            <h3 className="text-xl font-semibold mb-3 text-center">Categoría {categoria}</h3>

            <div className="w-full overflow-x-auto">
              <table className="w-full text-xs sm:text-sm table-fixed sm:table-auto">
                <thead className={`${tablaCabecera} text-[10px] sm:text-xs`}>
                  <tr>
                    <th className="p-2 border text-center w-40">Nombre Jugador</th>
                    <th className="p-2 border text-center w-36">Categoría</th>
                    <th className="p-2 border text-center w-36">Fecha Partido</th>
                    <th className="p-2 border text-center w-44">Torneo</th>
                    <th className="p-2 border text-center w-20">Asistencia</th>
                    <th className="p-2 border text-center w-20">¿Titular?</th>
                    <th className="p-2 border text-center w-64">Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((j) => {
                    const row = convocatorias[j._key] ?? {};
                    return (
                      <tr key={j._key} className={filaHover}>
                        <td className="p-2 border text-center">{j.nombre_jugador}</td>
                        <td className="p-2 border text-center">{j.categoriaNombre}</td>
                        <td className="p-2 border text-center">
                          <select
                            className={`w-full p-1 rounded ${inputClase}`}
                            value={row.fecha_partido || ""}
                            onChange={(e) => handleFechaChange(j._key, e.target.value)}
                          >
                            <option value="">Seleccionar fecha</option>
                            {fechasDisponibles.map((f) => (
                              <option key={f} value={f}>{f}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2 border text-center">
                          <select
                            className={`w-full p-1 rounded ${inputClase}`}
                            value={row.evento_id || ""}
                            onChange={(e) => handleEventoChange(j._key, e.target.value)}
                          >
                            <option value="">Seleccionar torneo</option>
                            {eventosFuturos.map((ev) => (
                              <option key={ev.id} value={String(ev.id)}>
                                {ev.titulo ?? ev.nombre ?? `Evento #${ev.id}`}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2 border text-center">
                          <input
                            type="checkbox"
                            checked={!!row.asistio}
                            onChange={(e) => handleChange(j._key, "asistio", e.target.checked)}
                          />
                        </td>
                        <td className="p-2 border text-center">
                          <input
                            type="checkbox"
                            checked={!!row.titular}
                            onChange={(e) => handleChange(j._key, "titular", e.target.checked)}
                          />
                        </td>
                        <td className="p-2 border text-center">
                          <input
                            type="text"
                            className={`w-full p-1 rounded ${inputClase}`}
                            placeholder="Observaciones (opcional)"
                            value={row.observaciones || ""}
                            onChange={(e) => handleChange(j._key, "observaciones", e.target.value)}
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
        {mensaje && <p className="text-green-500 mt-4">{mensaje}</p>}
        {error && <p className="text-red-500 mt-4">{error}</p>}
      </div>

      {mostrarModal && (
        <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50">
          <div className={`${darkMode ? "bg-[#1f2937] text-white" : "bg-white"} p-6 rounded-lg shadow-lg text-center`}>
            <h2 className="text-xl font-bold mb-4">✅ Convocatoria creada</h2>
            <button className="bg-red-600 text-white px-6 py-2 rounded" onClick={generarListado}>
              Generar Listado
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
