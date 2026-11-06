# Capa de IA de Luka AI

Guía de la integración de inteligencia artificial: cómo está construida, cómo
se usa y —lo más importante— **cómo se migra de una IA a otra sin reescribir
nada**.

---

## 0. Los dos archivos que vas a tocar

Si solo lees una sección, que sea esta.

| Quiero… | Archivo |
| --- | --- |
| **Cambiar el system prompt** (cómo piensa el chatbot) | [`src/modules/finance-ai/prompts/whatsapp-assistant.prompt.ts`](../src/modules/finance-ai/prompts/whatsapp-assistant.prompt.ts) |
| **Cambiar de IA** (Groq → Claude, etc.) | el archivo `.env` — variable `AI_PROVIDER` |

Y si necesitas ir más adentro:

| Quiero… | Archivo |
| --- | --- |
| Ver cómo se conecta técnicamente cada IA | [`src/ai/providers/`](../src/ai/providers/) — un archivo por proveedor |
| Ver qué hace el backend con lo que responde la IA | [`src/modules/finance-ai/services/whatsapp-message.service.ts`](../src/modules/finance-ai/services/whatsapp-message.service.ts) |
| Agregar un proveedor nuevo | [`src/ai/config/provider.catalog.ts`](../src/ai/config/provider.catalog.ts) |

---

## 1. La idea en una frase

El dominio nunca habla con una IA concreta. Habla con un **contrato**
(`LlmProvider`), y cada IA tiene un **adaptador** que traduce ese contrato a su
protocolo nativo. Cambiar de proveedor es cambiar una variable de entorno.

```
                 ┌──────────────────────────────────────────────┐
Dominio          │  WhatsAppMessageService                       │
(casos de uso)   │  InsightsService · AssistantService           │
                 └───────────────────────┬──────────────────────┘
                                         │ solo conoce esto
                 ┌───────────────────────▼──────────────────────┐
Fachada          │  LlmService                                   │
                 │  cuotas · reintentos · respaldo · costos      │
                 └───────────────────────┬──────────────────────┘
                                         │ interfaz LlmProvider
        ┌───────────────┬────────────────┼────────────────┬───────────────┐
        ▼               ▼                ▼                ▼               ▼
   OpenAiCompatible  Gemini         Anthropic          Echo         (el tuyo)
   Groq · Ollama     free tier      Claude (pago)      simulado
   OpenRouter                                          para tests
   DeepSeek · OpenAI
```

**La regla que mantiene esto sano:** si para cambiar de IA hace falta tocar algo
fuera de `src/ai/providers/`, el diseño se rompió. Cualquier peculiaridad de un
proveedor (que rechace `temperature`, que no soporte JSON con esquema, que use
`functionCall` en vez de `tool_calls`) se absorbe dentro de su adaptador.

---

## 2. Mapa de archivos

