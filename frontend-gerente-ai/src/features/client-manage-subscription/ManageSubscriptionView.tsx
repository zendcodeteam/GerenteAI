import { useEffect, useState } from "react";
import { 
  Zap, 
  ShieldCheck, 
  CreditCard as CardIcon, 
  Phone, 
  Sparkles, 
  LayoutDashboard,
  MessageCircle
} from "lucide-react";
import { Link } from "react-router";
import { lukaWhatsappUrl } from "@/lib/whatsapp";
import { assistantApi } from "@/features/assistant/api/assistantApi";
import { historialDePagos } from "@/features/client-subscription/services/pagosApi";
import type { Pago } from "@/features/client-subscription/services/pagosApi";
import { profileApi } from "@/features/shared-profile/api/profileApi";
import type { Sede } from "@/features/shared-profile/types";
import { 
  planesApi, 
  PlanBackend, 
  PLANES_FALLBACK 
} from "@/shared/api/planesApi";

const PRECIO_FORMATTER = new Intl.NumberFormat("es-CO");

export function ManageSubscriptionView() {
  const [catalogo, setCatalogo] = useState<PlanBackend[]>(PLANES_FALLBACK);
  const [planActualId, setPlanActualId] = useState<number>(1);
  const [planVenceEl, setPlanVenceEl] = useState<string | null>(null);
  const [aiUsage, setAiUsage] = useState<{ used: number; limit: number } | null>(null);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [ultimoPago, setUltimoPago] = useState<Pago | null>(null);

  const negocioId = localStorage.getItem("active_business_id") || "";
  const negocioNombre = localStorage.getItem("active_business_name") || "Comercio Principal";

  const cargarDatos = async () => {
    try {
      const [planes, negocio, usageResponse, sedesResponse, pagosResponse] = await Promise.all([
        planesApi.getPlanesCatalogo(),
        negocioId ? planesApi.getNegocioPlan(negocioId) : Promise.resolve(null),
        negocioId ? assistantApi.getUsage(negocioId).catch(() => null) : Promise.resolve(null),
        negocioId ? profileApi.getSedes(negocioId).catch(() => []) : Promise.resolve([]),
        negocioId ? historialDePagos(negocioId).catch(() => []) : Promise.resolve([]),
      ]);

      setCatalogo(planes);
      setAiUsage(usageResponse?.data?.quota ?? null);
      setSedes(Array.isArray(sedesResponse) ? sedesResponse : []);
      setUltimoPago(
        pagosResponse.find((pago) => pago.estado === "APROBADO") ?? null,
      );

      // Revisamos si hay plan simulado guardado
      const localSimulatedPlan = localStorage.getItem(`business_plan_${negocioId}`);
      const localSimulatedExpires = localStorage.getItem(`business_plan_expires_${negocioId}`);

      if (localSimulatedPlan) {
        setPlanActualId(Number(localSimulatedPlan));
        setPlanVenceEl(localSimulatedExpires || null);
      } else if (negocio) {
        setPlanActualId(negocio.planVigente ?? negocio.plan ?? 1);
        setPlanVenceEl(negocio.planVenceEl ?? null);
      }
    } catch {
      // Fallback seguro
    }
  };

  useEffect(() => {
    cargarDatos();

    const handlePlanUpdated = (e: any) => {
      if (e.detail?.planId) {
        setPlanActualId(e.detail.planId);
        setPlanVenceEl(e.detail.venceEl || null);
      }
    };

    window.addEventListener("plan_updated", handlePlanUpdated);
    window.addEventListener("business_changed", cargarDatos);

    return () => {
      window.removeEventListener("plan_updated", handlePlanUpdated);
      window.removeEventListener("business_changed", cargarDatos);
    };
  }, [negocioId]);

  const planActual = catalogo.find((p) => p.id === planActualId) || catalogo[0] || PLANES_FALLBACK[0];
  const esGratuito = planActual.precioMensual === 0;
  const mensajesUsados = aiUsage?.used ?? 0;
  const limiteMensajes = aiUsage?.limit ?? 0;
  const consumoIAPorcentaje = Number.isFinite(limiteMensajes) && limiteMensajes > 0
    ? Math.min(100, (mensajesUsados / limiteMensajes) * 100)
    : 0;
  const sedesConLinea = sedes.filter(
    (sede) => Boolean(sede.telefono || sede.whatsappUserId || sede.whatsappUsername),
  ).length;
  const tipoPago = ultimoPago?.metodoPago?.tipo;
  const nombreMetodoPago = tipoPago === "CARD"
    ? "Tarjeta"
    : tipoPago === "PSE"
      ? "PSE"
      : tipoPago === "NEQUI"
        ? "Nequi"
        : tipoPago === "BANCOLOMBIA_TRANSFER"
          ? "Transferencia Bancolombia"
          : tipoPago || "Método no especificado";

  const fechaFormateada = planVenceEl 
    ? new Date(planVenceEl).toLocaleDateString("es-CO", { 
        year: "numeric", 
        month: "long", 
        day: "numeric" 
      })
    : "Sin fecha de expiración (Plan Gratuito)";

  return (
    <div className="pb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Administrar suscripción</h1>
          <p className="text-muted-foreground mt-1">
            Estado de tu plan, cuota de sucursales e historial para <strong className="text-foreground">{negocioNombre}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-all"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Ir al Dashboard</span>
          </Link>

          <a
            href={lukaWhatsappUrl(`Hola Luka 👋, quiero asistencia con el Plan ${planActual.nombre} de ${negocioNombre}.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all"
          >
            <MessageCircle className="w-4 h-4 fill-slate-950" />
            <span>WhatsApp</span>
          </a>
        </div>
      </div>

      {/* Hero Card - Current Subscription */}
      <div className="bg-card border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between mb-8 relative overflow-hidden gap-6">
        {/* Glow ambiental */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-xl">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl sm:text-3xl font-black text-foreground">
              Plan {planActual.nombre}
            </h2>
            <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Suscripción Activa
            </span>
          </div>

          <p className="text-muted-foreground text-sm font-medium mb-4">
            {esGratuito ? (
              <span>Estás usando el plan esencial sin costo. Puedes mejorar en cualquier momento para sumar más sedes e IA avanzada.</span>
            ) : (
              <span>Tu suscripción se renovará automáticamente el <strong className="text-foreground font-bold">{fechaFormateada}</strong>.</span>
            )}
          </p>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-foreground">
              {esGratuito ? "Gratis" : `$${PRECIO_FORMATTER.format(planActual.precioMensual)}`}
            </span>
            {!esGratuito && (
              <span className="text-sm font-bold text-muted-foreground">COP /mes</span>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 relative z-10 shrink-0">
          <Link
            to="/"
            className="px-5 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-500/25 transition-all text-center flex items-center justify-center gap-2"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Ir al Dashboard</span>
          </Link>

          <a
            href={lukaWhatsappUrl(`Hola Luka 👋, quiero asistencia con mi cuenta en ${negocioNombre}.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-3 bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-black text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all text-center flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4 fill-slate-950" />
            <span>Ir a WhatsApp</span>
          </a>

          <Link 
            to="/subscription"
            className="px-5 py-3 bg-card border border-border text-foreground font-bold text-xs rounded-xl hover:bg-muted transition-colors text-center flex items-center justify-center gap-2 shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-emerald-500" />
            <span>Cambiar plan</span>
          </Link>
        </div>
      </div>

      {/* Bento Grid layout for details */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Capacidad de Sedes */}
        <div className="md:col-span-4 bg-card border border-border rounded-3xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="font-bold text-foreground text-sm">Líneas de WhatsApp</h3>
            </div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
              {planActual.maxSedes <= 0 ? "Sedes por definir" : planActual.maxSedes === 1 ? "1 Sede" : `Hasta ${planActual.maxSedes} Sedes`}
            </span>
          </div>
          
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex justify-between items-end mb-2">
              <span className="text-2xl font-black text-foreground">{sedes.length} {sedes.length === 1 ? "sede" : "sedes"}</span>
              <span className="text-xs font-semibold text-muted-foreground mb-0.5">
                / {planActual.maxSedes > 0 ? planActual.maxSedes : "sin límite definido"} habilitadas
              </span>
            </div>
            
            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full" 
                style={{ width: `${planActual.maxSedes > 0 ? Math.min(100, (sedes.length / planActual.maxSedes) * 100) : 0}%` }}
              />
            </div>
            
            <p className="text-[11px] text-muted-foreground mt-3">
              {sedesConLinea} de {sedes.length} {sedes.length === 1 ? "sede tiene" : "sedes tienen"} una línea de WhatsApp configurada.
            </p>
          </div>
        </div>

        {/* Consumo de Mensajes de IA */}
        <div className="md:col-span-4 bg-card border border-border rounded-3xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h3 className="font-bold text-foreground text-sm">Consumo de IA</h3>
            </div>
            <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md">
              {Number.isFinite(limiteMensajes) ? `${PRECIO_FORMATTER.format(limiteMensajes)} mensajes` : "Sin límite"}
            </span>
          </div>
          
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex justify-between items-end mb-2">
              <span className="text-2xl font-black text-foreground">{PRECIO_FORMATTER.format(mensajesUsados)}</span>
              <span className="text-xs font-semibold text-muted-foreground mb-0.5">
                / {Number.isFinite(limiteMensajes) ? PRECIO_FORMATTER.format(limiteMensajes) : "sin límite"} mensajes este ciclo
              </span>
            </div>
            
            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" style={{ width: `${consumoIAPorcentaje}%` }} />
            </div>
            
            <p className="text-[11px] text-muted-foreground mt-3">
              Tu cuota mensual de respuestas inteligentes se renueva cada 30 días.
            </p>
          </div>
        </div>

        {/* Pasarela y Método de Pago Activo */}
        <div className="md:col-span-4 bg-card border border-border rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <CardIcon className="w-4 h-4 text-muted-foreground" />
              </div>
              <h3 className="font-bold text-foreground text-sm">Pasarela de pagos</h3>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              {ultimoPago ? "Último pago aprobado" : "Sin pagos aprobados"}
            </span>
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-2xl border border-border bg-muted/20">
            <div className="w-10 h-7 bg-slate-950 dark:bg-white rounded flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-white dark:text-slate-950 font-black italic text-[9px]">{ultimoPago?.metodoPago?.ultimos4 ? "••••" : "PAGO"}</span>
            </div>
            <div className="overflow-hidden flex-1">
              <p className="font-bold text-foreground text-xs truncate">
                {ultimoPago ? `${nombreMetodoPago}${ultimoPago.metodoPago?.ultimos4 ? ` terminada en ${ultimoPago.metodoPago.ultimos4}` : ""}` : "Aún no hay un método registrado"}
              </p>
              <p className="text-[10px] text-muted-foreground">{ultimoPago ? `Pago del ${new Date(ultimoPago.createdAt).toLocaleDateString("es-CO")}` : "Completa un pago para verlo aquí"}</p>
            </div>
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
            <span className="text-muted-foreground text-[11px]">Seguridad bancaria PCI-DSS</span>
            <Link to="/subscription" className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
              Actualizar
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
