// src/pages/apoderado/portalHome.jsx
import { Outlet } from "react-router-dom";

export default function PortalHome() {
  return (
    <div className="min-h-screen bg-white text-black p-6">
      <h1 className="text-2xl font-extrabold">Portal Apoderado</h1>
      <p className="mt-2">Aquí irá “Mis jugadores”, pagos, estadísticas, etc.</p>

      {/* ✅ Aquí se renderizan las rutas hijas: /portal-apoderado/cambiar-clave, etc */}
      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  );
}
