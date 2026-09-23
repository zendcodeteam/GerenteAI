import { PLAN_LIMITS, resolvePlan } from './usage.service';

/**
 * Los topes de mensajes son una regla comercial: si cambian en el contrato con
 * los clientes, tienen que cambiar aqui y esta prueba tiene que actualizarse a
 * proposito, no por accidente.
 */
describe('PLAN_LIMITS', () => {
  it('el plan gratuito incluye 100 mensajes de IA al mes', () => {
    expect(PLAN_LIMITS.asistente.monthlyAiMessages).toBe(100);
  });

  it('Gerente incluye 500', () => {
    expect(PLAN_LIMITS.gerente.monthlyAiMessages).toBe(500);
  });

  it('Administrador incluye 1.500', () => {
    expect(PLAN_LIMITS.director.monthlyAiMessages).toBe(1_500);
  });

  it('Socio incluye 3.000', () => {
    expect(PLAN_LIMITS.socio.monthlyAiMessages).toBe(3_000);
  });

  it('el plan interno Corporativo no tiene tope', () => {
    expect(PLAN_LIMITS.corporativo.monthlyAiMessages).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  /**
   * La cuota es lo unico que separa un plan de pago del siguiente: desde este
   * cambio, los tres llevan las mismas funciones Premium y se diferencian por
   * sedes y mensajes. Si dos planes empataran aqui, uno de ellos sobraria.
   */
  it('cada plan incluye estrictamente mas mensajes que el anterior', () => {
    const escalera = [
      PLAN_LIMITS.asistente,
      PLAN_LIMITS.gerente,
      PLAN_LIMITS.director,
      PLAN_LIMITS.socio,
      PLAN_LIMITS.corporativo,
    ].map((plan) => plan.monthlyAiMessages);

    for (let i = 1; i < escalera.length; i++) {
      expect(escalera[i]).toBeGreaterThan(escalera[i - 1]);
    }
  });
});

describe('resolvePlan', () => {
  it('reconoce los planes por su identificador', () => {
    expect(resolvePlan('director').monthlyAiMessages).toBe(1_500);
    expect(resolvePlan('socio').monthlyAiMessages).toBe(3_000);
  });

  it('un plan desconocido cae en el gratuito, no en el mas generoso', () => {
    // Ante la duda se concede lo minimo: regalar cuota sale caro.
    expect(resolvePlan('inexistente').id).toBe('asistente');
    expect(resolvePlan(undefined).id).toBe('asistente');
  });
});
