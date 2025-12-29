import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { loginApoderado as loginService } from "../../services/auth";
import Footer from "../../components/footer";
import IsLoading from "../../components/isLoading";
import logoRAFC from "../../statics/logos/logo-sin-fondo.png";

const TOKEN_KEY = "rafc_apoderado_token";

export default function LoginApoderado() {
  const [form, setForm] = useState({ rut: "", password: "" });
  const [mensaje, setMensaje] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const rawRedirect = location?.state?.from || "/portal-apoderado";
  const redirectTo =
    typeof rawRedirect === "string" && rawRedirect.startsWith("/")
      ? rawRedirect
      : "/portal-apoderado";

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "rut") {
      // solo números, máx 8
      const clean = value.replace(/\D/g, "").slice(0, 8);
      setForm((prev) => ({ ...prev, rut: clean }));
    } else if (name === "password") {
      setForm((prev) => ({ ...prev, password: value }));
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    setMensaje("");
    setIsLoading(true);

    if (form.rut.length !== 8 || form.password.length < 4) {
      setMensaje("❌ RUT o contraseña inválidos");
      setIsLoading(false);
      return;
    }

    try {
      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch {}

      const res = await loginService(form.rut, form.password);
      const token = res?.token;

      if (!token) {
        setMensaje("❌ No se recibió token");
        setIsLoading(false);
        return;
      }

      localStorage.setItem(TOKEN_KEY, token);

      // flag para forzar cambio de clave
      if (res?.must_change_password === true) {
        navigate("/portal-apoderado/cambiar-clave", { replace: true });
        return;
      }

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
      {/* FX fondo */}
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

      {/* Loader fullscreen */}
      {isLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div className="flex flex-col items-center gap-3">
            <img
              src="/LOGO_SIN_FONDO_ROSA.png"
              alt="Ingresando..."
              className="w-20 h-20 object-contain drop-shadow-[0_0_26px_rgba(232,45,137,0.9)]"
            />
            <p className="text-white font-extrabold tracking-widest uppercase text-sm">
              Ingresando...
            </p>
            <IsLoading />
          </div>
        </div>
      )}

      <section className="flex-grow flex items-center justify-center px-4 py-10">
        <div className="relative w-full max-w-md">
          <div className="relative p-[2px] rounded-[28px]"
            style={{
              background:
                "linear-gradient(135deg, rgba(232,45,137,0.95), rgba(255,255,255,0.15), rgba(232,45,137,0.55))",
            }}
          >
            <div className="relative rounded-[28px] px-10 py-10 bg-white/90">
              <div className="flex flex-col items-center mb-7">
                <img src={logoRAFC} alt="RAFC" className="w-28 h-28" />
                <h2 className="mt-4 text-center font-extrabold uppercase tracking-widest text-[#e82d89] text-xl">
                  Portal de Apoderados
                </h2>
                <p className="mt-2 text-xs text-gray-700 font-semibold">
                  Acceso Apoderados
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="text-xs font-black tracking-widest uppercase text-gray-700">
                    RUT (sin puntos ni DV)
                  </label>
                  <input
                    name="rut"
                    placeholder="16978094"
                    inputMode="numeric"
                    className="w-full rounded-xl px-4 py-3 border"
                    value={form.rut}
                    onChange={handleChange}
                    disabled={isLoading}
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-black tracking-widest uppercase text-gray-700">
                    Contraseña
                  </label>
                  <input
                    name="password"
                    type="password"
                    className="w-full rounded-xl px-4 py-3 border"
                    value={form.password}
                    onChange={handleChange}
                    disabled={isLoading}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded-xl py-3 font-extrabold uppercase tracking-widest text-white bg-[#e82d89]"
                >
                  {isLoading ? "Ingresando..." : "Ingresar"}
                </button>
              </form>

              {mensaje && (
                <p className="mt-4 text-center text-sm font-extrabold text-red-600">
                  {mensaje}
                </p>
              )}

              <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-gray-600 font-semibold">
                <img src={logoRAFC} alt="RAFC" className="w-4 h-4" />
                <span>Real Academy FC • Apoderados</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
