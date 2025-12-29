import { Navigate, Outlet, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

const TOKEN_KEY = "rafc_token";

export default function ProtectedRoute({ children, roleIn = [], mode = "admin" }) {
  const location = useLocation();
  const token = localStorage.getItem(TOKEN_KEY);

  const toLoginAdmin = (
    <Navigate to="/login" replace state={{ from: location.pathname || "/admin" }} />
  );

  const toLoginApoderado = (
    <Navigate
      to="/login-apoderado"
      replace
      state={{ from: location.pathname || "/portal-apoderado" }}
    />
  );

  const toLogin = mode === "apoderado" ? toLoginApoderado : toLoginAdmin;

  if (!token) return toLogin;

  try {
    const decoded = jwtDecode(token);
    const now = Math.floor(Date.now() / 1000);

    // margen 30s
    if (decoded?.exp && now >= decoded.exp - 30) {
      localStorage.removeItem(TOKEN_KEY);
      try {
        localStorage.removeItem("user_info");
        localStorage.removeItem("apoderado_must_change_password");
      } catch {}
      return toLogin;
    }

    // ---------------------------
    // MODO APODERADO
    // ---------------------------
    if (mode === "apoderado") {
      if (decoded?.type !== "apoderado") return toLoginApoderado;

      // Forzar cambio de clave si corresponde
      const mustChange = (() => {
        try {
          return localStorage.getItem("apoderado_must_change_password") === "1";
        } catch {
          return false;
        }
      })();

      const isChangeRoute = String(location.pathname || "").includes(
        "/portal-apoderado/cambiar-clave"
      );

      if (mustChange && !isChangeRoute) {
        return <Navigate to="/portal-apoderado/cambiar-clave" replace />;
      }

      return children ? children : <Outlet />;
    }

    // ---------------------------
    // MODO ADMIN (tu lógica actual)
    // ---------------------------
    // si es token de apoderado intentando entrar al admin
    if (decoded?.type === "apoderado") return toLoginAdmin;

    const rawRol = decoded?.rol_id ?? decoded?.role_id ?? decoded?.role;
    const rol = Number.isFinite(Number(rawRol)) ? Number(rawRol) : 0;

    if (roleIn.length > 0 && !roleIn.includes(rol)) {
      return <Navigate to="/admin" replace />;
    }

    return children ? children : <Outlet />;
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    try {
      localStorage.removeItem("user_info");
      localStorage.removeItem("apoderado_must_change_password");
    } catch {}
    return toLogin;
  }
}
