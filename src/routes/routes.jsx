// src/routes/routes.jsx
import { lazy } from "react";
import ProtectedRoute from "../components/protectedRoute";
import useInactividadLogout from "../hooks/useInactividadLogout";
import Navbar from "../components/navbar";
import Footer from "../components/footer";

/* -------------------- Públicos -------------------- */
const Landing = lazy(() => import("../pages/landing"));
const Contacto = lazy(() => import("../pages/contacto"));
const Servicios = lazy(() => import("../pages/servicios"));
const Ubicacion = lazy(() => import("../pages/ubicacion"));
const Nosotros = lazy(() => import("../pages/nosotros"));
const Galeria = lazy(() => import("../pages/galeria"));

/* -------------------- Login -------------------- */
const Login = lazy(() => import("../pages/admin/login"));
const LoginApoderado = lazy(() => import("../pages/admin/loginApoderado"));

/* -------------------- Admin -------------------- */
const DashboardLayout = lazy(() => import("../pages/admin/dashboard"));
const CrearJugador = lazy(() => import("../pages/admin/formjugador"));
const ListarJugadores = lazy(() => import("../pages/admin/listarJugadores"));
const Estadisticas = lazy(() => import("../pages/admin/estadisticas"));
const CrearUsuario = lazy(() => import("../pages/admin/crearUsuario"));
const Agenda = lazy(() => import("../pages/admin/agenda"));

const ListarPagos = lazy(() => import("../pages/admin/listarPagos"));
const Pagos = lazy(() => import("../pages/admin/pagos"));
const JugadoresPendientes = lazy(() =>
  import("../pages/admin/modulo-financiero/jugadoresPendientes")
);
const PowerbiFinanzas = lazy(() => import("../pages/admin/powerbiFinanzas"));
const PagosCentralizados = lazy(() => import("../pages/admin/modulo-financiero/pagosCentralizados"));
const EstadosCuenta = lazy(() => import("../pages/admin/estadosCuenta"));

const Configuracion = lazy(() => import("../pages/admin/configuracion"));
const Categorias = lazy(() => import("../pages/admin/configuracion/categorias"));
const MediosPago = lazy(() => import("../pages/admin/configuracion/mediospago"));
const TiposPago = lazy(() => import("../pages/admin/configuracion/tipospago"));
const Roles = lazy(() => import("../pages/admin/configuracion/roles"));
const EstadoJugadores = lazy(() => import("../pages/admin/configuracion/estadojugadores"));
const Posiciones = lazy(() => import("../pages/admin/configuracion/posiciones"));
const EstablecimientosEducacionales = lazy(() => import("../pages/admin/configuracion/estableceduc"));
const PrevisionMedica = lazy(() => import("../pages/admin/configuracion/previsionmedica"));
const Sucursales = lazy(() => import("../pages/admin/configuracion/sucursales"));

const CrearConvocatoria = lazy(() => import("../pages/admin/crearConvocatoria"));
const DetalleJugador = lazy(() => import("../pages/admin/detalleJugador"));
const VerConvocacionHistorica = lazy(() => import("../pages/admin/verConvocatoriaHistorica"));
const RegistrarEstadisticas = lazy(() => import("../pages/admin/registraEstadistica"));
const DetalleEstadistica = lazy(() => import("../pages/admin/detalleEstadistica"));

/* -------------------- Apoderado -------------------- */
const PortalHome = lazy(() => import("../pages/apoderado/portalHome"));
const PortalDashboard = lazy(() => import("../pages/apoderado/portalDashboard"));
const CambiarClaveApoderado = lazy(() => import("../pages/apoderado/cambiarClave"));

function Home() {
  return (
    <>
      <section id="inicio" className="scroll-mt-16"><Landing /></section>
      <section id="nosotros" className="scroll-mt-16"><Nosotros /></section>
      <section id="servicios" className="scroll-mt-16"><Servicios /></section>
      <section id="ubicacion" className="scroll-mt-16"><Ubicacion /></section>
      <section id="contacto" className="scroll-mt-16"><Contacto /></section>
    </>
  );
}

