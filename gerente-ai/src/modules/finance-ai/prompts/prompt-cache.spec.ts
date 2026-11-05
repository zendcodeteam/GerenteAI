import {
  WHATSAPP_ASSISTANT_SYSTEM_PROMPT,
  buildWhatsAppAssistantSystemPrompt,
} from './whatsapp-assistant.prompt';

/**
 * SCRUM-51: la cache del proveedor casa por PREFIJO EXACTO.
 *
 * El servicio declara `WHATSAPP_ASSISTANT_SYSTEM_PROMPT` como prefijo
 * cacheable del system que manda. Si alguien mete algo variable antes del
 * prompt —un saludo con la hora, el nombre del negocio— el prefijo deja de
 * serlo, la cache no acierta ni una vez y nadie se entera: el bot sigue
 * respondiendo bien, solo que cuesta diez veces mas.
 *
 * Esta prueba es ese seguro.
 */
describe('prompt de WhatsApp · lo cacheable va primero', () => {
  const contexto = {
    // Valores que no pueden aparecer en el texto fijo del prompt: "El Virrey"
    // si sale ahi, como ejemplo, y no serviria para distinguir una cosa de la
    // otra.
    businessName: 'Panaderia Zafiro 9000',
    currency: 'COP',
    referenceDate: '2031-07-19',
    planName: 'Gerente',
    planIsFree: false,
    pendingQuestion: null,
    quotedMessage: null,
  };

  it('el system siempre empieza por el prompt fijo', () => {
    const system = buildWhatsAppAssistantSystemPrompt(contexto);

    expect(system.startsWith(WHATSAPP_ASSISTANT_SYSTEM_PROMPT)).toBe(true);
  });

  it('lo que cambia entre mensajes va despues del prefijo', () => {
    const system = buildWhatsAppAssistantSystemPrompt(contexto);
    const volatil = system.slice(WHATSAPP_ASSISTANT_SYSTEM_PROMPT.length);

    expect(volatil).toContain('2031-07-19');
    expect(volatil).toContain('Panaderia Zafiro 9000');
    // Y el prefijo no lleva nada de eso: si lo llevara, cada negocio tendria
    // su propia cache y el acierto se desplomaria.
    expect(WHATSAPP_ASSISTANT_SYSTEM_PROMPT).not.toContain(
      'Panaderia Zafiro 9000',
    );
    expect(WHATSAPP_ASSISTANT_SYSTEM_PROMPT).not.toContain('2031-07-19');
  });

  it('dos negocios distintos comparten el mismo prefijo', () => {
    // Es lo que hace que la cache valga la pena: la paga el primer mensaje
    // que entre, y la aprovechan todos los demas negocios.
    const uno = buildWhatsAppAssistantSystemPrompt(contexto);
    const otro = buildWhatsAppAssistantSystemPrompt({
      ...contexto,
      businessName: 'La Esquina',
      currency: 'USD',
    });

    const corte = WHATSAPP_ASSISTANT_SYSTEM_PROMPT.length;
    expect(uno.slice(0, corte)).toBe(otro.slice(0, corte));
  });

  it('el prefijo es lo bastante grande para que el proveedor lo cachee', () => {
    // Por debajo de unos cientos de tokens los proveedores no cachean nada.
    // Aqui son ~14.500, pero si alguien parte el prompt en trozos conviene
    // enterarse por una prueba y no por la factura.
    expect(WHATSAPP_ASSISTANT_SYSTEM_PROMPT.length).toBeGreaterThan(20_000);
  });
});
