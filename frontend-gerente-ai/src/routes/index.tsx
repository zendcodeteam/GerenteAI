import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageSkeleton } from "@/shared/components/ui/PageSkeleton";
import { useAuth } from "@/features/auth";
import { GuestRoute } from "./GuestRoute";
import { ProtectedRoute } from "./ProtectedRoute";
import { MasterRoute } from "./MasterRoute";
import {
  FeaturesPage,
  LandingPageView,
} from "@/features/landing-page";

// ============================================================
// LAZY LOADED FEATURE MODULES
// ============================================================

const DashboardPage = lazy(() =>
  import("@/features/client-dashboard").then((m) => ({
    default: m.DashboardView,
  }))
);

const InsightsPage = lazy(() =>
  import("@/features/client-insights").then((m) => ({
    default: m.InsightsView,
  }))
);

const CashflowPage = lazy(() =>
  import("@/features/client-cashflow").then((m) => ({
    default: m.CashflowView,
  }))
);

const SubscriptionPage = lazy(() =>
  import("@/features/client-subscription").then((m) => ({
    default: m.SubscriptionView,
  }))
);

const PagoResultadoPage = lazy(() =>
  import("@/features/client-subscription").then((m) => ({
    default: m.PagoResultadoView,
  }))
);

const ManageSubscriptionPage = lazy(() =>
  import("@/features/client-manage-subscription").then((m) => ({
    default: m.ManageSubscriptionView,
  }))
);

const ProfilePage = lazy(() =>
  import("@/features/shared-profile").then((m) => ({
    default: m.ProfileView,
  }))
);

const AdminDashboardLayout = lazy(() =>
  import("@/features/admin-dashboard").then((m) => ({
    default: m.AdminDashboardLayout,
  }))
);

const AdminCrmView = lazy(() =>
  import("@/features/admin-crm").then((m) => ({
    default: m.AdminCrmView,
  }))
);

const AdminOpsView = lazy(() =>
  import("@/features/admin-ops").then((m) => ({
    default: m.AdminOpsView,
  }))
);

const LoginPage = lazy(() =>
  import("@/features/auth").then((m) => ({
    default: m.LoginPage,
  }))
);

const RegisterPage = lazy(() =>
  import("@/features/auth").then((m) => ({
    default: m.RegisterPage,
  }))
);

const VerificarEmailPage = lazy(() =>
  import("@/features/auth").then((m) => ({
    default: m.VerificarEmailPage,
  }))
);

const ForgotPasswordPage = lazy(() =>
  import("@/features/auth").then((m) => ({
    default: m.ForgotPasswordPage,
  }))
);

const ResetPasswordPage = lazy(() =>
  import("@/features/auth").then((m) => ({
    default: m.ResetPasswordPage,
  }))
);

// ============================================================
// MFA
// PUEDE ACCEDERSE SIN JWT FINAL
// ============================================================

const MfaPage = lazy(() =>
  import("@/features/auth").then((m) => ({
    default: m.MfaPage,
  }))
);

// ============================================================
// LEGAL PAGES
// PUBLIC - NO REQUIEREN AUTENTICACIÓN
// ============================================================

const TerminosPage = lazy(() =>
  import("@/features/legal").then((m) => ({
    default: m.TerminosPage,
  }))
);

const PrivacidadPage = lazy(() =>
  import("@/features/legal").then((m) => ({
    default: m.PrivacidadPage,
  }))
);

// ============================================================
// INVESTOR DASHBOARD
// PUBLIC - NO REQUIERE AUTENTICACIÓN
// ============================================================

const InvestorDashboardPage = lazy(() =>
  import("@/features/investor-dashboard").then((m) => ({
    default: m.InvestorDashboardView,
  }))
);

// ============================================================
// ROUTES
// ============================================================

