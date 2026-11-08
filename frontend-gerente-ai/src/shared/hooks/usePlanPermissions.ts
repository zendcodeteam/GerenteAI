import {
  useState,
  useEffect,
  useCallback,
} from "react";

import { useAuth } from "@/features/auth";
import { profileApi } from "@/features/shared-profile/api/profileApi";

import {
  planesApi,
  PlanBackend,
  PLANES_FALLBACK,
} from "@/shared/api/planesApi";

export function usePlanPermissions() {
  const { user, token } = useAuth();

  const [catalogo, setCatalogo] =
    useState<PlanBackend[]>(PLANES_FALLBACK);

  const [cantidadNegocios, setCantidadNegocios] =
    useState<number>(0);

  const [planUsuarioId, setPlanUsuarioId] =
    useState<number>(1);

  /*
   * Lo contratado y si caduco.
   *
   * `planUsuarioId` es el VIGENTE y con el se autoriza, pero no basta para
   * hablarle al usuario: a quien se le vencio el plan no se le puede decir
   * lo mismo que a quien nunca pago. El backend ya distingue los dos casos
   * (ver porQueNoHayInventario en productos.service.ts) y la interfaz tiene
   * que decir lo mismo que el bot, no contradecirlo.
   */
  const [planVencido, setPlanVencido] =
    useState<boolean>(false);

  const [planContratadoId, setPlanContratadoId] =
    useState<number | null>(null);

  const [isLoading, setIsLoading] =
    useState<boolean>(true);

  // ============================================================
  // PAYWALL
  // ============================================================

  const [isPaywallOpen, setIsPaywallOpen] =
    useState<boolean>(false);

  const [paywallMotivo, setPaywallMotivo] =
    useState<string>("");

  const [paywallPlanRecomendadoId, setPaywallPlanRecomendadoId] =
    useState<number>(2);

  // ============================================================
  // CARGAR DATOS
  // ============================================================

  const cargarDatos = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // ========================================================
      // CATÁLOGO + PERFIL
      // ========================================================

      const [planes, perfil] = await Promise.all([
        planesApi.getPlanesCatalogo(),

        profileApi.getMe().catch(() => null),
      ]);

      if (Array.isArray(planes) && planes.length > 0) {
        setCatalogo(planes);
      }

      // ========================================================
      // NEGOCIO ACTIVO
      // ========================================================

      const activeNegocioId =
        localStorage.getItem("active_business_id");

      // ========================================================
      // MASTER
      // ========================================================

      const isMaster =
        perfil?.rolGlobal === "MASTER" ||
        user?.rolGlobal === "MASTER";

      // ========================================================
      // DETERMINAR PLAN
      // ========================================================

      let resolvedPlan = 1;

      // Arrancan en "no vencido": MASTER y el caso sin negocio activo no
      // tienen vencimiento que contar, y el estado anterior no debe quedarse
      // pegado entre recargas.
      let resolvedVencido = false;
      let resolvedContratado: number | null = null;

      /*
       * MASTER
       *
       * Los usuarios MASTER tienen acceso equivalente
       * al Plan Administrador.
       */
      if (isMaster) {
        resolvedPlan = 3;
      }

      /*
       * USUARIO NORMAL
       *
       * El plan se obtiene exclusivamente desde
       * el negocio activo.
       */
      else if (activeNegocioId) {
        try {
          const negocioPlan =
            await planesApi.getNegocioPlan(
              activeNegocioId,
            );

          /*
           * Manda el plan VIGENTE, no el contratado.
           *
           * El backend autoriza contra el vigente: un plan vencido cae a
           * Asistente y pierde las funciones de pago. Si aquí leyéramos el
           * contratado, la interfaz le enseñaría al usuario botones que el
           * servidor va a rechazar con un 403 — por ejemplo el de agregar
           * productos al inventario.
           *
           * `plan` queda de respaldo por si la respuesta no trae el vigente.
           */
          const planEfectivo =
            negocioPlan?.planVigente ?? negocioPlan?.plan;

          resolvedVencido = negocioPlan?.planVencido === true;

          resolvedContratado =
            negocioPlan?.plan !== null && negocioPlan?.plan !== undefined
              ? Number(negocioPlan.plan)
              : null;

          const backendPlan =
            planEfectivo !== null && planEfectivo !== undefined
              ? Number(planEfectivo)
              : NaN;

          if (
            Number.isFinite(backendPlan) &&
            backendPlan >= 1
          ) {
            resolvedPlan = backendPlan;
          } else {
            console.warn(
              "[usePlanPermissions] El backend no devolvió un plan válido para el negocio activo.",
              {
                negocioId: activeNegocioId,
                negocioPlan,
              },
            );
          }
        } catch (error) {
          console.error(
            "[usePlanPermissions] Error obteniendo el plan del negocio:",
            error,
          );
        }
      }

      /*
       * SIN NEGOCIO ACTIVO
       *
       * No usamos localStorage para determinar el plan.
       *
       * Si no existe negocio activo, mantenemos Plan 1
       * como estado seguro.
       */

      // ========================================================
      // VALIDACIÓN FINAL
      // ========================================================

      if (
        !Number.isFinite(resolvedPlan) ||
        resolvedPlan < 1
      ) {
        resolvedPlan = 1;
      }

      setPlanUsuarioId(resolvedPlan);

      setPlanVencido(resolvedVencido);

      setPlanContratadoId(resolvedContratado);

      // ========================================================
      // CANTIDAD DE NEGOCIOS
      // ========================================================

      if (
        Array.isArray(perfil?.negocios)
      ) {
        setCantidadNegocios(
          perfil.negocios.length,
        );
      } else {
        const lista =
          await profileApi
            .getNegocios()
            .catch(() => []);

        setCantidadNegocios(
          Array.isArray(lista)
            ? lista.length
            : 0,
        );
      }

      // ========================================================
      // DEBUG CONTROLADO
      // ========================================================

      console.info(
        "[usePlanPermissions] Estado de permisos:",
        {
          negocioId: activeNegocioId,
          plan: resolvedPlan,
          planNombre:
            (Array.isArray(planes)
              ? planes
              : PLANES_FALLBACK
            ).find(
              (p) =>
                p.id === resolvedPlan,
            )?.nombre,
          planVencido: resolvedVencido,
          planContratado: resolvedContratado,
          isMaster,
          cantidadNegocios:
            Array.isArray(perfil?.negocios)
              ? perfil.negocios.length
              : undefined,
        },
      );
    } catch (error) {
      console.error(
        "[usePlanPermissions] Error al verificar permisos de plan:",
        error,
      );

      /*
       * IMPORTANTE:
       *
       * No recuperamos business_plan_*
       * ni active_business_plan.
       *
       * Esos valores pertenecen a pruebas anteriores
       * y no deben poder modificar el plan real.
       */
    } finally {
      setIsLoading(false);
    }
  }, [token, user]);

  // ============================================================
  // CARGA INICIAL + EVENTOS
  // ============================================================

  useEffect(() => {
    void cargarDatos();

    // ----------------------------------------------------------
    // CAMBIO DE PLAN
    // ----------------------------------------------------------

    const handlePlanUpdated = (
      event: Event,
    ) => {
      const customEvent =
        event as CustomEvent<{
          planId?: number;
        }>;

      const planId =
        customEvent.detail?.planId;

      if (
        planId !== undefined &&
        planId !== null
      ) {
        const numericPlan =
          Number(planId);

        if (
          Number.isFinite(numericPlan) &&
          numericPlan >= 1
        ) {
          setPlanUsuarioId(
            numericPlan,
          );
        }
      }

      /*
       * Confirmamos siempre con backend.
       */
      void cargarDatos();
    };

    // ----------------------------------------------------------
    // CAMBIO DE NEGOCIO
    // ----------------------------------------------------------

    const handleBusinessChanged = () => {
      /*
       * El active_business_id puede actualizarse
       * justo antes de disparar este evento.
       *
       * Esperamos un tick para leer el valor nuevo.
       */
      setTimeout(() => {
        void cargarDatos();
      }, 0);
    };

    window.addEventListener(
      "plan_updated",
      handlePlanUpdated,
    );

    window.addEventListener(
      "business_changed",
      handleBusinessChanged,
    );

    return () => {
      window.removeEventListener(
        "plan_updated",
        handlePlanUpdated,
      );

      window.removeEventListener(
        "business_changed",
        handleBusinessChanged,
      );
    };
  }, [cargarDatos]);

  // ============================================================
  // REGLAS DE NEGOCIO
  // ============================================================

  /*
   * Plan 1 — Asistente: 1 negocio, 1 sede
   * Plan 2 — Gerente: 1 negocio, 1 sede premium
   * Plan 3 — Administrador: 3 negocios, 3 sedes
   * Plan 4 — Socio: 5 negocios, 5 sedes
   * Plan 5 — Corporativo: Sedes por definir
   */

  const maxNegociosPermitidos =
    planUsuarioId === 1
      ? 1
      : planUsuarioId === 2
        ? 1
        : planUsuarioId === 3
          ? 3
          : planUsuarioId === 4
            ? 5
            : Number.POSITIVE_INFINITY;

  const puedeCrearNegocio =
    cantidadNegocios <
    maxNegociosPermitidos;

  // ============================================================
  // PAYWALL
  // ============================================================

  const abrirPaywall = (
    motivo?: string,
    planRecomendado = 2,
  ) => {
    setPaywallMotivo(
      motivo ||
        `El Plan ${
          planUsuarioId === 1
            ? "Asistente (Gratis)"
            : planInfo.nombre
        } permite administrar hasta ${
          maxNegociosPermitidos ===
          Number.POSITIVE_INFINITY
            ? "las sedes acordadas de"
            : maxNegociosPermitidos
        } comercio(s). Mejora tu plan para crear múltiples negocios y sucursales.`,
    );

    setPaywallPlanRecomendadoId(
      planRecomendado,
    );

    setIsPaywallOpen(true);
  };

  const cerrarPaywall = () => {
    setIsPaywallOpen(false);
  };

  // ============================================================
  // INFORMACIÓN DEL PLAN
  // ============================================================

  const planInfo =
    (Array.isArray(catalogo) && catalogo.length > 0
      ? catalogo
      : PLANES_FALLBACK
    ).find((p) => p.id === planUsuarioId) ||
    PLANES_FALLBACK[0];

  // ============================================================
  // MÁXIMO DE SEDES
  // ============================================================

  const maxSedesPermitidas =
    planUsuarioId === 1
      ? 1
      : planUsuarioId === 2
        ? 1
        : planUsuarioId === 3
          ? 3
          : planUsuarioId === 4
            ? 5
            : Number.POSITIVE_INFINITY;

  // Flags de características según plan
  const puedeVerFiados = planUsuarioId >= 2;
  // El catálogo de productos es de planes pagos. Esta bandera solo decide qué
  // se PINTA: quien manda es el backend, que responde 403 a un plan gratuito.
  const puedeGestionarInventario = planUsuarioId >= 2;
  const puedeVerRecomendaciones = planUsuarioId >= 2;
  const puedeExportarExcel = planUsuarioId >= 3;
  const esMultiSede = planUsuarioId >= 3;

  // ============================================================
  // VERIFICAR CREACIÓN DE NEGOCIO
  // ============================================================

  const verificarCreacionNegocio = (
    onPermitido: () => void,
  ) => {
    if (puedeCrearNegocio) {
      onPermitido();
    } else {
      abrirPaywall();
    }
  };

  // ============================================================
  // VERIFICAR CREACIÓN DE SEDE
  // ============================================================

  const verificarCreacionSede = (
    totalSedesActuales: number,
    onPermitido: () => void,
  ) => {
    if (
      totalSedesActuales <
      maxSedesPermitidas
    ) {
      onPermitido();
    } else {
      const siguientePlan =
        planUsuarioId === 1
          ? "Gerente"
          : planUsuarioId === 2
            ? "Administrador"
            : planUsuarioId === 3
              ? "Socio"
              : "Corporativo";

      const siguientePlanId =
        planUsuarioId === 1
          ? 2
          : planUsuarioId === 2
            ? 3
            : planUsuarioId === 3
              ? 4
              : 5;

      abrirPaywall(
        `Tu Plan ${planInfo.nombre} permite administrar hasta ${maxSedesPermitidas} sede(s). Para registrar una nueva sucursal, sube al Plan ${siguientePlan}.`,
        siguientePlanId,
      );
    }
  };

  // ============================================================
  // RETURN
  // ============================================================

  return {
    planUsuarioId,

    planNombre:
      planInfo.nombre,

    planInfo,

    /*
     * Si el plan contratado caduco, y cual era.
     *
     * Quien pinte un mensaje de "esto es de planes pagos" tiene que mirar
     * esto primero: a un vencido ese texto le miente, porque pago. El nombre
     * sale del catalogo que este hook ya carga, con el respaldo de PLANES_FALLBACK.
     */
    planVencido,

    planContratadoId,

    planContratadoNombre:
      planContratadoId !== null
        ? (catalogo.find((p) => p.id === planContratadoId)?.nombre ?? null)
        : null,

    catalogo,

    cantidadNegocios,

    maxNegociosPermitidos,

    maxSedesPermitidas,

    puedeCrearNegocio,

    puedeVerFiados,

    puedeGestionarInventario,

    puedeVerRecomendaciones,

    puedeExportarExcel,

    isLoading,

    isPaywallOpen,

    paywallMotivo,

    paywallPlanRecomendadoId,

    abrirPaywall,

    cerrarPaywall,

    verificarCreacionNegocio,

    verificarCreacionSede,

    recargarPermisos:
      cargarDatos,
  };
}