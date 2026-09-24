import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/features/auth";

export function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    if (location.pathname === "/") {
      return (
        <Navigate
          to="/home"
          replace
        />
      );
    }

    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    );
  }

  return <Outlet />;
}