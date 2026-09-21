import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/features/auth";

export function MasterRoute() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  // No hay sesión autenticada.
  // Guardamos la ruta de destino para poder recuperarla después del login.
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    );
  }

  // El usuario está autenticado, pero no tiene rol MASTER.
  // No debe poder acceder al panel administrativo.
  if (user?.rolGlobal !== "MASTER") {
    return <Navigate to="/" replace />;
  }

  // Usuario autenticado y con rol MASTER.
  return <Outlet />;
}