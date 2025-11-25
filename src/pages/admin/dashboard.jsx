// pages/admin/dashboard.jsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import IsLoading from '../../components/isLoading';
import {
  LogOut,
  Sun,
  Moon,
  UserPlus,        // Crear Jugador
  Users,           // Listar Jugadores
  ClipboardList,   // Registrar Estadísticas
  BarChart3,       // Estadísticas Globales
  CalendarPlus,    // Crear Convocatorias
  History,         // Historial Convocatorias
  Banknote,        // Gestionar pagos
  FileSpreadsheet, // Estados de Cuenta
  UserCog,         // Crear Usuario
  Settings,        // Configuración
  CalendarDays,    // Agenda de eventos
  Stethoscope      // Seguimiento médico (próximamente)
} from 'lucide-react';
import { useMobileAutoScrollTop } from '../../hooks/useMobileScrollTop';

const TOKEN_KEY = 'rafc_token';

/* ───────────────── Helpers ───────────────── */
const segToLabel = (seg) => {
  const map = {
    '': 'Inicio',
    'admin': 'Inicio',
    'crear-jugador': 'Crear Jugador',
    'listar-jugadores': 'Listar Jugadores',
    'registrar-estadisticas': 'Registrar Estadísticas',
    'detalle-estadisticas': 'Detalle Estadísticas',
    'estadisticas': 'Estadísticas',
    'convocatorias': 'Convocatorias',
    'ver-convocaciones-historicas': 'Histórico Convocatorias',
    'gestionar-pagos': 'Gestionar pagos',
    'registrar-pago': 'Registrar pago',
    'estados-cuenta': 'Estados de Cuenta',
    'crear-usuario': 'Crear Usuario',
    'configuracion': 'Configuración',
    'agenda': 'Agenda',
    'seguimiento-medico': 'Seguimiento médico',
  };
  return map[seg] || (seg?.charAt(0).toUpperCase() + seg.slice(1).replaceAll('-', ' '));
};

const buildBreadcrumb = (pathname) => {
  const parts = pathname.split('/').filter(Boolean); // ['admin', '...']
  const items = [];
  let acc = '';
  for (let i = 0; i < parts.length; i++) {
    acc += `/${parts[i]}`;
    items.push({
      to: acc,
      label: segToLabel(parts[i]),
      last: i === parts.length - 1,
    });
  }
  if (items.length === 0) {
    items.push({ to: '/admin', label: 'Inicio', last: true });
  }
  return items;
};

// Normaliza breadcrumbs cuando vienen desde location.state.breadcrumb
const normalizeStateBreadcrumb = (stateBc = []) => {
  // Asegura que el primer ítem sea "Inicio"
  const base = [{ to: '/admin', label: 'Inicio' }];
  const merged = [...base, ...stateBc.map(b => ({ to: b.to, label: b.label }))];
  return merged.map((item, idx) => ({
    ...item,
    last: idx === merged.length - 1
  }));
};

// Definición de tarjetas de acceso (con íconos)
const cards = [
  { to: '/admin/crear-jugador',                label: 'Crear Jugador',                       roles: [1],    Icon: UserPlus },
  { to: '/admin/listar-jugadores',             label: 'Listar Jugadores',                    roles: [1, 2], Icon: Users },
  { to: '/admin/registrar-estadisticas',       label: 'Registrar Estadísticas',              roles: [1, 2], Icon: ClipboardList },
  { to: '/admin/estadisticas',                 label: 'Estadísticas Globales',               roles: [1, 2], Icon: BarChart3 },
  { to: '/admin/convocatorias',                label: 'Crear Convocatorias',                 roles: [1],    Icon: CalendarPlus },
  { to: '/admin/ver-convocaciones-historicas', label: 'Historial Convocatorias',             roles: [1, 2], Icon: History },
  { to: '/admin/gestionar-pagos',              label: 'Gestionar pagos',                     roles: [1],    Icon: Banknote },
  { to: '/admin/estados-cuenta',               label: 'Estados de Cuenta',                   roles: [1],    Icon: FileSpreadsheet },
  { to: '/admin/crear-usuario',                label: 'Crear Usuario',                       roles: [1],    Icon: UserCog },
  { to: '/admin/configuracion',                label: 'Configuración',                       roles: [1],    Icon: Settings },
  { to: '/admin/agenda',                       label: 'Agenda de eventos',                   roles: [1, 2], Icon: CalendarDays },
  // 🔴 Nueva tarjeta: Seguimiento médico (próximamente, deshabilitada)
  {
    to: '/admin/seguimiento-medico',
    label: 'Seguimiento médico (próximamente)',
    roles: [1, 2],
    Icon: Stethoscope,
    disabled: true,
  },
];