| Ruta | Qué hace |
| --- | --- |
| `src/ai/core/llm.types.ts` | El contrato neutral: mensajes, herramientas, formato de salida, uso. |
| `src/ai/core/llm.provider.ts` | La interfaz `LlmProvider` que todo adaptador implementa. |
| `src/ai/core/llm.errors.ts` | Taxonomía de errores normalizada (`rate_limit`, `timeout`, `refusal`…). |
| `src/ai/core/json.util.ts` | Rescata JSON de modelos que lo envuelven en texto o ```` ```json ````. |
| `src/ai/core/http.util.ts` | `fetch` con timeout + reintentos con backoff. |
| `src/ai/config/provider.catalog.ts` | Catálogo de proveedores y tabla de precios. |
| `src/ai/config/ai.config.ts` | Lectura y validación de variables de entorno. |
| `src/ai/providers/*.provider.ts` | Los adaptadores. **Único sitio con código específico de un proveedor.** |
| `src/ai/providers/provider.factory.ts` | Traduce configuración → instancia de proveedor. |
| `src/ai/services/llm.service.ts` | Fachada: cuotas, reintentos, respaldo, medición, trazas. |
| `src/ai/usage/` | Registro de consumo y límites por plan comercial. |
| `src/ai/filters/llm-exception.filter.ts` | Errores de IA → respuestas HTTP entendibles. |
| `src/modules/finance-ai/prompts/` | **Los system prompts.** Uno por caso de uso. |
| `src/modules/finance-ai/services/` | Qué hace el backend con la respuesta del modelo. |
| `src/modules/finance-ai/domain/finance.types.ts` | Tipos, categorías y sus etiquetas. |
| `src/modules/finance-ai/domain/periodo-contable.ts` | **El periodo contable del negocio.** Un solo sitio decide qué es "este mes". |
| `src/modules/whatsapp/services/destinatarios.service.ts` | **A quién puede escribirle el bot.** Lo consultan los workflows de recordatorios. |

---

## 3. Cambiar de IA

### Durante las pruebas (gratis)

**Groq** — el más rápido, capa gratuita generosa:

```env
AI_PROVIDER=groq
GROQ_API_KEY=gsk_...          # https://console.groq.com/keys
AI_MODEL=llama-3.3-70b-versatile
```

**Gemini** — mejor español y JSON con esquema garantizado:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=AIza...        # https://aistudio.google.com/apikey
AI_MODEL=gemini-2.0-flash
```

**Ollama** — todo local, costo cero y los datos financieros no salen del equipo:

```env
AI_PROVIDER=ollama
AI_MODEL=llama3.1:8b
AI_BASE_URL=http://localhost:11434/v1
```

**Echo** — sin llaves ni red; devuelve respuestas deterministas. Es el valor por
defecto para que el proyecto arranque recién clonado y para los tests.

### En producción (de pago)

```env
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
AI_MODEL=claude-opus-5        # o claude-sonnet-5 / claude-haiku-4-5
```

**Eso es toda la migración.** No hay que tocar servicios, controladores ni
prompts. Reinicia el backend y `GET /ai/status` confirma quién está activo.

### Migración progresiva

Se puede mover un caso de uso a la vez. En `LlmService` cambia el proveedor
global, pero si quieres, por ejemplo, extracción en Groq (barato, alto volumen)
e insights en Claude (calidad), inyecta un segundo proveedor con su propio token
en `AiModule` y pásalo al servicio correspondiente. La interfaz es la misma, así
que conviven sin fricción.

### Respaldo automático

```env
AI_FALLBACK_PROVIDER=groq
AI_FALLBACK_API_KEY=gsk_...
```

Si el principal falla por saturación, caída, timeout o credenciales, `LlmService`
reintenta con backoff y luego pasa al respaldo. Un `bad_request` **no** activa el
respaldo: fallaría igual, y gastaría dinero para nada.

---

## 4. Añadir un proveedor nuevo

**Caso A — habla protocolo OpenAI** (la mayoría: Together, Fireworks, Mistral,
xAI, Cerebras…). No se escribe código: añade una entrada en
`src/ai/config/provider.catalog.ts`.

```ts
mistral: {
  id: 'mistral',
  kind: 'openai-compatible',
  label: 'Mistral AI',
  tier: 'paid',
  baseUrl: 'https://api.mistral.ai/v1',
  defaultModel: 'mistral-large-latest',
  apiKeyEnv: 'MISTRAL_API_KEY',
  notes: '...',
},
```

**Caso B — protocolo propio.** Tres pasos:

1. Crea `src/ai/providers/mi-ia.provider.ts` implementando `LlmProvider`
   (`generate`, `healthCheck`, `id`, `model`, `capabilities`).
2. Añade su `kind` al catálogo.
3. Añade un `case` en `provider.factory.ts`.

Guía práctica: copia `gemini.provider.ts`, que es el ejemplo completo (mensajes,
herramientas, esquema JSON, uso de tokens, errores).

**Lo que el adaptador debe garantizar:**

- Traducir errores a `LlmError` con el código correcto — de eso dependen los
  reintentos y el respaldo.
- Reportar `usage` en tokens — de eso dependen las cuotas del plan.
- Declarar `capabilities` con honestidad. Si dices `nativeJsonSchema: true` sin
  serlo, el JSON llegará roto al dominio.
- Filtrar en silencio lo que su modelo no acepte (`temperature` en Claude Opus 5,
  por ejemplo) en vez de propagar un 400.

---

## 5. Casos de uso implementados

### Chatbot de WhatsApp — `POST /ai/whatsapp/message`

Es el caso de uso principal. El system prompt está en
[`whatsapp-assistant.prompt.ts`](../src/modules/finance-ai/prompts/whatsapp-assistant.prompt.ts)
y obliga al modelo a responder **siempre** con este JSON:

```json
{
  "type": "income | expense | investment | breakdown | profit_share | query | correction | unclear | out_of_scope | premium",
  "movements": [
    {
      "type": "income | expense | investment",
      "amount": 50000,
      "category": "transporte",
      "concept": "Transporte",
      "paymentMethod": "efectivo | transferencia | tarjeta | otro | null",
      "isCredit": false,
      "customerName": null
    }
  ],
  "declaredTotal": null,
  "profitShares": [{ "beneficiary": "dueno", "name": null, "percentage": 60 }],
  "concept": null,
  "queryKind": "summary | list | search | null",
  "queryPeriod": "day | week | month | null",
  "responseText": "texto de respuesta para el usuario",
  "confidence": 0.95
}
```

> **`movements` es una lista.** Es el cambio central de la v7 del prompt. Con un
> solo `amount`, un mensaje como *"pagué 50.000 de transporte y 30.000 de
> almuerzo"* solo podía terminar en un registro de 80.000: el modelo entendía
> los dos gastos pero no tenía dónde ponerlos.

Según el `type`, el backend actúa
([`whatsapp-message.service.ts`](../src/modules/finance-ai/services/whatsapp-message.service.ts)):

| `type` | Qué hace el backend |
| --- | --- |
| `income` / `expense` / `investment` | Crea **un movimiento por cada elemento** de `movements`. Si hay varios, comparten `groupId`. |
| `breakdown` | Busca el total ya registrado y lo **sustituye** por sus partes, en una sola transacción de base. No suma dinero nuevo. |
| `profit_share` | Calcula el monto de cada beneficiario sobre la utilidad real del periodo y lo guarda. |
| `query` | **Ignora el `responseText`** y arma la respuesta con cifras del backend, según `queryKind`. |
| `correction` | **Modifica o borra** el movimiento anterior en la misma tabla que lee el panel. Si hay varios candidatos, pregunta. |
| `unclear` / `out_of_scope` / `premium` | Solo responden. |

Y según el `queryKind`:

| `queryKind` | Respuesta |
| --- | --- |
| `summary` | Totales del periodo, con lo fiado señalado aparte. |
| `list` | El detalle de cada movimiento: fecha, concepto, valor, forma de pago. |
| `search` | Los movimientos cuyo texto coincide con `concept`. Funciona igual para gastos y para ingresos. |

```bash
curl -X POST http://localhost:3000/ai/whatsapp/message \
  -H "content-type: application/json" \
  -d '{"message":"Pagué 50.000 de transporte y 30.000 de almuerzo","businessId":"demo-business"}'
```

**Cuatro decisiones de diseño que conviene conocer:**

1. **Las cifras las pone el backend, no el modelo.** Un LLM no es una fuente
   confiable de números. El modelo detecta *qué* se pregunta; los totales, los
   montos del reparto y las sumas salen de la base y del código.
2. **La aritmética se verifica en código.** Si el usuario declara un total y un
   desglose que no cuadra, `checkBreakdown()` lo detecta y el bot **pregunta en
   vez de registrar**. Registrar cifras que no suman es peor que no registrar:
   el error queda escondido dentro de la contabilidad.
3. **Saneamiento defensivo.** Aunque el esquema obligue, un modelo puede
   devolver un monto negativo, un tipo inventado o una categoría que no
   corresponde (`"ventas"` en un gasto). `normalizeIntent()` corrige o descarta
   todo eso antes de que llegue a la contabilidad.
4. **Un fiado es una venta, pero no es caja.** Se registra como `Venta` de tipo
   `FIADO` con su `saldoPendiente`, que es lo que lee el reporte de cuentas por
   cobrar del panel. En los resúmenes se informa aparte para que el dueño no
   confunda lo vendido con lo cobrado.

### Corregir un movimiento desde WhatsApp

*"No, eran 60.000"*, *"el gasto de transporte era de 45.000"*, *"borra el último
gasto"*. El modelo devuelve `type: "correction"` con:

```json
{
  "correction": {
    "action": "update | delete",
    "reference": "transporte",   // null = el último movimiento
    "newAmount": 60000,
    "newConcept": null
  }
}
```

Cómo lo resuelve el backend:

1. **Busca entre los movimientos de los últimos 31 días de esa sede.** Sin
   `reference`, toma el más reciente. Con `reference`, busca por texto.
2. **Si encuentra varios, pregunta.** Corregir el movimiento equivocado no
   arregla el error: lo mueve de sitio y lo esconde. Preferimos una pregunta más.
3. **Si no encuentra ninguno, lo dice**, nombrando lo que buscó.
4. **Aplica el cambio sobre las mismas tablas que lee el panel** (`Venta`,
   `Gasto`). No hay ningún paso de sincronización: el dueño corrige por WhatsApp
   y lo ve en la web al recargar.

Un detalle que no es obvio: si el monto corregido pertenece a un fiado, también
se actualiza `saldoPendiente`. Sin eso, el reporte de cuentas por cobrar seguiría
mostrando la deuda vieja aunque la venta ya estuviera corregida.

### El periodo contable del negocio

No todos cierran el mes calendario. Hay negocios cuyo mes va **del 21 al 20**,
porque así les cuadra con la nómina o con el pago a proveedores. Si el sistema
asume siempre del 1 al 30, sus reportes cortan por donde no es.

`Negocio.diaInicioPeriodo` guarda el día de arranque (1–28; se limita a 28 para
que exista en febrero). El día de cierre es el anterior: arrancar el 21 cierra
el 20. La regla vive **una sola vez**, en
[`periodo-contable.ts`](../src/modules/finance-ai/domain/periodo-contable.ts), y
la usan igual el chatbot y los reportes del panel.

Qué cambia con `diaInicioPeriodo = 21`, un 5 de septiembre:

| Consulta | Con `1` (por defecto) | Con `21` |
| --- | --- | --- |
| *"¿cómo voy este mes?"* | 01/09 → 05/09 | **21/08** → 05/09 |
| *"¿y hoy?"* | 05/09 | 05/09 |
| *"¿esta semana?"* | 31/08 → 05/09 | 31/08 → 05/09 |

El día y la semana no dependen del corte: solo el mes. Con el valor por defecto
`1` el comportamiento es idéntico al de siempre, así que los negocios que ya
existen no notan nada.

### Recordatorios automáticos

Dos endpoints que consume n8n, ambos detrás de `N8nApiKeyGuard`:

| Endpoint | Cuándo | Qué devuelve |
| --- | --- | --- |
| `GET /ai/recordatorios/nocturno` | Cron 21:00 | Sedes que hoy no registraron ningún movimiento. |
| `GET /ai/recordatorios/fiados` | Cron 10:00 | Fiados abiertos cuyo vencimiento está dentro de los próximos cinco días, con el texto ya armado. |

Los dos preguntan lo mismo primero: **¿a quién puedo escribirle?** Esa respuesta
vive en
[`destinatarios.service.ts`](../src/modules/whatsapp/services/destinatarios.service.ts)
y sigue el mismo orden que el enrutamiento de entrada:

```
Sede.telefono  →  Sede.whatsappUserId  →  Usuario.telefono
```

Ese último paso es el que faltaba. El workflow de n8n tenía su propia consulta
SQL que solo miraba los dos primeros, así que **quien usaba el bot desde su
número personal, con la sede sin línea propia, escribía sin problema pero nunca
recibía el recordatorio**. Era exactamente el síntoma reportado: *"a algunos
contactos no les llega"*. Ahora la definición está una sola vez y n8n la
consulta.

> **Ojo con `/ai/recordatorios/fiados`:** servirlo **ya marca** los avisos como
> enviados. Es deliberado —marcarlos después del envío haría que dos ejecuciones
> solapadas mandaran el mismo recordatorio dos veces—, pero implica que
> ejecutarlo a mano para probar quema los avisos del día.

### Insights — `POST /ai/insights`

Alimenta la pantalla *Recomendaciones de IA*. Toma la foto real del negocio
(totales, evolución mensual, categorías, movimientos recientes) y devuelve entre
2 y 5 hallazgos con acción concreta y prioridad. El prompt prohíbe explícitamente
el consejo genérico y los números inventados.

### Asistente — `POST /ai/assistant/ask`

Conversación con **herramientas**: el modelo no recibe la base de datos, recibe
tres funciones (`consultar_resumen_financiero`, `listar_transacciones`,
`calcular_totales`) que el backend resuelve contra el puerto de datos.

El `businessId` lo pone el backend, nunca los argumentos del modelo: así una
inyección de prompt no puede hacer que consulte los datos de otro negocio.

### Operación

- `GET /ai/status` — proveedor activo, modelo y capacidades.
- `GET /ai/health` — llamada real al proveedor (gasta unos pocos tokens).
- `GET /ai/usage/:tenantId` — consumo y cuota del mes.

---

## 6. Cuotas y costos

Los planes de la pantalla de suscripción están en `src/ai/usage/usage.service.ts`:

| Plan | Mensajes de IA/mes |
| --- | --- |
| Asistente (gratuito) | 500 |
| Gerente | 4.000 |
| Director | 10.000 |
| Corporativo | sin límite |

`LlmService` verifica la cuota **antes** de llamar al modelo y registra el
consumo después. Los fallos se registran para diagnóstico pero no descuentan
cuota. Al superarla, la API responde `402` con código `quota_exceeded`.

El costo estimado sale de `MODEL_PRICING` en `provider.catalog.ts`. Los modelos
gratuitos quedan en 0; los precios de Anthropic están cargados. Al añadir un
modelo de pago nuevo, añade su fila para que el panel de administración no
reporte costo cero.

> **Importante:** hoy el registro de consumo vive en memoria
> (`InMemoryAiUsageRepository`): se pierde al reiniciar y no se comparte entre
> instancias. **No sirve para facturar.** Antes de producción hay que
> implementar `AiUsageRepository` contra Postgres — es una sola clase, nada más
> cambia.

---

## 7. Probar y comparar proveedores

```bash
npm run ai:smoke
```

Ejecuta los tres casos de uso contra el proveedor configurado e imprime
resultado, latencia y costo. Su verdadero valor es **comparar**: corre el mismo
guion con `AI_PROVIDER=groq`, luego `=gemini`, luego `=anthropic` y decide con
datos —no con intuición— si el modelo barato alcanza para cada caso de uso.

Una estrategia habitual es mixta: extracción (alto volumen, tarea simple) en un
modelo económico, insights y asistente (donde se nota la calidad) en el premium.

---

## 8. Cambios de base de datos (aplicar antes de desplegar)

El prompt y las funciones nuevas necesitan columnas que antes no existían.
**Sin este paso el backend arranca pero falla al guardar.**

> En Render no hay que hacer nada a mano: el *Start Command* es
> `npx prisma db push && node dist/main`, así que el esquema se aplica solo en
> cada despliegue.

```bash
npx prisma generate     # regenera el cliente tipado
npx prisma db push      # aplica los cambios al PostgreSQL configurado
```

Todo lo añadido es **opcional o nuevo**: ninguna columna existente cambió de
tipo ni se eliminó, así que los datos actuales siguen siendo válidos.

| Dónde | Qué se agregó | Por qué |
| --- | --- | --- |
| `Venta.descripcion` | texto opcional | Sin esto el concepto de un ingreso se perdía al guardar, y por eso *"¿cuánto gané en ventas?"* nunca encontraba nada. |
| `Venta.metodoPago`, `Gasto.metodoPago` | enum opcional | Guardar el desglose por forma de pago. |
| `Venta.grupoId`, `Gasto.grupoId` | texto opcional | Mantiene la relación entre un total y sus subcampos. |
| `RepartoUtilidad` | tabla nueva | Reparto de ganancias. Va aparte de `Gasto` porque repartir utilidades no es un costo: mezclarlo distorsionaría los márgenes. |
| `MetodoPago`, `BeneficiarioReparto` | enums nuevos | — |
| `Negocio.diaInicioPeriodo` | entero, por defecto `1` | Día en que arranca el mes contable del negocio. Con `1` todo se comporta como siempre. |
| `RecordatorioFiado` | tabla nueva | Deja constancia de que ya se avisó por un fiado, para no repetir el aviso cada día. |

**Para el frontend:** el campo `grupoId` es la clave para mostrar el total con
sus subcampos anidados en la tabla del Resumen. Los movimientos que comparten
`grupoId` salieron del mismo mensaje y suman el total declarado.

---

## 9. Pendientes antes de producción

Esta capa está completa y funcionando, pero el backend a su alrededor todavía no:

- [ ] **Autenticación en `/ai/*`.** `FinanceAiController` no tiene guarda y
      `tenantId` llega en el cuerpo: hoy cualquiera puede escribir en la
      contabilidad de otro negocio y gastar su cuota de IA.
- [ ] **Cuotas persistentes.** `AiUsageRepository` sigue en memoria: se reinicia
      con cada despliegue, así que todavía no se puede facturar por mensajes.
- [ ] **Rate limiting por IP/tenant**, además de la cuota del plan.
- [ ] **Caché de insights**: hoy cada llamada gasta tokens; regenerarlos una vez
      al día por negocio es suficiente.
