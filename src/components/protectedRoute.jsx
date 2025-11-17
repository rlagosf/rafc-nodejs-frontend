// src/components/ProtectedRoute.jsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

const TOKEN_KEY = 'rafc_token';

export default function ProtectedRoute({ children, roleIn = [] }) {
  const location = useLocation();
  const token = localStorage.getItem(TOKEN_KEY);

  const toLogin = (
    <Navigate
      to="/login"
      replace
      state={{ from: location.pathname || '/admin' }}
    />
  );

  if (!token) return toLogin;

  try {
    const decoded = jwtDecode(token);
    const now = Math.floor(Date.now() / 1000);

    // margen 30s
    if (decoded?.exp && now >= decoded.exp - 30) {
      localStorage.removeItem(TOKEN_KEY);
      return toLogin;
    }

    const rawRol = decoded?.rol_id ?? decoded?.role_id ?? decoded?.role;
    const rol = Number.isFinite(Number(rawRol)) ? Number(rawRol) : 0;

    if (roleIn.length > 0 && !roleIn.includes(rol)) {
      return <Navigate to="/admin" replace />;
    }

    return children ? children : <Outlet />;
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    return toLogin;
  }
}
