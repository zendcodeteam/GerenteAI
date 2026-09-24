import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  Building2,
  MapPin,
  ChevronDown,
  Check,
  User,
  CreditCard,
  ShieldCheck,
  LogOut,
  LayoutDashboard,
  Bot,
  TrendingUp,
  Briefcase,
  Server,
  Layers,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationCenter } from "./NotificationCenter";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { usePlanPermissions } from "@/shared/hooks/usePlanPermissions";
import { apiClient } from "@/lib/apiClient";
import { profileApi } from "@/features/shared-profile/api/profileApi";
import { LukaIconBadge } from "@/shared/components/ui/LukaIconBadge";

interface NegocioItem {
  id: string;
  nombre: string;
}

interface SedeItem {
  id: string;
  nombre: string;
  direccion?: string | null;
  telefono?: string | null;
  whatsappUsername?: string | null;
}

interface UsuarioMeResponse {
  negocios: Array<{
    negocio: {
      id: string;
      nombre: string;
    };
  }>;
}

export function GlobalNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, token } = useAuth();
  const { planUsuarioId } = usePlanPermissions();

  const isAdmin =
    location.pathname.startsWith("/admin") ||
    user?.rolGlobal === "MASTER";

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSedeDropdownOpen, setIsSedeDropdownOpen] = useState(false);

  const [negocios, setNegocios] = useState<NegocioItem[]>([]);
  const [sedes, setSedes] = useState<SedeItem[]>([]);

  const [activeBusinessName, setActiveBusinessName] =
    useState<string>(() => {
      return (
        localStorage.getItem("active_business_name") ||
        "Mi Negocio"
      );
    });

  const [activeBusinessId, setActiveBusinessId] =
    useState<string>(() => {
      return (
        localStorage.getItem("active_business_id") || ""
      );
    });

  const [activeSedeName, setActiveSedeName] =
    useState<string>(() => {
      return (
        localStorage.getItem("active_sede_name") ||
        "Todas las sedes"
      );
    });

  const [activeSedeId, setActiveSedeId] =
    useState<string>(() => {
      return (
        localStorage.getItem("active_sede_id") || "all"
      );
    });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const sedeDropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    setIsDropdownOpen(false);
    logout();
    navigate("/login", { replace: true });
  };

  // ============================================================
  // Cargar sedes del negocio activo
  // ============================================================

  const loadSedesForBusiness = async (negocioId: string) => {
    if (!negocioId) {
      setSedes([]);
      return;
    }

    try {
      const data = await profileApi.getSedes(negocioId);

      setSedes(data || []);

      const savedSedeId =
        localStorage.getItem("active_sede_id");

      if (savedSedeId === "all" || !savedSedeId) {
        setActiveSedeId("all");
        setActiveSedeName("Todas las sedes");

        localStorage.setItem(
          "active_sede_id",
          "all"
        );

        localStorage.setItem(
          "active_sede_name",
          "Todas las sedes"
        );
      } else {
        const found = (data || []).find(
          (s: SedeItem) => s.id === savedSedeId
        );

        if (found) {
          setActiveSedeId(found.id);
          setActiveSedeName(found.nombre);

          localStorage.setItem(
            "active_sede_id",
            found.id
          );

          localStorage.setItem(
            "active_sede_name",
            found.nombre
          );
        } else if (data && data.length > 0) {
          setActiveSedeId(data[0].id);
          setActiveSedeName(data[0].nombre);

          localStorage.setItem(
            "active_sede_id",
            data[0].id
          );

          localStorage.setItem(
            "active_sede_name",
            data[0].nombre
          );
        } else {
          setActiveSedeId("all");
          setActiveSedeName("Todas las sedes");

          localStorage.setItem(
            "active_sede_id",
            "all"
          );

          localStorage.setItem(
            "active_sede_name",
            "Todas las sedes"
          );
        }
      }
    } catch (err) {
      console.warn(
        "Error cargando sedes para el negocio:",
        err
      );

      setSedes([]);
    }
  };

  // ============================================================
  // Cargar negocios permitidos
  //
  // El selector de negocios ya NO existe visualmente en la
  // navbar. Sin embargo, necesitamos conocer el negocio activo
  // para cargar correctamente sus sedes.
  // ============================================================

  useEffect(() => {
    if (!token) return;

    apiClient<UsuarioMeResponse>("/auth/usuarios/me")
      .then((data) => {
        const userBusinesses =
          data.negocios?.map((n) => n.negocio) || [];

        if (userBusinesses.length > 0) {
          setNegocios(userBusinesses);

          const savedId = localStorage.getItem(
            "active_business_id"
          );

          const matched =
            userBusinesses.find(
              (n) => n.id === savedId
            ) || userBusinesses[0];

          setActiveBusinessId(matched.id);
          setActiveBusinessName(matched.nombre);

          localStorage.setItem(
            "active_business_id",
            matched.id
          );

          localStorage.setItem(
            "active_business_name",
            matched.nombre
          );

          loadSedesForBusiness(matched.id);
        } else {
          setNegocios([]);
          setSedes([]);

          setActiveBusinessId("");
          setActiveBusinessName("Sin Negocio");

          setActiveSedeId("all");
          setActiveSedeName("Sin Sede");

          localStorage.removeItem(
            "active_business_id"
          );

          localStorage.removeItem(
            "active_business_name"
          );

          localStorage.removeItem(
            "active_sede_id"
          );

          localStorage.removeItem(
            "active_sede_name"
          );
        }
      })
      .catch((err) => {
        console.warn(
          "No se pudieron cargar los negocios en el navbar:",
          err
        );
      });
  }, [token]);

  // ============================================================
  // Sincronización de negocio y sede entre componentes
  // ============================================================

  useEffect(() => {
    const handleBusinessSync = () => {
      const savedName = localStorage.getItem(
        "active_business_name"
      );

      const savedId = localStorage.getItem(
        "active_business_id"
      );

      if (savedName) {
        setActiveBusinessName(savedName);
      }

      if (
        savedId &&
        savedId !== activeBusinessId
      ) {
        setActiveBusinessId(savedId);
        loadSedesForBusiness(savedId);
      }
    };

    const handleSedeSync = () => {
      const savedSedeName =
        localStorage.getItem("active_sede_name");

      const savedSedeId =
        localStorage.getItem("active_sede_id");

      if (savedSedeName) {
        setActiveSedeName(savedSedeName);
      }

      if (savedSedeId) {
        setActiveSedeId(savedSedeId);
      }
    };

    window.addEventListener(
      "business_changed",
      handleBusinessSync
    );

    window.addEventListener(
      "sede_changed",
      handleSedeSync
    );

    return () => {
      window.removeEventListener(
        "business_changed",
        handleBusinessSync
      );

      window.removeEventListener(
        "sede_changed",
        handleSedeSync
      );
    };
  }, [activeBusinessId]);

  // ============================================================
  // Seleccionar sede
  // ============================================================

  const handleSelectSede = (
    sedeId: string,
    nombre: string
  ) => {
    setActiveSedeId(sedeId);
    setActiveSedeName(nombre);

    localStorage.setItem(
      "active_sede_id",
      sedeId
    );

    localStorage.setItem(
      "active_sede_name",
      nombre
    );

    setIsSedeDropdownOpen(false);

    window.dispatchEvent(
      new Event("sede_changed")
    );
  };

  // ============================================================
  // Cerrar dropdowns al hacer click fuera
  // ============================================================

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(
          event.target as Node
        )
      ) {
        setIsDropdownOpen(false);
      }

      if (
        sedeDropdownRef.current &&
        !sedeDropdownRef.current.contains(
          event.target as Node
        )
      ) {
        setIsSedeDropdownOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
  }, []);

  // ============================================================
  // Navegación principal
  // ============================================================

  const clientNav = [
    {
      id: "/",
      Icon: LayoutDashboard,
      label: "Resumen",
      mobileLabel: "Resumen",
    },
    {
      id: "/insights",
      Icon: Bot,
      label: "Recomendaciones de IA",
      mobileLabel: "Recomendaciones",
      badge: planUsuarioId >= 2 ? 2 : undefined,
    },
    {
      id: "/cashflow",
      Icon: TrendingUp,
      label: "Flujo de Caja",
      mobileLabel: "Flujo de Caja",
    },
  ];

  const adminNav = [
    {
      id: "/admin/crm",
      Icon: Briefcase,
      label: "Negocio (CRM)",
      mobileLabel: "Negocio",
    },
    {
      id: "/admin/ops",
      Icon: Server,
      label: "Sistema (Ops)",
      mobileLabel: "Sistema",
    },
  ];

  const nav: Array<{
    id: string;
    Icon: any;
    label: string;
    mobileLabel: string;
    badge?: number;
  }> = isAdmin ? adminNav : clientNav;

  return (
    <>
      <header className="bg-card dark:bg-muted/10 border-b border-border shrink-0 relative z-30">
        {/* ======================================================
            GLOBAL NAVBAR (TOP BAR)
        ====================================================== */}
        <div className="relative flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3 min-h-[64px] sm:min-h-[74px]">
          {/* ====================================================
              LEFT: LOGO + NOTIFICACIONES + THEME
          ==================================================== */}
          <div className="flex items-center gap-3 sm:gap-6 shrink-0">
            {/* Logo */}
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 cursor-pointer">
              <img
                src="/Luka.png"
                alt="Luka AI"
                className="w-8 h-8 sm:w-9 sm:h-9 object-contain"
              />

              <span className="text-lg sm:text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500">
                Luka AI
              </span>
            </Link>

            <div className="hidden sm:block w-px h-6 bg-border" />

            {/* Notificaciones + Theme */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Notificaciones */}
              <NotificationCenter
                businessId={activeBusinessId}
                sedeId={activeSedeId}
                enabled={!isAdmin}
              />

              {/* Tema */}
              <ThemeToggle />
            </div>
          </div>

          {/* ====================================================
              CENTER: NAVBAR PRINCIPAL (SOLO DESKTOP >= 1024px)
          ==================================================== */}
          <nav className="hidden lg:flex absolute left-1/2 -translate-x-1/2 items-center gap-1.5 p-1.5 bg-muted/40 border border-border rounded-2xl">
            {nav.map(
              ({
                id,
                Icon,
                label,
                badge,
              }) => {
                const isActive =
                  location.pathname === id ||
                  (id === "/" &&
                    location.pathname === "");

                return (
                  <Link
                    key={id}
                    to={id}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-all duration-300 ${
                      isActive
                        ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-500/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                    }`}
                  >
                    <LukaIconBadge
                      icon={Icon}
                      tone={isActive ? "emerald" : "cyan"}
                      size="sm"
                    />

                    {label}

                    {badge && (
                      <span
                        className={`ml-1.5 text-[10px] font-black rounded-full px-2 py-0.5 transition-colors ${
                          isActive
                            ? "bg-emerald-500 text-white"
                            : "bg-muted-foreground/20 text-muted-foreground"
                        }`}
                      >
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              }
            )}
          </nav>

          {/* ====================================================
              RIGHT: TODAS LAS SEDES + USUARIO
          ==================================================== */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 text-sm font-semibold ml-auto shrink-0">
            {!isAdmin && (
              <>
                {/* =================================================
                    SELECTOR DE SEDES
                ================================================= */}
                <div
                  className="relative"
                  ref={sedeDropdownRef}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIsSedeDropdownOpen(
                        !isSedeDropdownOpen
                      );
                    }}
                    className="flex items-center gap-1 sm:gap-1.5 text-muted-foreground hover:text-foreground transition-colors bg-muted/50 hover:bg-muted/80 px-2 sm:px-3 py-1.5 rounded-lg border border-border cursor-pointer text-xs font-bold"
                    title="Sede Activa"
                  >
                    <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />

                    <span className="hidden sm:inline sm:max-w-[110px] md:max-w-[140px] truncate">
                      {activeSedeName}
                    </span>

                    <ChevronDown
                      className={`w-3 h-3 text-muted-foreground/60 transition-transform ${
                        isSedeDropdownOpen
                          ? "rotate-180"
                          : ""
                      }`}
                    />
                  </button>

                  {isSedeDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-24px)] bg-card border border-border rounded-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
                      {/* Título */}
                      <div className="px-4 py-2 border-b border-border text-[11px] font-bold text-muted-foreground uppercase flex items-center justify-between">
                        <span>
                          Sedes de{" "}
                          {activeBusinessName}
                        </span>

                        <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                      </div>

                      {/* Todas las sedes */}
                      <button
                        type="button"
                        onClick={() =>
                          handleSelectSede(
                            "all",
                            "Todas las sedes"
                          )
                        }
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-xs sm:text-sm font-medium text-left hover:bg-muted transition-colors cursor-pointer border-b border-border/50 ${
                          activeSedeId === "all"
                            ? "text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50/50 dark:bg-emerald-500/5"
                            : "text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5 text-emerald-500" />

                          <span>
                            Todas las sedes
                            (Consolidado)
                          </span>
                        </div>

                        {activeSedeId ===
                          "all" && (
                          <Check className="w-4 h-4 text-emerald-500" />
                        )}
                      </button>

                      {/* Sedes individuales */}
                      {sedes.length > 0 ? (
                        sedes.map((sede) => (
                          <button
                            type="button"
                            key={sede.id}
                            onClick={() =>
                              handleSelectSede(
                                sede.id,
                                sede.nombre
                              )
                            }
                            className={`w-full flex items-center justify-between px-4 py-2.5 text-xs sm:text-sm font-medium text-left hover:bg-muted transition-colors cursor-pointer ${
                              activeSedeId ===
                              sede.id
                                ? "text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50/50 dark:bg-emerald-500/5"
                                : "text-foreground"
                            }`}
                          >
                            <div className="truncate">
                              <div className="truncate font-semibold">
                                {sede.nombre}
                              </div>

                              {sede.direccion && (
                                <div className="text-[10px] text-muted-foreground truncate">
                                  {sede.direccion}
                                </div>
                              )}
                            </div>

                            {activeSedeId ===
                              sede.id && (
                              <Check className="w-4 h-4 text-emerald-500 shrink-0 ml-2" />
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-xs text-muted-foreground">
                          No hay sedes registradas
                          para este negocio.
                        </div>
                      )}

                      {/* =================================================
                          ACCIONES DE PERFIL
                      ================================================= */}
                      <div className="p-2 border-t border-border mt-1 space-y-2">
                        {/* Gestionar sedes */}
                        <Link
                          to="/profile"
                          onClick={() =>
                            setIsSedeDropdownOpen(
                              false
                            )
                          }
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold text-xs transition-colors cursor-pointer shadow-xs"
                        >
                          <MapPin className="w-3.5 h-3.5" />

                          <span>
                            Gestionar sedes en
                            perfil
                          </span>
                        </Link>

                        {/* Administrar negocios */}
                        <Link
                          to="/profile"
                          onClick={() =>
                            setIsSedeDropdownOpen(
                              false
                            )
                          }
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-muted/60 hover:bg-muted text-foreground font-bold text-xs transition-colors cursor-pointer shadow-xs"
                        >
                          <Building2 className="w-3.5 h-3.5" />

                          <span>
                            Administrar negocios
                          </span>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* =====================================================
                USUARIO / NEGOCIO REGISTRADO
            ===================================================== */}
            <div
              className="relative"
              ref={dropdownRef}
            >
              <button
                type="button"
                onClick={() =>
                  setIsDropdownOpen(
                    !isDropdownOpen
                  )
                }
                className="flex items-center gap-1.5 sm:gap-2 text-emerald-800 dark:text-emerald-100 hover:text-emerald-900 transition-colors bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-emerald-500/20 shadow-xs cursor-pointer text-xs sm:text-sm"
                title="Menú de Usuario"
              >
                <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />

                <span className="hidden sm:inline font-semibold max-w-[100px] md:max-w-[140px] truncate">
                  {user?.nombre || "Grupo Caishen"}
                </span>

                <ChevronDown
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform ${
                    isDropdownOpen
                      ? "rotate-180"
                      : ""
                  }`}
                />
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-24px)] bg-card border border-border rounded-2xl shadow-lg py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-2 border-b border-border sm:hidden">
                    <p className="text-xs font-bold text-foreground truncate">
                      {user?.nombre || "Usuario"}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {user?.email || ""}
                    </p>
                  </div>

                  <Link
                    to={
                      isAdmin
                        ? "/profile?admin=true"
                        : "/profile"
                    }
                    onClick={() =>
                      setIsDropdownOpen(false)
                    }
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <User className="w-4 h-4" />
                    Perfil
                  </Link>

                  <Link
                    to="/subscription"
                    onClick={() =>
                      setIsDropdownOpen(false)
                    }
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <CreditCard className="w-4 h-4" />
                    Planes de suscripción
                  </Link>

                  <Link
                    to="/manage-subscription"
                    onClick={() =>
                      setIsDropdownOpen(false)
                    }
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Administrar suscripción
                  </Link>

                  <div className="h-px bg-border my-2" />

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ====================================================
            MOBILE SUB-NAVBAR (SOLO MOBILE & TABLET < 1024px)
            Ubicada arriba, directamente debajo de la barra principal
        ==================================================== */}
        <div className="lg:hidden border-t border-border/60 bg-muted/20 px-2 sm:px-4 py-2">
          <nav className="flex items-center justify-center gap-1.5 sm:gap-2">
            {nav.map(
              ({
                id,
                Icon,
                label,
                mobileLabel,
                badge,
              }) => {
                const isActive =
                  location.pathname === id ||
                  (id === "/" &&
                    location.pathname === "");

                return (
                  <Link
                    key={id}
                    to={id}
                    className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all duration-300 ${
                      isActive
                        ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 shadow-xs ring-1 ring-emerald-500/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                    }`}
                  >
                    <LukaIconBadge
                      icon={Icon}
                      tone={isActive ? "emerald" : "cyan"}
                      size="sm"
                    />

                    <span className="truncate max-w-[90px] sm:max-w-[110px]">{mobileLabel}</span>

                    {badge && (
                      <span
                        className={`ml-1 text-[9px] font-black rounded-full px-1.5 py-0.2 transition-colors ${
                          isActive
                            ? "bg-emerald-500 text-white"
                            : "bg-muted-foreground/20 text-muted-foreground"
                        }`}
                      >
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              }
            )}
          </nav>
        </div>
      </header>
    </>
  );
}