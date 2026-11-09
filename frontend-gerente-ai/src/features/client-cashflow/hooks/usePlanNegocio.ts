import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/apiClient';

/**
 * Plan vigente del negocio activo.
 *
 * "Vigente" y no "contratado": un plan vencido cae a Asistente, igual que en el
 * backend. Si se leyera solo el número, un cliente que dejó de pagar seguiría
 * usando funciones de pago hasta que alguien lo notara.
 */

interface NegocioPlan {
  plan: number;
  planVenceEl: string | null;
}

const PLAN_ASISTENTE = 1;

const NOMBRES: Record<number, string> = {
  1: 'Asistente',
  2: 'Gerente',
  3: 'Administrador',
  4: 'Socio',
  5: 'Corporativo',
};

export interface EstadoPlan {
  /** false mientras se consulta: evita mostrar el candado y quitarlo enseguida. */
  cargando: boolean;
  /** true si el plan vigente NO es el gratuito. */
  esPago: boolean;
  nombre: string;
  /**
   * Si el plan contratado caduco, y como se llamaba.
   *
   * El vencimiento ya se calculaba aqui para decidir el vigente, pero se
   * tiraba. Hace falta para hablarle al usuario: a quien pago y se le vencio
   * no se le puede decir que la funcion "viene con los planes pagos".
   */
  vencido: boolean;
  contratadoNombre: string | null;
}

export function usePlanNegocio(negocioId: string): EstadoPlan {
  const [estado, setEstado] = useState<EstadoPlan>({
    cargando: true,
    esPago: false,
    nombre: 'Asistente',
    vencido: false,
    contratadoNombre: null,
  });

  useEffect(() => {
    if (!negocioId) {
      setEstado({
        cargando: false,
        esPago: false,
        nombre: 'Asistente',
        vencido: false,
        contratadoNombre: null,
      });
      return;
    }

    let cancelado = false;

    apiClient<NegocioPlan>(`/negocios/${negocioId}`)
      .then((negocio) => {
        if (cancelado) return;

        const vencido =
          negocio.planVenceEl !== null &&
          new Date(negocio.planVenceEl).getTime() <= Date.now();

        const vigente = vencido ? PLAN_ASISTENTE : negocio.plan;

        setEstado({
          cargando: false,
          esPago: vigente !== PLAN_ASISTENTE,
          nombre: NOMBRES[vigente] ?? 'Asistente',
          vencido,
          contratadoNombre: NOMBRES[negocio.plan] ?? null,
        });
      })
      .catch(() => {
        // Ante un fallo se asume el plan gratuito: es preferible ofrecer de más
        // que regalar una función de pago por un error de red.
        if (!cancelado) {
          setEstado({
            cargando: false,
            esPago: false,
            nombre: 'Asistente',
            vencido: false,
            contratadoNombre: null,
          });
        }
      });

    return () => {
      cancelado = true;
    };
  }, [negocioId]);

  return estado;
}
