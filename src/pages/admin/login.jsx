// src/pages/admin/login.jsx
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { login as loginService } from "../../services/auth";
import Footer from "../../components/footer";
import IsLoading from "../../components/isLoading";
import logoRAFC from "../../statics/logos/logo-sin-fondo.png";

const TOKEN_KEY = "rafc_token";

export default function Login() {
  const [form, setForm] = useState({ nombre_usuario: "", password: "" });
  const [mensaje, setMensaje] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const rawRedirect = location?.state?.from || "/admin";
  const redirectTo =
    typeof rawRedirect === "string" && rawRedirect.startsWith("/")
      ? rawRedirect
      : "/admin";

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "password") {
      setForm((prev) => ({ ...prev, password: value }));
    } else if (name === "nombre_usuario") {
      setForm((prev) => ({ ...prev, nombre_usuario: value.trimStart() }));
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    setMensaje("");
    setIsLoading(true);

    if (form.nombre_usuario.trim().length < 3 || form.password.length < 4) {
      setMensaje("❌ Usuario y/o contraseña muy cortos");
      setIsLoading(false);
      return;
    }

    try {
      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch {}

      const res = await loginService(form.nombre_usuario.trim(), form.password);
      const token = res?.rafc_token;

      if (!token) {
        setMensaje("❌ No se recibió rafc_token");
        setIsLoading(false);
        return;
      }

      localStorage.setItem(TOKEN_KEY, token);
      if (res?.user) localStorage.setItem("user_info", JSON.stringify(res.user));

      navigate(redirectTo, { replace: true });
    } catch (err) {
      const status = err?.response?.status ?? err?.status;
      if (status === 400 || status === 401) {
        setMensaje("❌ Credenciales inválidas");
      } else {
        const msg =
          err?.response?.data?.message || err?.message || "Error de conexión";
        setMensaje(`❌ ${msg}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-[#1d0b0b] via-[#1d0b0b] to-[#e82d89] font-realacademy overflow-hidden">
      {/* FX de fondo (salvaje pero fino) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute -top-44 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full blur-3xl opacity-40"
          style={{
            background:
              "radial-gradient(circle, rgba(232,45,137,0.55), transparent 60%)",
          }}
        />
        <div
          className="absolute -bottom-56 -left-40 w-[820px] h-[820px] rounded-full blur-3xl opacity-35"
          style={{
            background:
              "radial-gradient(circle, rgba(0,0,0,0.65), transparent 60%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, rgba(255,255,255,0.6) 0px, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 14px)",
          }}
        />
      </div>

      {/* ✅ Overlay Loader FULL SCREEN (antes quedaba encerrado en la card) */}
      {isLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div className="relative w-full max-w-md px-4">
            {/* Marco salvaje para el loader (sin tocar IsLoading) */}
            <div
              className="relative rounded-[28px] p-[2px]"
              style={{
                background:
                  "linear-gradient(135deg, rgba(232,45,137,0.95), rgba(255,255,255,0.15), rgba(232,45,137,0.55))",
                clipPath:
                  "polygon(0% 12px, 12px 0%, calc(100% - 18px) 0%, 100% 18px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 18px 100%, 0% calc(100% - 18px))",
              }}
            >
              <div
                className="relative rounded-[28px] p-8 bg-black/55 border border-[#e82d89]/30"
                style={{
                  clipPath:
                    "polygon(0% 12px, 12px 0%, calc(100% - 18px) 0%, 100% 18px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 18px 100%, 0% calc(100% - 18px))",
                }}
              >
                <div className="flex flex-col items-center justify-center gap-3">
                  <img
                    src="/LOGO_SIN_FONDO_ROSA.png"
                    alt="Ingresando..."
                    className="w-20 h-20 object-contain drop-shadow-[0_0_26px_rgba(232,45,137,0.9)]"
                    loading="eager"
                    decoding="async"
                  />
                  <p className="text-white font-extrabold tracking-widest uppercase text-sm">
                    Ingresando...
                  </p>
                  <IsLoading />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="flex-grow flex items-center justify-center px-4 py-10">
        <div className="relative w-full max-w-md">
          <div className="relative">
            {/* Glow controlado */}
            <div
              aria-hidden
              className="absolute -inset-6 blur-2xl opacity-70"
              style={{
                background:
                  "radial-gradient(circle at 30% 20%, rgba(232,45,137,0.85), transparent 55%), radial-gradient(circle at 70% 80%, rgba(232,45,137,0.55), transparent 60%)",
              }}
            />

            {/* Borde neon con cortes */}
            <div
              className="relative p-[2px] rounded-[28px]"
              style={{
                background:
                  "linear-gradient(135deg, rgba(232,45,137,0.95), rgba(255,255,255,0.15), rgba(232,45,137,0.55))",
                clipPath:
                  "polygon(0% 12px, 12px 0%, calc(100% - 18px) 0%, 100% 18px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 18px 100%, 0% calc(100% - 18px))",
              }}
            >
              {/* Card glass */}
              <div
                className="relative rounded-[28px] px-10 py-10 overflow-hidden"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.80))",
                  clipPath:
                    "polygon(0% 12px, 12px 0%, calc(100% - 18px) 0%, 100% 18px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 18px 100%, 0% calc(100% - 18px))",
                }}
              >
                {/* Micro-textura */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-[0.12]"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 1px 1px, rgba(232,45,137,0.9) 1px, transparent 0)",
                    backgroundSize: "16px 16px",
                  }}
                />

                {/* Header */}
                <div className="relative flex flex-col items-center mb-7">
                  <div className="relative">
                    <div
                      aria-hidden
                      className="absolute -inset-7 rounded-full blur-xl opacity-70"
                      style={{
                        background:
                          "radial-gradient(circle, rgba(232,45,137,0.65), transparent 65%)",
                      }}
                    />
                    <img
                      src={logoRAFC}
                      alt="Logo Real Academy FC"
                      className="relative w-28 h-28 object-contain drop-shadow-[0_14px_30px_rgba(0,0,0,0.22)]"
                      loading="eager"
                      decoding="async"
                    />
                  </div>

                  <h2 className="mt-4 text-center font-extrabold uppercase tracking-widest text-[#e82d89] text-xl sm:text-2xl drop-shadow-[0_0_18px_rgba(232,45,137,0.35)]">
                    Ingreso Portal Real Academy FC
                  </h2>

                  <p className="mt-2 text-xs text-gray-700 text-center font-semibold tracking-wide">
                    Acceso Administrativo
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5" autoComplete="on">
                  <div className="space-y-2">
                    <label className="text-xs font-black tracking-widest uppercase text-gray-700">
                      Nombre de usuario
                    </label>
                    <input
                      name="nombre_usuario"
                      placeholder="Nombre de usuario"
                      autoComplete="username"
                      enterKeyHint="next"
                      aria-label="Nombre de usuario"
                      className="w-full rounded-xl px-4 py-3 border border-black/10 bg-white/80
                                 focus:outline-none focus:ring-2 focus:ring-[#e82d89]
                                 shadow-[0_10px_30px_rgba(232,45,137,0.10)]"
                      value={form.nombre_usuario}
                      onChange={handleChange}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black tracking-widest uppercase text-gray-700">
                      Contraseña
                    </label>
                    <input
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Contraseña"
                      enterKeyHint="done"
                      aria-label="Contraseña"
                      className="w-full rounded-xl px-4 py-3 border border-black/10 bg-white/80
                                 focus:outline-none focus:ring-2 focus:ring-[#e82d89]
                                 shadow-[0_10px_30px_rgba(232,45,137,0.10)]"
                      value={form.password}
                      onChange={handleChange}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`relative w-full rounded-xl py-3 font-extrabold uppercase tracking-widest transition duration-300 overflow-hidden
                      ${
                        isLoading
                          ? "bg-gray-400 text-white cursor-not-allowed"
                          : "text-white bg-[#e82d89] hover:bg-[#c61f74] shadow-[0_18px_45px_rgba(232,45,137,0.35)]"
                      }`}
                  >
                    {!isLoading && (
                      <span
                        aria-hidden
                        className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300"
                        style={{
                          background:
                            "radial-gradient(circle at 50% 120%, rgba(255,255,255,0.55), transparent 55%)",
                        }}
                      />
                    )}
                    <span className="relative">
                      {isLoading ? "Ingresando..." : "Ingresar"}
                    </span>
                  </button>
                </form>

                {mensaje && (
                  <p
                    className={`mt-4 text-center text-sm font-extrabold ${
                      mensaje.startsWith("✅") ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {mensaje}
                  </p>
                )}

                {/* Firma inferior: logo pequeño en vez de punto */}
                <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-gray-600 font-semibold">
                  <img
                    src={logoRAFC}
                    alt="RAFC"
                    className="w-4 h-4 object-contain opacity-90"
                    loading="lazy"
                    decoding="async"
                  />
                  <span>Real Academy FC • Admin</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