/* ───────────────── Component ───────────────── */
export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { darkMode, toggleTheme } = useTheme();

  const [rol, setRol] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Auth mínima con intento de refresh
  useEffect(() => {
    (async () => {
      try {
        let token = localStorage.getItem(TOKEN_KEY);
        if (!token) return navigate('/login');

        let decoded = jwtDecode(token);
        if (!decoded?.exp || decoded.exp * 1000 < Date.now()) {
          try {
            const r = await api.post('/auth/refresh');
            token = r?.data?.access_token;
            if (!token) throw new Error('no-refresh');
            localStorage.setItem(TOKEN_KEY, token);
            decoded = jwtDecode(token);
          } catch {
            navigate('/login');
            return;
          }
        }
        const rawRol = decoded?.rol_id ?? decoded?.role_id ?? decoded?.role;
        const parsed = Number(rawRol);
        setRol(Number.isFinite(parsed) ? parsed : 0);
      } catch {
        navigate('/login');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [navigate]);

  useMobileAutoScrollTop();

  const handleCerrarSesion = async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    try {
      await api.post(
        '/auth/logout',
        null,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
    } catch {
      // idempotente
    } finally {
      try { localStorage.removeItem(TOKEN_KEY); } catch {}
      window.location.replace('/');
    }
  };

  // 🧭 Breadcrumb: prioriza state.breadcrumb, si no existe, usa la URL
  const bc = useMemo(() => {
    const stateBc = location.state?.breadcrumb;
    if (Array.isArray(stateBc) && stateBc.length) {
      return normalizeStateBreadcrumb(stateBc);
    }
    return buildBreadcrumb(location.pathname);
  }, [location.pathname, location.state]);

  if (isLoading || rol === null) return <IsLoading />;

  const fondo = darkMode ? 'bg-[#111827] text-white' : 'bg-white text-[#1d0b0b]';
  const cardBase = darkMode
    ? 'bg-[#1f2937] border border-[#2b3341] hover:border-[#e82d89]'
    : 'bg-white border border-[#eee] hover:border-[#e82d89]';

  const isRoot = location.pathname === '/admin';

  return (
    <div className={`${fondo} min-h-screen font-realacademy`}>
      {/* Encabezado con acciones rápidas */}
      <header className="flex items-center justify-between px-6 pt-6">
        {/* Breadcrumb a la izquierda */}
        <nav className="text-sm" aria-label="breadcrumb">
          <ol className="flex flex-wrap items-center gap-2">
            {bc.map((b, i) => (
              <li key={`${b.to}-${i}`} className="flex items-center gap-2">
                {i !== 0 && <span className="opacity-60">/</span>}
                {b.last ? (
                  <span className="font-semibold text-[#e82d89]">{b.label}</span>
                ) : (
                  <Link className="hover:text-[#e82d89]" to={b.to}>{b.label}</Link>
                )}
              </li>
            ))}
          </ol>
        </nav>

        {/* Acciones a la derecha */}
        <div className="flex items-center gap-3">
          <button
            title="Cambiar tema"
            onClick={toggleTheme}
            className="p-2 rounded hover:bg-black/10 dark:hover:bg-white/10"
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            title="Cerrar sesión"
            onClick={handleCerrarSesion}
            className="p-2 rounded hover:bg-black/10 dark:hover:bg-white/10"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Título centrado */}
      <h1 className="text-3xl font-bold text-center mt-4 mb-8">Panel de Administración</h1>

      <main className="px-6 pb-20">
        {isRoot ? (
          <>
            {/* Grid de tarjetas */}
            <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {cards
                .filter(c => !c.roles || c.roles.includes(rol))
                .map(({ to, label, Icon, disabled }) => {
                  const commonClasses = `${cardBase} rounded-2xl p-6 shadow transition transform flex flex-col items-center justify-center gap-3 h-40`;
                  if (disabled) {
                    // Tarjeta deshabilitada: no navega
                    return (
                      <div
                        key={to}
                        className={`${commonClasses} opacity-60 cursor-not-allowed hover:-translate-y-0 hover:shadow-md`}
                        title="Módulo próximamente disponible"
                      >
                        <Icon className="w-12 h-12 opacity-90" />
                        <div className="text-center font-semibold">{label}</div>
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={to}
                      to={to}
                      className={`${commonClasses} hover:-translate-y-1 hover:shadow-lg`}
                    >
                      <Icon className="w-12 h-12 opacity-90" />
                      <div className="text-center font-semibold">{label}</div>
                    </Link>
                  );
                })}
            </div>
          </>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
