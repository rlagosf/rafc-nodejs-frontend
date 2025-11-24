// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/landing';
import Contacto from './pages/contacto';
import Servicios from './pages/servicios';
import Ubicacion from './pages/ubicacion';
import Nosotros from './pages/nosotros';
import Footer from './components/footer';
import Login from './pages/admin/login';
import Navbar from './components/navbar';
import ProtectedRoute from './components/protectedRoute';
import useInactividadLogout from './hooks/useInactividadLogout';
import Galeria from './pages/galeria';

// Panel admin
import DashboardLayout from './pages/admin/dashboard';
import CrearJugador from './pages/admin/formjugador';
import ListarJugadores from './pages/admin/listarJugadores';
import Estadisticas from './pages/admin/estadisticas';
import CrearUsuario from './pages/admin/crearUsuario';
import Pagos from './pages/admin/pagos';
import EstadosCuenta from './pages/admin/estadosCuenta';
import Configuracion from './pages/admin/configuracion';
import CrearConvocatoria from './pages/admin/crearConvocatoria';
import Categorias from './pages/admin/configuracion/categorias';
import MediosPago from './pages/admin/configuracion/mediospago';
import TiposPago from './pages/admin/configuracion/tipospago';
import Roles from './pages/admin/configuracion/roles';
import EstadoJugadores from './pages/admin/configuracion/estadojugadores';
import Posiciones from './pages/admin/configuracion/posiciones';
import DetalleJugador from './pages/admin/detalleJugador';
import VerConvocacionHistorica from './pages/admin/verConvocatoriaHistorica';
import RegistrarEstadisticas from './pages/admin/registraEstadistica';
import DetalleEstadistica from './pages/admin/detalleEstadistica';
import ListarPagos from './pages/admin/listarPagos';
import JugadoresPendientes from './pages/admin/modulo-financiero/jugadoresPendientes';
import PagosCentralizados from './pages/admin/modulo-financiero/pagosCentralizados';
import PowerbiFinanzas from './pages/admin/modulo-financiero/powerbiFinanzas';
import PrevisionMedica from './pages/admin/configuracion/previsionmedica';
import EstablecimientosEducacionales from './pages/admin/configuracion/estableceduc';
import Agenda from './pages/admin/agenda';
import Sucursales from './pages/admin/configuracion/sucursales';

// Theme
import { ThemeProvider } from './context/ThemeContext';

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

// 🔒 Activa auto-logout SOLO dentro del área privada
function PrivateApp({ children }) {
  useInactividadLogout({
    timeoutMs: 5 * 60 * 1000, // 5 minutos de inactividad
    pingMs: 15 * 1000,        // chequeo cada 15s
    // storageKey: 'rafc_lastActivity', // (opcional) personaliza claves
    // forceKey: 'rafc_forceLogout',    // (opcional) personaliza claves
  });
  return children;
}

export default function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          {/* 🌐 Pública: Landing */}
          <Route
            path="/"
            element={
              <div className="scroll-smooth w-full min-h-screen bg-gradient-to-br from-[#1d0b0b] via-[#1d0b0b] to-[#e82d89] text-white font-sans">
                <Navbar />
                <main><Home /></main>
                <Footer />
              </div>
            }
          />

          {/* 🔐 Login público y otras páginas públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/galeria" element={<Galeria />} />

          {/* 🔒 Panel de administración con subrutas protegidas */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <PrivateApp>
                  <DashboardLayout />
                </PrivateApp>
              </ProtectedRoute>
            }
          >
            {/* Hijas relativas */}
            <Route path="crear-jugador" element={<CrearJugador />} />
            <Route path="listar-jugadores" element={<ListarJugadores />} />
            <Route path="estadisticas" element={<Estadisticas />} />
            <Route path="crear-usuario" element={<CrearUsuario />} />
            <Route path="agenda" element={<Agenda />} />

            {/* Pagos */}
            <Route path="gestionar-pagos" element={<ListarPagos />} />
            <Route path="registrar-pago" element={<Pagos />} />
            <Route path="modulo-financiero/jugadores-pendientes" element={<JugadoresPendientes/>} />
            <Route path="modulo-financiero/power-bi" element={<PowerbiFinanzas/>} />
            <Route path="modulo-financiero/pagos-centralizados" element={<PagosCentralizados/>} />
            <Route path="estados-cuenta" element={<EstadosCuenta />} />
            <Route path="configuracion" element={<Configuracion />} />
            <Route path="configuracion/categorias" element={<Categorias />} />
            <Route path="configuracion/medios-pago" element={<MediosPago />} />
            <Route path="configuracion/tipos-pago" element={<TiposPago />} />
            <Route path="configuracion/roles" element={<Roles />} />
            <Route path="configuracion/estados" element={<EstadoJugadores />} />
            <Route path="configuracion/posiciones" element={<Posiciones />} />
            <Route path="configuracion/establecimientos-educacionales" element={<EstablecimientosEducacionales />} />
            <Route path="configuracion/prevision-medica" element={<PrevisionMedica />} />
            <Route path="configuracion/sucursales" element={<Sucursales />} />
            <Route path="convocatorias" element={<CrearConvocatoria />} />
            <Route path="detalle-jugador/:rut" element={<DetalleJugador />} />
            <Route path="ver-convocaciones-historicas" element={<VerConvocacionHistorica />} />
            <Route path="registrar-estadisticas" element={<RegistrarEstadisticas />} />
            <Route path="detalle-estadistica/:rut" element={<DetalleEstadistica />} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}
