// src/pages/apoderado/portalDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { clearToken } from "../../services/api";
import IsLoading from "../../components/isLoading";

const ACCENT = "#e82d89";

// Negocio (homologado con Admin)
const TIPO_PAGO_MENSUALIDAD = 3;

const SectionBtn = ({ active, icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      "w-full flex items-center gap-3 rounded-xl px-4 py-3 font-extrabold tracking-wide transition",
      active
        ? "bg-white shadow-sm border border-black/10 text-[#1a1a1a]"
        : "bg-transparent hover:bg-white/60 text-black/70",
    ].join(" ")}
  >
    <span
      className={[
        "inline-flex h-9 w-9 items-center justify-center rounded-xl font-black",
        active ? "bg-[#e82d89]/15 text-[#e82d89]" : "bg-black/5 text-black/60",
      ].join(" ")}
      aria-hidden
    >
      {icon}
    </span>
    <span className="text-sm">{label}</span>
  </button>
);

const Pill = ({ children }) => (
  <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold bg-black/5 text-black/70">
    {children}
  </span>
);

const fmtCLP = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);
};

const fmtDate = (v) => {
  if (!v) return "—";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split("-");
    return `${d}-${m}-${y}`;
  }
  const d = new Date(v);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    return `${dd}-${mm}-${yy}`;
  }
  return s;
};

// Normaliza estado/situación hacia "PAGADO" / "VENCIDO" / "PENDIENTE"
const normalizeSituacion = (p) => {
  const raw =
    p?.situacion ??
    p?.estado ??
    p?.estado_pago ??
    p?.situacion_pago?.nombre ??
    p?.estado_pago_nombre ??
    p?.estado_nombre ??
    p?.situacion_pago_id ??
    p?.estado_pago_id ??
    "";

  const s = String(raw).trim().toUpperCase();
  if (s === "PAGADO") return "PAGADO";
  if (s === "VENCIDO") return "VENCIDO";
  if (s === "PENDIENTE") return "PENDIENTE";

  // fallback: si viene un id o algo raro, no inventamos
  return s || "—";
};

const situacionClass = (situacion) => {
  const s = String(situacion || "").toUpperCase();
  if (s === "PAGADO") return "text-green-700";
  if (s === "VENCIDO") return "text-red-700";
  return "text-black/70";
};

