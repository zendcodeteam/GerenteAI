import { useEffect, useState } from "react";
import { Bell, CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { Link } from "react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { dashboardApi } from "@/features/client-dashboard/api/dashboardApi";

type NotificationItem = {
  id: string;
  title: string;
  description: string;
  tone: "warning" | "danger";
  href: string;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

export function NotificationCenter({
  businessId,
  sedeId,
  enabled = true,
}: {
  businessId: string;
  sedeId: string;
  enabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (!enabled || !businessId) {
      setNotifications([]);
      return;
    }

    let cancelled = false;

    const loadNotifications = async () => {
      setIsLoading(true);

      try {
        const [report, fiados] = await Promise.all([
          sedeId && sedeId !== "all"
            ? dashboardApi.getReporteSede(sedeId, "semanal")
            : dashboardApi.getReporteNegocio(businessId, "semanal"),
          sedeId && sedeId !== "all"
            ? dashboardApi.getFiados(sedeId)
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        const nextNotifications: NotificationItem[] = [];

        if (fiados && fiados.totales.porCobrar > 0) {
          nextNotifications.push({
            id: "cartera-pendiente",
            title: "Tienes dinero pendiente por cobrar",
            description: `${formatCurrency(fiados.totales.porCobrar)} en ${fiados.totales.clientesConDeuda} cliente${fiados.totales.clientesConDeuda === 1 ? "" : "s"}.`,
            tone: "warning",
            href: "/",
          });
        }

        if (report.balance < 0) {
          nextNotifications.push({
            id: "balance-negativo",
            title: "El flujo de esta semana está en negativo",
            description: `Los egresos superan los ingresos por ${formatCurrency(Math.abs(report.balance))}.`,
            tone: "danger",
            href: "/cashflow",
          });
        }

        if (report.informativo.conteos.ventas === 0) {
          nextNotifications.push({
            id: "sin-ventas",
            title: "No hay ventas registradas esta semana",
            description: "Revisa tus movimientos o registra la actividad pendiente.",
            tone: "warning",
            href: "/",
          });
        }

        setNotifications(nextNotifications);
      } catch {
        if (!cancelled) setNotifications([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadNotifications();

    return () => {
      cancelled = true;
    };
  }, [businessId, enabled, sedeId]);

  if (!enabled) return null;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:h-9 sm:w-9"
          title="Notificaciones"
          aria-label={`Notificaciones${notifications.length ? `, ${notifications.length} pendientes` : ""}`}
        >
          <Bell className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2} />
          {notifications.length > 0 && (
            <span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive sm:right-2.5 sm:top-2" />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={10} className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <DropdownMenuLabel className="px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold">Lo que requiere tu atención</p>
              <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                Alertas financieras de tu negocio
              </p>
            </div>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="max-h-80 overflow-y-auto p-2">
          {!isLoading && notifications.length === 0 && (
            <div className="flex items-start gap-3 px-3 py-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
              <div>
                <p className="text-sm font-semibold">Todo está bajo control</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  No encontramos alertas financieras nuevas para este periodo.
                </p>
              </div>
            </div>
          )}

          {notifications.map((notification) => (
            <Link
              key={notification.id}
              to={notification.href}
              onClick={() => setIsOpen(false)}
              className="flex items-start gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted"
            >
              <CircleAlert
                className={`mt-0.5 h-5 w-5 shrink-0 ${
                  notification.tone === "danger" ? "text-destructive" : "text-amber-500"
                }`}
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{notification.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {notification.description}
                </p>
                <span className="mt-2 inline-block text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  Revisar ahora
                </span>
              </div>
            </Link>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}