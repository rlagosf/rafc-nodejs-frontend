// src/pages/apoderado/portalDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { clearToken } from "../../services/api";
import IsLoading from "../../components/isLoading";

const ACCENT = "#e82d89";

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

export default function PortalDashboard() {
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [jugadores, setJugadores] = useState([]);
  const [error, setError] = useState("");

  // UI state
  const [selectedRut, setSelectedRut] = useState("");
  const [section, setSection] = useState("datos"); // datos | pagos | agenda | estadisticas | contrato

  const jugadorSel = useMemo(() => {
    const j = jugadores.find((x) => String(x?.rut_jugador) === String(selectedRut));
    return j || jugadores[0] || null;
  }, [jugadores, selectedRut]);

  // cuando llegan jugadores, selecciona el primero
  useEffect(() => {
    if (!selectedRut && jugadores.length > 0) {
      setSelectedRut(String(jugadores[0]?.rut_jugador ?? ""));
    }
  }, [jugadores, selectedRut]);

  useEffect(() => {
    const abort = new AbortController();

    (async () => {
      setIsLoading(true);
      setError("");

      // api.js ya inyecta Authorization con rafc_token
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
        // ruido normal cuando se desmonta
        if (err?.code === "ERR_CANCELED" || err?.message === "canceled") return;

        const st = err?.status ?? err?.response?.status;
        const msg = err?.message || err?.response?.data?.message || "Error";

        if (st === 403) setError("Debes cambiar tu contraseña para continuar.");
        else if (st === 401) {
          // sesión expirada
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

  const handleLogout = async () => {
    try {
      // si existe /auth/logout como en admin, intenta (si no existe, cae al catch)
      await api.post("/auth/logout");
    } catch {
      // nada: igual cerramos local
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

  if (isLoading) return <IsLoading />;

  return (
    <div className="min-h-screen font-realacademy text-[#1a1a1a] bg-[#e9eaec]">
      {/* Brillo suave */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[980px] h-[980px] rounded-full blur-3xl opacity-60"
          style={{
            background: "radial-gradient(circle, rgba(232,45,137,0.18), transparent 60%)",
          }}
        />
        <div
          className="absolute -bottom-56 right-[-180px] w-[900px] h-[900px] rounded-full blur-3xl opacity-50"
          style={{
            background: "radial-gradient(circle, rgba(0,0,0,0.06), transparent 60%)",
          }}
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
              Un panel hecho para que veas lo importante: tu jugador, su info y su progreso.
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

            {/* selector */}
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

            {/* menú */}
            <div className="mt-6">
              <p className="text-xs font-black tracking-[0.35em] uppercase text-black/50 mb-3">
                Secciones
              </p>

              <div className="space-y-2">
                <SectionBtn
                  active={section === "datos"}
                  icon="D"
                  label="Datos del jugador"
                  onClick={() => setSection("datos")}
                />
                <SectionBtn
                  active={section === "pagos"}
                  icon="P"
                  label="Pagos"
                  onClick={() => setSection("pagos")}
                />
                <SectionBtn
                  active={section === "agenda"}
                  icon="A"
                  label="Agenda"
                  onClick={() => setSection("agenda")}
                />
                <SectionBtn
                  active={section === "estadisticas"}
                  icon="E"
                  label="Estadísticas"
                  onClick={() => setSection("estadisticas")}
                />
                <SectionBtn
                  active={section === "contrato"}
                  icon="C"
                  label="Contrato"
                  onClick={() => setSection("contrato")}
                />
              </div>
            </div>
          </aside>

          {/* Main */}
          <main className="rounded-[26px] border border-black/10 bg-[#f2f2f3] shadow-[0_20px_70px_rgba(0,0,0,0.08)] p-5 sm:p-7">
            {/* Header del jugador */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black tracking-[0.35em] uppercase text-black/50">
                  Jugador seleccionado
                </p>
                <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-black">
                  {jugadorSel?.nombre_jugador || "—"}
                </h2>
                <p className="mt-1 text-sm font-semibold text-black/60">
                  RUT:{" "}
                  <span className="font-extrabold text-black/80">
                    {jugadorSel?.rut_jugador || "—"}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Pill>
                  Sección:{" "}
                  <span className="ml-1 font-extrabold" style={{ color: ACCENT }}>
                    {section}
                  </span>
                </Pill>
              </div>
            </div>

            <div className="mt-6 border-t border-black/10 pt-6">
              {/* Contenido por sección (placeholders limpios) */}
              {section === "datos" && (
                <div className="space-y-4">
                  <h3 className="text-lg font-extrabold text-[#e82d89] uppercase tracking-widest">
                    Datos del jugador
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-black/10 bg-white p-5">
                      <p className="text-xs font-black tracking-[0.35em] uppercase text-black/40">
                        Información
                      </p>
                      <p className="mt-2 text-sm font-semibold text-black/70">
                        Aquí mostraremos: categoría, posición, sucursal, estado, contacto, etc.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-black/10 bg-white p-5">
                      <p className="text-xs font-black tracking-[0.35em] uppercase text-black/40">
                        Observaciones
                      </p>
                      <p className="mt-2 text-sm font-semibold text-black/70">
                        Próximo: traer observaciones y datos médicos si aplica.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {section === "pagos" && (
                <div className="space-y-4">
                  <h3 className="text-lg font-extrabold text-[#e82d89] uppercase tracking-widest">
                    Pagos
                  </h3>
                  <div className="rounded-2xl border border-black/10 bg-white p-5">
                    <p className="text-sm font-semibold text-black/70">
                      Próximo paso: consumir <span className="font-extrabold">/portal-apoderado/jugadores/:rut/pagos</span>.
                    </p>
                  </div>
                </div>
              )}

              {section === "agenda" && (
                <div className="space-y-4">
                  <h3 className="text-lg font-extrabold text-[#e82d89] uppercase tracking-widest">
                    Agenda
                  </h3>
                  <div className="rounded-2xl border border-black/10 bg-white p-5">
                    <p className="text-sm font-semibold text-black/70">
                      Próximo: entrenamientos/partidos (podemos enganchar eventos/convocatorias).
                    </p>
                  </div>
                </div>
              )}

              {section === "estadisticas" && (
                <div className="space-y-4">
                  <h3 className="text-lg font-extrabold text-[#e82d89] uppercase tracking-widest">
                    Estadísticas
                  </h3>
                  <div className="rounded-2xl border border-black/10 bg-white p-5">
                    <p className="text-sm font-semibold text-black/70">
                      Próximo: estadísticas del jugador (goles, asistencia, rendimiento, etc.).
                    </p>
                  </div>
                </div>
              )}

              {section === "contrato" && (
                <div className="space-y-4">
                  <h3 className="text-lg font-extrabold text-[#e82d89] uppercase tracking-widest">
                    Contrato
                  </h3>
                  <div className="rounded-2xl border border-black/10 bg-white p-5">
                    <p className="text-sm font-semibold text-black/70">
                      Próximo: link a la copia del contrato y descarga PDF.
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
