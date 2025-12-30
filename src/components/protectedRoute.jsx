import { Navigate, Outlet, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

const TOKEN_KEY = "rafc_token";

export default function ProtectedRoute({ children, roleIn = [], mode = "admin" }) {
  const location = useLocation();
  const token = localStorage.getItem(TOKEN_KEY);

  const adminHome = "/admin";
  const apoderadoHome = "/portal-apoderado";
  const apoderadoChange = "/portal-apoderado/cambiar-clave";

  const toLoginAdmin = (
    <Navigate to="/login" replace state={{ from: location.pathname || adminHome }} />
  );

  const toLoginApoderado = (
    <Navigate
      to="/login-apoderado"
      replace
      state={{ from: location.pathname || apoderadoHome }}
    />
  );

  const safeClear = () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem("user_info");
      localStorage.removeItem("apoderado_must_change_password");
    } catch {}
  };

  if (!token) return mode === "apoderado" ? toLoginApoderado : toLoginAdmin;

  try {
    const decoded = jwtDecode(token);
    const now = Math.floor(Date.now() / 1000);

    // ✅ Token vencido (margen 30s)
    if (decoded?.exp && now >= decoded.exp - 30) {
      safeClear();
      return mode === "apoderado" ? toLoginApoderado : toLoginAdmin;
    }

    // ---------------------------
    // ✅ MODO APODERADO
    // ---------------------------
    if (mode === "apoderado") {
      // Si no es token apoderado → login apoderado
      if (decoded?.type !== "apoderado") return toLoginApoderado;

      // Forzar cambio de clave (global para todo el portal)
      let mustChange = false;
      try {
        mustChange = localStorage.getItem("apoderado_must_change_password") === "1";
      } catch {}

      const path = String(location.pathname || "");
      const isInsidePortal = path.startsWith(apoderadoHome);
      const isChangeRoute = path.startsWith(apoderadoChange);

      // Si está en el portal y debe cambiar clave → solo deja pasar a /cambiar-clave
      if (isInsidePortal && mustChange && !isChangeRoute) {
        return <Navigate to={apoderadoChange} replace />;
      }

      // Si NO debe cambiar y está en /cambiar-clave, lo mandamos al dashboard
      if (isInsidePortal && !mustChange && isChangeRoute) {
        return <Navigate to={apoderadoHome} replace />;
      }

      return children ? children : <Outlet />;
    }

    // ---------------------------
    // ✅ MODO ADMIN
    // ---------------------------
    // Si es token apoderado intentando entrar al admin, mándalo al portal
    if (decoded?.type === "apoderado") {
      return <Navigate to={apoderadoHome} replace />;
    }

    const rawRol = decoded?.rol_id ?? decoded?.role_id ?? decoded?.role;
    const rol = Number.isFinite(Number(rawRol)) ? Number(rawRol) : 0;

    if (roleIn.length > 0 && !roleIn.includes(rol)) {
      return <Navigate to={adminHome} replace />;
    }

    return children ? children : <Outlet />;
  } catch {
    safeClear();
    return mode === "apoderado" ? toLoginApoderado : toLoginAdmin;
  }
}