function PublicShell() {
  return (
    <div className="scroll-smooth w-full min-h-screen bg-gradient-to-br from-[#1d0b0b] via-[#1d0b0b] to-[#e82d89] text-white font-sans">
      <Navbar />
      <main><Home /></main>
      <Footer />
    </div>
  );
}

function PrivateApp({ children, redirectTo }) {
  useInactividadLogout({
    timeoutMs: 5 * 60 * 1000,
    pingMs: 15 * 1000,
    redirectTo, // ✅ /login o /login-apoderado
  });
  return children;
}

export const routes = [
  { path: "/", element: <PublicShell /> },
  { path: "/galeria", element: <Galeria /> },
  { path: "/login", element: <Login /> },
  { path: "/login-apoderado", element: <LoginApoderado /> },

  // ADMIN
  {
    path: "/admin",
    element: (
      <ProtectedRoute mode="admin" roleIn={[1, 2]}>
        <PrivateApp redirectTo="/login">
          <DashboardLayout />
        </PrivateApp>
      </ProtectedRoute>
    ),
    children: [
      { path: "crear-jugador", element: <CrearJugador /> },
      { path: "listar-jugadores", element: <ListarJugadores /> },
      { path: "estadisticas", element: <Estadisticas /> },
      { path: "crear-usuario", element: <CrearUsuario /> },
      { path: "agenda", element: <Agenda /> },

      { path: "gestionar-pagos", element: <ListarPagos /> },
      { path: "registrar-pago", element: <Pagos /> },
      { path: "modulo-financiero/jugadores-pendientes", element: <JugadoresPendientes /> },
      { path: "power-bi", element: <PowerbiFinanzas /> },
      { path: "modulo-financiero/pagos-centralizados", element: <PagosCentralizados /> },
      { path: "estados-cuenta", element: <EstadosCuenta /> },

      { path: "configuracion", element: <Configuracion /> },
      { path: "configuracion/categorias", element: <Categorias /> },
      { path: "configuracion/medios-pago", element: <MediosPago /> },
      { path: "configuracion/tipos-pago", element: <TiposPago /> },
      { path: "configuracion/roles", element: <Roles /> },
      { path: "configuracion/estados", element: <EstadoJugadores /> },
      { path: "configuracion/posiciones", element: <Posiciones /> },
      { path: "configuracion/establecimientos-educacionales", element: <EstablecimientosEducacionales /> },
      { path: "configuracion/prevision-medica", element: <PrevisionMedica /> },
      { path: "configuracion/sucursales", element: <Sucursales /> },

      { path: "convocatorias", element: <CrearConvocatoria /> },
      { path: "detalle-jugador/:rut", element: <DetalleJugador /> },
      { path: "ver-convocaciones-historicas", element: <VerConvocacionHistorica /> },
      { path: "registrar-estadisticas", element: <RegistrarEstadisticas /> },
      { path: "detalle-estadistica/:rut", element: <DetalleEstadistica /> },
    ],
  },

  // APODERADO
  // APODERADO
  {
    path: "/portal-apoderado",
    element: (
      <ProtectedRoute mode="apoderado">
        <PrivateApp
          redirectTo="/login-apoderado"
          storageKey="rafc_lastActivity_apoderado"
          forceKey="rafc_forceLogout_apoderado"
          timeoutMs={15 * 60 * 1000} // por ejemplo 15 min para apoderados (o 30)
        >
          <PortalDashboard />
        </PrivateApp>

      </ProtectedRoute>
    ),
  },
  {
    path: "/portal-apoderado/cambiar-clave",
    element: (
      <ProtectedRoute mode="apoderado">
        <PrivateApp redirectTo="/login-apoderado">
          {/* 👇 PortalHome ahora es SOLO el cambio de clave */}
          <PortalHome />
        </PrivateApp>
      </ProtectedRoute>
    ),
  },

];