export default function PortalDashboard() {
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [jugadores, setJugadores] = useState([]);

  const [selectedRut, setSelectedRut] = useState("");
  const [section, setSection] = useState("datos"); // datos | pagos | agenda | estadisticas | contrato

  const [detalle, setDetalle] = useState(null); // { jugador, estadisticas, pagos }
  const [detalleLoading, setDetalleLoading] = useState(false);

  const [error, setError] = useState("");

  const jugadorSel = useMemo(() => {
    const j = jugadores.find((x) => String(x?.rut_jugador) === String(selectedRut));
    return j || jugadores[0] || null;
  }, [jugadores, selectedRut]);

  useEffect(() => {
    if (!selectedRut && jugadores.length > 0) {
      setSelectedRut(String(jugadores[0]?.rut_jugador ?? ""));
    }
  }, [jugadores, selectedRut]);

  // Cargar lista de jugadores del apoderado
  useEffect(() => {
    const abort = new AbortController();

    (async () => {
      setIsLoading(true);
      setError("");

      const token = localStorage.getItem("rafc_token");
      if (!token) {
        navigate("/login-apoderado", { replace: true });
        return;
      }

      try {
        const { data } = await api.get("/portal-apoderado/mis-jugadores", {
          signal: abort.signal,
        });

        const arr = Array.isArray(data?.jugadores) ? data.jugadores : [];
        setJugadores(arr);
      } catch (err) {
        if (err?.code === "ERR_CANCELED" || err?.message === "canceled") return;

        const st = err?.status ?? err?.response?.status;
        const msg = err?.message || err?.response?.data?.message || "Error";

        if (st === 403) setError("Debes cambiar tu contraseña para continuar.");
        else if (st === 401) {
          clearToken();
          navigate("/login-apoderado", { replace: true });
          return;
        } else setError(msg);
      } finally {
        if (!abort.signal.aborted) setIsLoading(false);
      }
    })();

    return () => abort.abort();
  }, [navigate]);

  // Cargar resumen del jugador seleccionado (1 endpoint)
  useEffect(() => {
    if (!selectedRut) return;

    setDetalle(null);
    setDetalleLoading(true);

    const abort = new AbortController();

    (async () => {
      try {
        const { data } = await api.get(
          `/portal-apoderado/jugadores/${encodeURIComponent(selectedRut)}/resumen`,
          { signal: abort.signal }
        );

        if (data?.ok) setDetalle(data);
        else setDetalle(null);
      } catch (err) {
        if (err?.code === "ERR_CANCELED" || err?.message === "canceled") return;

        const st = err?.status ?? err?.response?.status;
        const msg = err?.message || err?.response?.data?.message || "Error";

        if (st === 403) setError("Debes cambiar tu contraseña para continuar.");
        else if (st === 401) {
          clearToken();
          navigate("/login-apoderado", { replace: true });
          return;
        } else setError(msg);
      } finally {
        if (!abort.signal.aborted) setDetalleLoading(false);
      }
    })();

    return () => abort.abort();
  }, [selectedRut, navigate]);

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout"); // si no existe, cae al catch
    } catch {
      // igual cerramos local
    } finally {
      clearToken();
      try {
        localStorage.removeItem("user_info");
        localStorage.removeItem("apoderado_must_change_password");
      } catch {}
      navigate("/", { replace: true });
    }
  };

  const goChangePassword = () => navigate("/portal-apoderado/cambiar-clave", { replace: true });

  const jugador = detalle?.jugador || null;
  const estadisticas = detalle?.estadisticas || null;

  const pagosRaw = Array.isArray(detalle?.pagos) ? detalle.pagos : [];

  // ✅ PAGOS VIEW: incluye fila virtual VENCIDO si NO hay mensualidad registrada
  const pagosView = useMemo(() => {
    const list = Array.isArray(pagosRaw) ? [...pagosRaw] : [];

    const tieneMensualidad = list.some((p) => {
      const tipoId = p?.tipo_pago?.id ?? p?.tipo_pago_id ?? p?.tipo_id ?? null;
      return String(tipoId) === String(TIPO_PAGO_MENSUALIDAD);
    });

    if (!tieneMensualidad) {
      list.unshift({
        id: "VIRTUAL-MENSUALIDAD",
        virtual: true,
        monto: 0,
        fecha_pago: null,
        tipo_pago: { id: TIPO_PAGO_MENSUALIDAD, nombre: "Mensualidad" },
        medio_pago: { id: null, nombre: "—" },
        situacion: "VENCIDO",
      });
    }

    return list;
  }, [pagosRaw]);

  const lastPago = useMemo(() => {
    // solo pagos con fecha real
    const reales = pagosRaw.filter((p) => p?.fecha_pago);
    if (reales.length === 0) return null;

    const sorted = [...reales].sort((a, b) => {
      const da = a?.fecha_pago ? new Date(a.fecha_pago).getTime() : 0;
      const db = b?.fecha_pago ? new Date(b.fecha_pago).getTime() : 0;
      return db - da;
    });
    return sorted[0] || null;
  }, [pagosRaw]);

  // Totales
  const totalAprox = useMemo(() => {
    return pagosRaw.reduce((a, p) => a + Number(p?.monto || 0), 0);
  }, [pagosRaw]);

  if (isLoading) return <IsLoading />;

  return (
    <div className="min-h-screen font-realacademy text-[#1a1a1a] bg-[#e9eaec]">
      {/* Brillo suave */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[980px] h-[980px] rounded-full blur-3xl opacity-60"
          style={{ background: "radial-gradient(circle, rgba(232,45,137,0.18), transparent 60%)" }}
        />
        <div
          className="absolute -bottom-56 right-[-180px] w-[900px] h-[900px] rounded-full blur-3xl opacity-50"
          style={{ background: "radial-gradient(circle, rgba(0,0,0,0.06), transparent 60%)" }}
        />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, rgba(0,0,0,0.08) 0px, rgba(0,0,0,0.08) 1px, transparent 1px, transparent 18px)",
          }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Topbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-widest uppercase text-[#e82d89]">
              Portal Apoderados
            </h1>
            <p className="mt-1 text-sm font-semibold text-black/60">
              Todo lo de tu jugador, sin vueltas. (La pelota al pie 😄)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goChangePassword}
              className="rounded-xl px-4 py-2 font-extrabold uppercase tracking-widest bg-white border border-black/10 hover:bg-white/70 transition text-[#1a1a1a]"
            >
              Seguridad
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl px-4 py-2 font-extrabold uppercase tracking-widest bg-[#e82d89] text-white hover:bg-[#c61f74] transition"
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        {/* Layout */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5">
          {/* Sidebar */}
          <aside className="rounded-[26px] border border-black/10 bg-[#f2f2f3] shadow-[0_20px_70px_rgba(0,0,0,0.08)] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black tracking-[0.35em] uppercase text-black/50">
                  Jugadores
                </p>
                <p className="mt-1 text-sm font-extrabold text-black/80">
                  Selecciona a quién quieres ver
                </p>
              </div>
              <Pill>{jugadores.length} asociado(s)</Pill>
            </div>

            <div className="mt-4 space-y-2">
              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 text-red-700 font-extrabold p-4">
                  ❌ {error}
                </div>
              )}

              {!error && jugadores.length === 0 && (
                <div className="rounded-2xl border border-black/10 bg-white p-4 text-black/70 font-semibold">
                  No hay jugadores asociados a este apoderado.
                </div>
              )}

              {!error && jugadores.length > 0 && (
                <div className="space-y-2">
                  {jugadores.map((j) => {
                    const rut = String(j?.rut_jugador ?? "");
                    const active = rut === String(selectedRut);
                    return (
                      <button
                        key={rut}
                        type="button"
                        onClick={() => setSelectedRut(rut)}
                        className={[
                          "w-full text-left rounded-2xl border transition p-4",
                          active
                            ? "border-[#e82d89]/40 bg-white shadow-sm"
                            : "border-black/10 bg-white/60 hover:bg-white",
                        ].join(" ")}
                      >
                        <p className="text-xs font-black tracking-[0.35em] uppercase text-black/40">
                          Jugador
                        </p>
                        <p className="mt-1 text-sm font-extrabold text-black">
                          {j?.nombre_jugador || "Sin nombre"}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-black/60">
                          RUT: <span className="font-extrabold text-black/80">{rut}</span>
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-6">
              <p className="text-xs font-black tracking-[0.35em] uppercase text-black/50 mb-3">
                Secciones
              </p>

              <div className="space-y-2">
                <SectionBtn active={section === "datos"} icon="D" label="Datos del jugador" onClick={() => setSection("datos")} />
                <SectionBtn active={section === "pagos"} icon="P" label="Pagos" onClick={() => setSection("pagos")} />
                <SectionBtn active={section === "agenda"} icon="A" label="Agenda" onClick={() => setSection("agenda")} />
                <SectionBtn active={section === "estadisticas"} icon="E" label="Estadísticas" onClick={() => setSection("estadisticas")} />
                <SectionBtn active={section === "contrato"} icon="C" label="Contrato" onClick={() => setSection("contrato")} />
              </div>
            </div>
          </aside>

          {/* Main */}
          <main className="rounded-[26px] border border-black/10 bg-[#f2f2f3] shadow-[0_20px_70px_rgba(0,0,0,0.08)] p-5 sm:p-7">
            {/* Header jugador */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black tracking-[0.35em] uppercase text-black/50">
                  Jugador seleccionado
                </p>
                <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-black">
                  {jugadorSel?.nombre_jugador || "—"}
                </h2>
                <p className="mt-1 text-sm font-semibold text-black/60">
                  RUT: <span className="font-extrabold text-black/80">{jugadorSel?.rut_jugador || "—"}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Pill>
                  Sección:{" "}
                  <span className="ml-1 font-extrabold" style={{ color: ACCENT }}>
                    {section}
                  </span>
                </Pill>

                {detalleLoading && <Pill>Cargando…</Pill>}

                {!detalleLoading && !["agenda", "estadisticas", "contrato", "datos"].includes(section) && (
                  <Pill>
                    Último pago:{" "}
                    <span className="ml-1 font-extrabold" style={{ color: ACCENT }}>
                      {lastPago ? fmtDate(lastPago.fecha_pago) : "—"}
                    </span>
                  </Pill>
                )}
              </div>
            </div>

            <div className="mt-6 border-t border-black/10 pt-6">
              {/* DATOS */}
              {section === "datos" && (
                <div className="space-y-4">
                  <h3 className="text-lg font-extrabold text-[#e82d89] uppercase tracking-widest">
                    Datos del jugador
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-black/10 bg-white p-5">
                      <p className="text-xs font-black tracking-[0.35em] uppercase text-black/40">
                        Información general
                      </p>
                      <div className="mt-3 space-y-2 text-sm font-semibold text-black/70">
                        <p>Fecha nacimiento: <span className="font-extrabold">{fmtDate(jugador?.fecha_nacimiento)}</span></p>
                        <p>Edad: <span className="font-extrabold">{jugador?.edad ?? "—"}</span></p>
                        <p>Email: <span className="font-extrabold">{jugador?.email || "—"}</span></p>
                        <p>Teléfono: <span className="font-extrabold">{jugador?.telefono || "—"}</span></p>
                        <p>Dirección: <span className="font-extrabold">{jugador?.direccion || "—"}</span></p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-black/10 bg-white p-5">
                      <p className="text-xs font-black tracking-[0.35em] uppercase text-black/40">
                        Fútbol / Academia
                      </p>
                      <div className="mt-3 space-y-2 text-sm font-semibold text-black/70">
                        <p>Categoría: <span className="font-extrabold">{jugador?.categoria?.nombre || "—"}</span></p>
                        <p>Posición: <span className="font-extrabold">{jugador?.posicion?.nombre || "—"}</span></p>
                        <p>Sucursal: <span className="font-extrabold">{jugador?.sucursal?.nombre || "—"}</span></p>
                        <p>Estado: <span className="font-extrabold">{jugador?.estado?.nombre || "—"}</span></p>
                      </div>
                    </div>

                    <div className="md:col-span-2 rounded-2xl border border-black/10 bg-white p-5">
                      <p className="text-xs font-black tracking-[0.35em] uppercase text-black/40">
                        Observaciones
                      </p>
                      <p className="mt-3 text-sm font-semibold text-black/70">
                        {jugador?.observaciones || "—"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* PAGOS */}
              {section === "pagos" && (
                <div className="space-y-4">
                  <h3 className="text-lg font-extrabold text-[#e82d89] uppercase tracking-widest">
                    Pagos
                  </h3>

                  <div className="rounded-2xl border border-black/10 bg-white p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <p className="text-sm font-semibold text-black/70">
                        Pagos registrados: <span className="font-extrabold">{pagosRaw.length}</span>
                      </p>
                      <Pill>
                        Total aprox:{" "}
                        <span className="ml-1 font-extrabold">
                          {fmtCLP(totalAprox)}
                        </span>
                      </Pill>
                    </div>

                    <div className="mt-4 overflow-auto">
                      <table className="min-w-[820px] w-full text-sm">
                        <thead>
                          <tr className="text-left text-black/60">
                            <th className="py-2 pr-4">Fecha</th>
                            <th className="py-2 pr-4">Tipo</th>
                            <th className="py-2 pr-4">Medio</th>
                            <th className="py-2 pr-4">Situación</th>
                            <th className="py-2 pr-4 text-center">Monto</th>
                            <th className="py-2 text-center">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagosView.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-4 text-black/60 font-semibold">
                                Aún no hay pagos registrados para este jugador.
                              </td>
                            </tr>
                          ) : (
                            pagosView.map((p) => {
                              const situacion = normalizeSituacion(p);

                              return (
                                <tr
                                  key={String(p?.id ?? Math.random())}
                                  className="border-t border-black/10"
                                >
                                  <td className="py-3 pr-4 font-semibold">
                                    {fmtDate(p?.fecha_pago)}
                                  </td>

                                  <td className="py-3 pr-4 font-semibold">
                                    {p?.tipo_pago?.nombre ?? p?.tipo_pago_id ?? "—"}
                                  </td>

                                  <td className="py-3 pr-4 font-semibold">
                                    {p?.medio_pago?.nombre ?? p?.medio_pago_id ?? "—"}
                                  </td>

                                  <td className={`py-3 pr-4 font-extrabold ${situacionClass(situacion)}`}>
                                    {situacion}
                                  </td>

                                  <td className="py-3 pr-4 font-extrabold text-center">
                                    {fmtCLP(p?.monto)}
                                  </td>

                                  <td className="py-3 text-center font-semibold text-black/60">
                                    —
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* AGENDA */}
              {section === "agenda" && (
                <div className="space-y-4">
                  <h3 className="text-lg font-extrabold text-[#e82d89] uppercase tracking-widest">
                    Agenda
                  </h3>
                  <div className="rounded-2xl border border-black/10 bg-white p-5">
                    <p className="text-sm font-semibold text-black/70">
                      Próximo: enganchar eventos/convocatorias del jugador (partidos/entrenamientos).
                    </p>
                  </div>
                </div>
              )}

              {/* ESTADISTICAS */}
              {section === "estadisticas" && (
                <div className="space-y-4">
                  <h3 className="text-lg font-extrabold text-[#e82d89] uppercase tracking-widest">
                    Estadísticas
                  </h3>

                  {(!estadisticas || Object.keys(estadisticas || {}).length === 0) ? (
                    <div className="rounded-2xl border border-black/10 bg-white p-5">
                      <p className="text-sm font-semibold text-black/70">
                        Aún no hay estadísticas registradas para este jugador.
                      </p>
                    </div>
                  ) : (
                    (() => {
                      // --------------------------
                      // Helpers (no inventan datos)
                      // --------------------------
                      const EXCLUDE_KEYS = new Set([
                        "id",
                        "estadistica_id",
                        "created_at",
                        "updated_at",
                      ]);

                      const LABELS = {
                        // 🏟️ Participación
                        partidos_jugador: "Partidos jugados",
                        titular_partidos: "Partidos de titular",
                        torneos_convocados: "Torneos convocados",
                        minutos_jugados: "Minutos jugados",

                        // ⚽ Ataque
                        goles: "Goles",
                        asistencias: "Asistencias",
                        tiros_arco: "Tiros al arco",
                        tiros_fuera: "Tiros fuera",
                        tiros_bloqueados: "Tiros bloqueados",
                        tiros_libres: "Tiros libres",
                        penales: "Penales",
                        offsides: "Offsides",

                        // 🎯 Creación / Pase
                        pases_clave: "Pases clave",
                        pases_completados: "Pases completados",
                        pases_errados: "Pases errados",
                        centros_acertados: "Centros acertados",
                        regates_exitosos: "Regates exitosos",
                        posesion_perdida: "Pérdidas de posesión",

                        // 🛡️ Defensa
                        intercepciones: "Intercepciones",
                        despejes: "Despejes",
                        entradas_exitosas: "Entradas exitosas",
                        bloqueos: "Bloqueos",
                        recuperaciones: "Recuperaciones",
                        duelos_ganados: "Duelos ganados",
                        duelos_aereos_ganados: "Duelos aéreos ganados",

                        // 🧾 Disciplina
                        faltas_cometidas: "Faltas cometidas",
                        faltas_recibidas: "Faltas recibidas",
                        tarjetas_amarillas: "Tarjetas amarillas",
                        tarjetas_rojas: "Tarjetas rojas",
                        sanciones_federativas: "Sanciones federativas",

                        // 💪 Físico
                        distancia_recorrida_km: "Distancia (km)",
                        sprints: "Sprints",

                        // 🏥 Disponibilidad
                        lesiones: "Lesiones",
                        dias_baja: "Días de baja",
                      };

                      const formatLabel = (k) =>
                        LABELS[k] ||
                        k
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (c) => c.toUpperCase());

                      const formatValue = (k, v) => {
                        if (v === null || v === undefined || v === "") return "—";
                        if (k === "distancia_recorrida_km") {
                          const n = Number(v);
                          return Number.isFinite(n) ? n.toFixed(1) : "—";
                        }
                        return String(v);
                      };

                      const toNumberOrNull = (k, v) => {
                        if (v === null || v === undefined || v === "") return null;
                        const n = Number(v);
                        if (!Number.isFinite(n)) return null;
                        return k === "distancia_recorrida_km" ? n : Math.trunc(n);
                      };

                      // max dinámico: 10, 20, 40, 80...
                      const dynamicMax = (value, base = 10) => {
                        const v = Number(value);
                        if (!Number.isFinite(v) || v <= 0) return base;
                        let m = base;
                        while (v > m) m *= 2;
                        return m;
                      };

                      const clampPct = (n) => Math.max(0, Math.min(100, n));

                      // --------------------------
                      // Colores vivos por categoría + variaciones por stat
                      // --------------------------
                      const CATEGORY_COLOR = {
                        participacion: ["#3B82F6", "#60A5FA"], // azul
                        ataque: ["#22C55E", "#86EFAC"], // verde
                        creacion: ["#A855F7", "#D8B4FE"], // morado
                        defensa: ["#06B6D4", "#67E8F9"], // cian
                        disciplina: ["#EF4444", "#FCA5A5"], // rojo
                        fisico: ["#F59E0B", "#FCD34D"], // amarillo/naranja
                        disponibilidad: ["#F97316", "#FDBA74"], // naranja
                        otros: ["#10B981", "#6EE7B7"], // menta
                      };

                      const VARIANTS = [
                        [0.95, 1.0],
                        [0.75, 0.95],
                        [0.60, 0.85],
                        [0.50, 0.80],
                        [0.40, 0.70],
                      ];

                      const hashKey = (s) => {
                        let h = 0;
                        const str = String(s);
                        for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
                        return h;
                      };

                      const mix = (hex, factor) => {
                        const c = String(hex).replace("#", "");
                        const r = parseInt(c.slice(0, 2), 16);
                        const g = parseInt(c.slice(2, 4), 16);
                        const b = parseInt(c.slice(4, 6), 16);
                        const rr = Math.min(255, Math.max(0, Math.round(r * factor)));
                        const gg = Math.min(255, Math.max(0, Math.round(g * factor)));
                        const bb = Math.min(255, Math.max(0, Math.round(b * factor)));
                        return `rgb(${rr}, ${gg}, ${bb})`;
                      };

                      // --------------------------
                      // Categorías por columnas
                      // --------------------------
                      const CATEGORIES = [
                        { title: "🏟️ Participación", groupKey: "participacion", keys: ["partidos_jugador", "titular_partidos", "torneos_convocados", "minutos_jugados"] },
                        { title: "⚽ Ataque", groupKey: "ataque", keys: ["goles", "asistencias", "tiros_arco", "tiros_fuera", "tiros_bloqueados", "tiros_libres", "penales", "offsides"] },
                        { title: "🎯 Creación / Pase", groupKey: "creacion", keys: ["pases_clave", "pases_completados", "pases_errados", "centros_acertados", "regates_exitosos", "posesion_perdida"] },
                        { title: "🛡️ Defensa", groupKey: "defensa", keys: ["intercepciones", "despejes", "entradas_exitosas", "bloqueos", "recuperaciones", "duelos_ganados", "duelos_aereos_ganados"] },
                        { title: "🧾 Disciplina", groupKey: "disciplina", keys: ["faltas_cometidas", "faltas_recibidas", "tarjetas_amarillas", "tarjetas_rojas", "sanciones_federativas"] },
                        { title: "💪 Físico", groupKey: "fisico", keys: ["distancia_recorrida_km", "sprints"] },
                        { title: "🏥 Disponibilidad", groupKey: "disponibilidad", keys: ["lesiones", "dias_baja"] },
                      ];

                      // keys presentes (por si BD suma campos nuevos)
                      const presentKeys = Object.keys(estadisticas || {})
                        .filter((k) => !EXCLUDE_KEYS.has(k))
                        .filter((k) => estadisticas?.[k] !== undefined);

                      // “Otros” no clasificados
                      const catKeysSet = new Set(CATEGORIES.flatMap((c) => c.keys));
                      const others = presentKeys.filter((k) => !catKeysSet.has(k));

                      const StatBar = ({ k, groupKey = "otros" }) => {
                        const raw = estadisticas?.[k];
                        const n = toNumberOrNull(k, raw);

                        const base = 10; // regla: partimos en 10
                        const max = dynamicMax(n ?? 0, base);
                        const pct = n == null ? 0 : clampPct((n / max) * 100);

                        const basePair = CATEGORY_COLOR[groupKey] || CATEGORY_COLOR.otros;

                        // variante distinta por estadística
                        const idx = hashKey(k) % VARIANTS.length;
                        const [f1, f2] = VARIANTS[idx];

                        const c1 = mix(basePair[0], f1);
                        const c2 = mix(basePair[1], f2);

                        const track = "linear-gradient(90deg, rgba(0,0,0,0.12), rgba(0,0,0,0.06))";

                        return (
                          <div className="py-2">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[12px] font-extrabold text-black/70 truncate">
                                {formatLabel(k)}
                              </p>

                              <p className="text-[12px] font-black text-black/60 tabular-nums shrink-0">
                                {formatValue(k, raw)}{" "}
                                <span className="text-black/30">/ {max}</span>
                              </p>
                            </div>

                            <div
                              className="mt-2 h-2 w-full rounded-full overflow-hidden"
                              style={{ background: track }}
                            >
                              <div
                                className="h-2 rounded-full"
                                style={{
                                  width: `${pct}%`,
                                  background: `linear-gradient(90deg, ${c1}, ${c2})`,
                                  boxShadow: `0 0 10px ${c2}`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      };

                      const CategoryCol = ({ title, keys, groupKey }) => {
                        const keysHere = keys.filter((k) => presentKeys.includes(k));
                        if (keysHere.length === 0) return null;

                        return (
                          <div className="rounded-2xl border border-black/10 bg-white p-4">
                            <p className="text-xs font-black tracking-[0.30em] uppercase text-black/40">
                              {title}
                            </p>

                            <div className="mt-3 divide-y divide-black/10">
                              {keysHere.map((k) => (
                                <div key={k} className="first:pt-0 pt-2">
                                  <StatBar k={k} groupKey={groupKey} />
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      };

                      return (
                        <div className="space-y-5">
                          {/* Resumen (se mantiene) */}
                          <div className="rounded-2xl border border-black/10 bg-white p-5">
                            <p className="text-xs font-black tracking-[0.35em] uppercase text-black/40">
                              Resumen
                            </p>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold bg-black/5 text-black/70">
                                🏟️ PJ: <span className="ml-1 text-black font-black">{estadisticas?.partidos_jugador ?? "—"}</span>
                              </span>

                              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold bg-black/5 text-black/70">
                                ⚽ G: <span className="ml-1 text-black font-black">{estadisticas?.goles ?? "—"}</span>
                              </span>

                              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold bg-black/5 text-black/70">
                                🎯 A: <span className="ml-1 text-black font-black">{estadisticas?.asistencias ?? "—"}</span>
                              </span>

                              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold bg-black/5 text-black/70">
                                🟨: <span className="ml-1 text-black font-black">{estadisticas?.tarjetas_amarillas ?? "—"}</span>
                              </span>

                              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold bg-black/5 text-black/70">
                                🟥: <span className="ml-1 text-black font-black">{estadisticas?.tarjetas_rojas ?? "—"}</span>
                              </span>

                              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold bg-black/5 text-black/70">
                                ⏱️ Min: <span className="ml-1 text-black font-black">{estadisticas?.minutos_jugados ?? "—"}</span>
                              </span>
                            </div>
                          </div>

                          {/* Tablero por columnas */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                            {CATEGORIES.map((c) => (
                              <CategoryCol
                                key={c.title}
                                title={c.title}
                                keys={c.keys}
                                groupKey={c.groupKey}
                              />
                            ))}
                          </div>

                          {/* Otros indicadores (si aparecen nuevas columnas en BD) */}
                          {others.length > 0 && (
                            <div className="rounded-2xl border border-black/10 bg-white p-4">
                              <p className="text-xs font-black tracking-[0.30em] uppercase text-black/40">
                                📌 Otros indicadores
                              </p>

                              <div className="mt-3 divide-y divide-black/10">
                                {others.map((k) => (
                                  <div key={k} className="pt-2">
                                    <StatBar k={k} groupKey="otros" />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()
                  )}
                </div>
              )}

              {/* CONTRATO */}
              {section === "contrato" && (
                <div className="space-y-4">
                  <h3 className="text-lg font-extrabold text-[#e82d89] uppercase tracking-widest">
                    Contrato
                  </h3>
                  <div className="rounded-2xl border border-black/10 bg-white p-5">
                    <p className="text-sm font-semibold text-black/70">
                      Próximo: endpoint seguro para descargar/visualizar contrato PDF del jugador.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
