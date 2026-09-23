import { Suspense, useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router";
import { GlobalNavbar } from "@/shared/components/layout/GlobalNavbar";
import { GlobalFooter } from "@/shared/components/layout/GlobalFooter";
import { PageSkeleton } from "@/shared/components/ui/PageSkeleton";
import { LukaDynamicAtmosphere } from "@/features/landing-page/components/LukaDynamicAtmosphere";

export function AppLayout() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Al cambiar de ruta o parámetros, asegurar scroll instantáneo al inicio
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [location.pathname, location.search]);
  
  return (
    <div
      className="relative h-screen w-full overflow-hidden bg-background flex flex-col text-foreground font-sans"
    >
      <LukaDynamicAtmosphere />
      <div className="luka-dashboard-gradient" aria-hidden="true" />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <GlobalNavbar />
        <main ref={mainRef} className="flex-1 overflow-auto">
          <div key={location.pathname} className="max-w-[1400px] mx-auto w-full p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-300">
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </div>
          <GlobalFooter />
        </main>
      </div>
    </div>
  );
}
