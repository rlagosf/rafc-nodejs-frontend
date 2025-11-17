// src/pages/admin/login.jsx
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { login as loginService } from '../../services/auth';
import Footer from '../../components/footer';
import logoRAFC from '../../statics/logos/logo-sin-fondo.png';

const TOKEN_KEY = 'rafc_token';

export default function Login() {
  const [form, setForm] = useState({ nombre_usuario: '', password: '' });
  const [mensaje, setMensaje] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Evita open-redirect: solo permitimos rutas internas
  const rawRedirect = location?.state?.from || '/admin';
  const redirectTo = typeof rawRedirect === 'string' && rawRedirect.startsWith('/') ? rawRedirect : '/admin';

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Regla: no tocar password; username solo trim
    if (name === 'password') {
      setForm((prev) => ({ ...prev, password: value }));
    } else if (name === 'nombre_usuario') {
      setForm((prev) => ({ ...prev, nombre_usuario: value.trimStart() })); // trimStart para UX; backend normaliza igual
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isLoading) return;
    setMensaje('');
    setIsLoading(true);

    // Validaciones ligeras (backend tiene zod)
    if (form.nombre_usuario.trim().length < 3 || form.password.length < 4) {
      setMensaje('❌ Usuario y/o contraseña muy cortos');
      setIsLoading(false);
      return;
    }

    try {
      // Limpieza de sesión previa (idempotente)
      try { localStorage.removeItem(TOKEN_KEY); } catch {}

      const res = await loginService(form.nombre_usuario.trim(), form.password);
      const token = res?.rafc_token;

      if (!token) {
        setMensaje('❌ No se recibió rafc_token');
        setIsLoading(false);
        return;
      }

      // Guardar token y, opcional, user
      localStorage.setItem(TOKEN_KEY, token);
      if (res?.user) {
        localStorage.setItem('user_info', JSON.stringify(res.user));
      }

      // Navegación segura
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const status = err?.response?.status ?? err?.status;
      if (status === 400 || status === 401) {
        setMensaje('❌ Credenciales inválidas');
      } else {
        const msg = err?.response?.data?.message || err?.message || 'Error de conexión';
        setMensaje(`❌ ${msg}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-[#1d0b0b] via-[#1d0b0b] to-[#e82d89] font-realacademy">
      <section className="flex-grow flex items-center justify-center px-4 py-8">
        <div className="bg-white shadow-2xl rounded-2xl p-10 w-full max-w-md animate-fade-in relative">
          <div className="flex flex-col items-center mb-6">
            <img
              src={logoRAFC}
              alt="Logo Real Academy FC"
              className="w-20 h-20 object-contain mb-3 drop-shadow-md"
            />
            <h2 className="text-2xl sm:text-3xl text-center font-bold text-[#e82d89] uppercase tracking-wide">
              Ingreso Portal Real Academy FC
            </h2>
          </div>

          <form onSubmit={handleLogin} className="space-y-5" autoComplete="on">
            <input
              name="nombre_usuario"
              placeholder="Nombre de usuario"
              autoComplete="username"
              enterKeyHint="next"
              aria-label="Nombre de usuario"
              className="w-full border border-gray-300 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#e82d89]"
              value={form.nombre_usuario}
              onChange={handleChange}
              required
              disabled={isLoading}
            />
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Contraseña"
              enterKeyHint="done"
              aria-label="Contraseña"
              className="w-full border border-gray-300 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#e82d89]"
              value={form.password}
              onChange={handleChange}
              required
              disabled={isLoading}
            />
            <button
              type="submit"
              className={`w-full font-semibold py-3 rounded-xl transition duration-300 ${
                isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#e82d89] text-white hover:bg-[#c61f74]'
              }`}
              disabled={isLoading}
            >
              {isLoading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          {mensaje && (
            <p
              className={`mt-4 text-center text-sm font-semibold ${
                mensaje.startsWith('✅') ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {mensaje}
            </p>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