export function AppRoutes() {
  return (
    <Routes>
      {/* ======================================================
          GUEST ONLY ROUTES
          Redirects to /dashboard if logged in
          ====================================================== */}
      <Route element={<GuestRoute />}>
        <Route
          path="/login"
          element={
            <Suspense fallback={<PageSkeleton />}>
              <LoginPage />
            </Suspense>
          }
        />

        <Route
          path="/register"
          element={
            <Suspense fallback={<PageSkeleton />}>
              <RegisterPage />
            </Suspense>
          }
        />

        <Route
          path="/forgot-password"
          element={
            <Suspense fallback={<PageSkeleton />}>
              <ForgotPasswordPage />
            </Suspense>
          }
        />

        <Route
          path="/recuperar-password"
          element={
            <Navigate
              to="/forgot-password"
              replace
            />
          }
        />
      </Route>

      {/* ======================================================
          MFA

          IMPORTANTE:
          Esta ruta NO está dentro de GuestRoute ni ProtectedRoute.

          Durante MFA el MASTER todavía no posee el JWT definitivo.
          MfaPage se encarga de comprobar si existe un flujo MFA
          pendiente en AuthContext.
          ====================================================== */}
      <Route
        path="/mfa"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <MfaPage />
          </Suspense>
        }
      />

      {/* ======================================================
          TOKEN & EMAIL VERIFICATION ROUTES
          Always Accessible
          ====================================================== */}

      <Route
        path="/verificar-email"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <VerificarEmailPage />
          </Suspense>
        }
      />

      <Route
        path="/restablecer-password"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <ResetPasswordPage />
          </Suspense>
        }
      />

      <Route
        path="/reset-password"
        element={
          <Navigate
            to="/restablecer-password"
            replace
          />
        }
      />

      {/* ======================================================
          PUBLIC LANDING ROUTES
          ====================================================== */}

      {/* Home */}
      <Route
        path="/home"
        element={<LandingPageView />}
      />

      {/* Características */}
      <Route
        path="/caracteristicas"
        element={<FeaturesPage />}
      />

      {/* ======================================================
          LEGAL ROUTES
          PUBLIC - ACCESSIBLE WITHOUT AUTHENTICATION
          ====================================================== */}

      {/* Términos de servicio */}
      <Route
        path="/terminos"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <TerminosPage />
          </Suspense>
        }
      />

      {/* Política de privacidad */}
      <Route
        path="/privacidad"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <PrivacidadPage />
          </Suspense>
        }
      />

      {/* Investor Dashboard público */}
      <Route
        path="/investors"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <InvestorDashboardPage />
          </Suspense>
        }
      />

      {/* =========================================================
          PROTECTED ROUTES

          Todo lo que esté dentro de este Route requiere
          autenticación.
          ====================================================== */}

      <Route element={<ProtectedRoute />}>
        {/* =====================================================
            MAIN APPLICATION
            ===================================================== */}

        <Route path="/" element={<AppLayout />}>
          <Route
            index
            element={
              <Suspense fallback={<PageSkeleton />}>
                <DashboardPage />
              </Suspense>
            }
          />

          {/* Insights */}
          <Route
            path="insights"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <InsightsPage />
              </Suspense>
            }
          />

          {/* Cashflow */}
          <Route
            path="cashflow"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <CashflowPage />
              </Suspense>
            }
          />

          {/* Subscription */}
          <Route
            path="subscription"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <SubscriptionPage />
              </Suspense>
            }
          />

          {/* Vuelta del checkout de Wompi.
              Va dentro de las rutas protegidas porque
              consulta el pago con el token del usuario. */}
          <Route
            path="pago/resultado"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <PagoResultadoPage />
              </Suspense>
            }
          />

          {/* Manage Subscription */}
          <Route
            path="manage-subscription"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <ManageSubscriptionPage />
              </Suspense>
            }
          />

          {/* Profile */}
          <Route
            path="profile"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <ProfilePage />
              </Suspense>
            }
          />

          {/* Dashboard alias */}
          <Route
            path="dashboard"
            element={
              <Navigate
                to="/"
                replace
              />
            }
          />

          {/* Settings alias */}
          <Route
            path="settings"
            element={
              <Navigate
                to="/profile"
                replace
              />
            }
          />

          {/* ==================================================
              ADMIN ROUTES

              Requieren autenticación + rol MASTER.
              ================================================== */}

          <Route element={<MasterRoute />}>
            <Route
              path="admin"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <AdminDashboardLayout />
                </Suspense>
              }
            >
              {/* /admin → /admin/crm */}
              <Route
                index
                element={
                  <Navigate
                    to="crm"
                    replace
                  />
                }
              />

              {/* Admin CRM */}
              <Route
                path="crm"
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <AdminCrmView />
                  </Suspense>
                }
              />

              {/* Admin Operations */}
              <Route
                path="ops"
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <AdminOpsView />
                  </Suspense>
                }
              />
            </Route>
          </Route>
        </Route>
      </Route>

      {/* ======================================================
          CATCH-ALL FALLBACK

          - No autenticado: Redirige de inmediato a /login
          - Autenticado: Redirige al Dashboard principal (/)
          ====================================================== */}

      <Route
        path="*"
        element={<FallbackRoute />}
      />
    </Routes>
  );
}

/**
 * Redirige cualquier ruta no autorizada o inexistente según
 * el estado de sesión:
 *
 * - Invitado / No autenticado -> /login
 * - Usuario con sesión -> / (Dashboard)
 */
function FallbackRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (isAuthenticated) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return (
    <Navigate
      to="/login"
      replace
    />
  );
}