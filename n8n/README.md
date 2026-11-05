# Integración WhatsApp ↔ n8n ↔ Backend (Persona 5)

Todo lo necesario para poner a funcionar el bot de WhatsApp de punta a punta.

```
   Usuario WhatsApp
         │  "compré mercancía por $8.000"
         ▼
   Meta Cloud API  ──POST──►  n8n (Railway)
                              https://n8n-production-1935.up.railway.app/webhook/whatsapp
                                 │
                                 │ 1. responde 200 a Meta (antes de procesar)
                                 │ 2. filtra: solo mensajes de texto
                                 │ 3. extrae texto + teléfono + nombre + wamid
                                 ▼
                              POST /ai/interpret   (x-api-key)
                              Backend NestJS (Render)
                                 │  resuelve teléfono → sede
                                 │  llama al LLM (Groq / Gemini / Anthropic)
                                 │  guarda el movimiento en PostgreSQL
                                 ▼
                              { reply, interpreted }
                                 │
   Usuario WhatsApp  ◄──────── n8n envía la respuesta por Graph API
```

Archivos de este directorio:

| Archivo | Qué hace |
|---|---|
| `01-whatsapp-mensajes.json` | Flujo principal: mensaje entrante → IA → respuesta |
| `02-recordatorio-nocturno.json` | RF-07 · cron 21:00 diario a quien no registró nada |
| `03-resumen-semanal.json` | RF-08 · cron domingos 10:00 con el resumen de la semana |
| `04-mantener-despierto.json` | Ping periódico para que Render no duerma el servicio |
| `05-recordatorio-fiados.json` | Cron 10:00 diario · avisa de fiados cuyo vencimiento llega en cinco días o menos |

---

## 1. Qué se cambió en el backend y por qué

**El endpoint `/ai/interpret` no existía.** Lo que había era `POST /ai/whatsapp/message`,
pensado para el frontend, y tal cual no funcionaba con n8n. Estos eran los bloqueos:

| # | Problema | Consecuencia sin arreglar | Solución aplicada |
|---|---|---|---|
| 1 | `main.ts` usa `ValidationPipe({ forbidNonWhitelisted: true })` y el DTO no tenía `phone`, `name` ni `conversationId` | **HTTP 400 en todos los mensajes.** Es el fallo que más tiempo hace perder porque parece un problema de n8n | `InterpretMessageDto` con todos los campos que manda n8n |
| 2 | `businessId` era obligatorio y n8n solo conoce el teléfono | n8n no tenía forma de saber qué mandar ahí | `WhatsappRoutingService`: teléfono → `Sede` (por `Sede.telefono`) |
| 3 | La respuesta venía envuelta en `{ success, data: { intent, replyText, ... } }` | n8n tenía que navegar 3 niveles y romper el flujo con cada cambio del panel | Contrato plano `{ reply, interpreted }` |
| 4 | El modelo no devolvía `confidence` | El campo pedido en el contrato no existía | Añadido al prompt (`asistente-whatsapp/v2`), al JSON Schema y al normalizador |
| 5 | El puerto de datos era `InMemoryFinanceDataAdapter` | **Todo lo que registrara el bot se perdía al reiniciar**, y los crons de RF-07/RF-08 no verían nada | `PrismaFinanceDataAdapter`: escribe en `Gasto` / `Venta` |
| 6 | La ruta no tenía autenticación | Cualquiera con la URL gasta la cuota de IA y escribe en la contabilidad de un cliente | `N8nApiKeyGuard` (`x-api-key`) |
| 7 | Meta reintenta el webhook si no recibe 200 rápido | El mismo gasto registrado dos o tres veces | `MessageDedupeService` por `wamid` |
| 8 | Un fallo del LLM devolvía 4xx/5xx | El usuario se quedaba sin respuesta | El endpoint responde 200 con un `reply` degradado y `ok:false` |

**Archivos nuevos**

```
gerente-ai/src/modules/whatsapp/
├── whatsapp.module.ts
├── whatsapp.controller.ts                    POST /ai/interpret
├── dto/interpret-message.dto.ts
├── guards/n8n-api-key.guard.ts
└── services/
    ├── whatsapp-interpret.service.ts         orquesta todo
    ├── whatsapp-routing.service.ts           teléfono → sede
    └── message-dedupe.service.ts             idempotencia por wamid

gerente-ai/src/modules/finance-ai/adapters/prisma-finance-data.adapter.ts
```

**Archivos modificados**

```
gerente-ai/src/app.module.ts                                   + WhatsappModule
gerente-ai/src/modules/finance-ai/finance-ai.module.ts         adapter según FINANCE_DATA_SOURCE
gerente-ai/src/modules/finance-ai/domain/finance.types.ts      + confidence
gerente-ai/src/modules/finance-ai/prompts/whatsapp-assistant.prompt.ts   prompt v2
gerente-ai/src/modules/finance-ai/services/whatsapp-message.service.ts   normaliza confidence
gerente-ai/.env.example
```

No se tocó `POST /ai/whatsapp/message`: el frontend sigue funcionando igual.

---

## 2. Contrato de `/ai/interpret`

### Request

```http
POST https://TU-BACKEND.onrender.com/ai/interpret
Content-Type: application/json
x-api-key: <N8N_API_KEY>
```

```json
{
  "message": "compré mercancía por $8,000",
  "phone": "5215512345678",
  "name": "Juan",
  "conversationId": "5215512345678",
  "messageId": "wamid.HBgMNTIx..."
}
```

`messageId` es opcional pero **muy recomendable**: es lo que evita registrar el
gasto dos veces cuando Meta reintenta el evento.

### Response (siempre HTTP 200)

```json
{
  "ok": true,
  "reply": "✅ Registré un gasto de $8.000 en mercancía.",
  "interpreted": {
    "type": "gasto",
    "rawType": "expense",
    "amount": 8000,
    "category": "mercancia",
    "categoryLabel": "Mercancía",
    "concept": "Compra de mercancía",
    "confidence": 0.95,
    "period": null,
    "saved": true,
    "transactionId": "3f1c..."
  },
  "meta": {
    "negocioId": "...", "sedeId": "...", "duplicate": false,
    "promptVersion": "asistente-whatsapp/v2",
    "provider": "groq", "model": "llama-3.3-70b-versatile",
    "latencyMs": 812, "costUsd": 0, "durationMs": 934
  }
}
```

Valores de `type`: `gasto` · `ingreso` · `inversion` · `consulta` · `correccion` ·
`no_claro` · `no_registrado` · `error`.

Casos especiales que n8n debe conocer:

- **Duplicado** → `reply: ""`. El workflow no envía nada (nodo *¿Hay respuesta?*).
- **Número no registrado** → `type: "no_registrado"` y un `reply` de alta. **No se
  llama al modelo**, así que no gasta cuota.
- **Falla la IA** → `ok: false`, `type: "error"` y un `reply` degradado en español.
  Sigue siendo HTTP 200 para que el usuario reciba algo.

Los únicos códigos de error reales son `400` (payload inválido), `401` (API key) y
`5xx` (backend caído). Esos sí salen por la rama de error de n8n.

### Prueba rápida

```bash
curl -X POST https://TU-BACKEND.onrender.com/ai/interpret \
  -H "Content-Type: application/json" \
  -H "x-api-key: TU_N8N_API_KEY" \
  -d '{"message":"compré mercancía por $8000","phone":"573001234567","name":"Juan"}'
```

---

## 3. Variables de entorno

### Backend NestJS (Render → Environment)

| Variable | Valor | Obligatoria |
|---|---|---|
| `DATABASE_URL` | connection string de **Neon**, terminada en `?sslmode=require` | ✅ |
| `N8N_API_KEY` | secreto compartido, `openssl rand -hex 32` | ✅ |
| `FINANCE_DATA_SOURCE` | `prisma` | ✅ |
| `NODE_ENV` | `production` | ✅ |
| `TZ` | `America/Bogota` | ✅ |
| `PORT` | Render la inyecta | — |
| `AI_PROVIDER` | `groq` | ✅ |
| `GROQ_API_KEY` | `gsk_...` | ✅ |
| `AI_MODEL` | `llama-3.3-70b-versatile` | — |
| `AI_FALLBACK_PROVIDER` | `gemini` (recomendado: si Groq satura, el bot sigue) | — |
| `AI_FALLBACK_API_KEY` | `AIza...` | — |
| `AI_TIMEOUT_MS` | `30000` (por debajo del timeout de n8n) | — |
| `CORS_ORIGINS` | dominio del frontend | — |

> `NODE_ENV=production` sin `N8N_API_KEY` hace que `/ai/interpret` rechace todo.
> Es deliberado: es preferible un bot caído a un endpoint abierto.

### n8n (Railway → Variables del servicio n8n)

| Variable | Valor |
|---|---|
| `BACKEND_URL` | `https://TU-BACKEND.onrender.com` (sin `/` final) |
| `WHATSAPP_PHONE_NUMBER_ID` | `1276800955509419` |
| `WHATSAPP_API_VERSION` | `v25.0` |
| `WHATSAPP_TEMPLATE_RECORDATORIO` | `recordatorio_diario` |
| `WHATSAPP_TEMPLATE_RESUMEN` | `resumen_semanal` |
| `WHATSAPP_TEMPLATE_FIADO` | `recordatorio_fiado` |
| `GENERIC_TIMEZONE` | `America/Bogota` |
| `WEBHOOK_URL` | `https://n8n-production-1935.up.railway.app` |

> Si tu instancia tiene bloqueado el acceso a `$env` desde los nodos, cada
> expresión trae un valor por defecto (`{{ $env.BACKEND_URL || 'https://TU-BACKEND...' }}`):
> basta con editar ese literal en el nodo.

### Credenciales de n8n (Credentials → New)

| Credencial | Tipo | Configuración |
|---|---|---|
| `Backend Luka AI (x-api-key)` | *Header Auth* | Name: `x-api-key` · Value: el mismo `N8N_API_KEY` |
| `Bearer Auth account` | *Bearer Auth* | Token permanente de WhatsApp (ya existe) |
| `PostgreSQL Luka AI` | *Postgres* | Datos de **Neon** · **SSL: `require`** (obligatorio en Neon) · solo la usa `03-resumen-semanal` |

Los datos de Postgres salen de **Neon** → tu proyecto → *Connection Details*.
La cadena tiene esta forma, y de ahí se sacan los campos sueltos:

```
postgresql://USUARIO:PASSWORD@HOST.neon.tech/BASE?sslmode=require
             └─user─┘ └─pass─┘ └──host──┘ └db┘
```

En la credencial de n8n: *Host* = el host de Neon, *Port* = `5432`,
*Database* = el nombre de la base, y **SSL = `require`**. Sin SSL, Neon rechaza
la conexión.

---

## 4. Plantillas de WhatsApp (obligatorias para los workflows 2, 3 y 5)

Meta **solo permite texto libre dentro de la ventana de 24 h** desde el último
mensaje del usuario. Un recordatorio a las 21:00 o un resumen del domingo casi
nunca cae dentro de esa ventana, así que **deben ir como plantilla aprobada** o
Meta responde con el error `131047`.

Crear en **Meta Business Manager → WhatsApp Manager → Plantillas de mensajes**:

**1. `recordatorio_diario`** — Categoría: *Utility* · Idioma: *Español*

```
Hola {{1}} 👋 ¿Registraste todos tus movimientos de hoy en {{2}}?

Respóndeme por aquí y los anoto al instante.
```

**2. `resumen_semanal`** — Categoría: *Utility* · Idioma: *Español*

```
📊 Hola {{1}}, este es el resumen semanal de {{2}}:

Ingresos: {{3}}
Gastos: {{4}}
Balance: {{5}}
Mayor gasto: {{6}}

Escríbeme "¿cómo voy este mes?" si quieres el detalle.
```

**3. `recordatorio_fiado`** — Categoría: *Utility* · Idioma: *Español*

```
Hola {{1}} 👋 {{2}} tiene un fiado pendiente de {{3}} desde hace {{4}} días.

No olvides cobrarle. Cuando te pague, escríbeme y lo marco como cobrado.
```

Reglas de los parámetros (si no se respetan, Meta devuelve `132000`):
sin saltos de línea, sin tabulaciones y sin 4 espacios seguidos. Los saltos de
línea van en la plantilla, no en el parámetro. El nodo *Formatear resumen* ya
entrega valores de una sola línea.

La aprobación tarda de minutos a 24 h. Mientras tanto, para probar, escribile
primero al bot desde tu WhatsApp: eso abre la ventana de 24 h y el envío de texto
libre funciona.

---

## 5. Despliegue paso a paso

### 5.1 Backend

```bash
cd gerente-ai
npm install
npx prisma db push     # NO `migrate deploy`: el repo no tiene prisma/migrations
npm run build
npm run start:prod
```

En Render: la configuración completa del servicio (Root Directory, Build/Start
Command, Health Check y variables) está en
[`DESPLIEGUE-RENDER.md`](./DESPLIEGUE-RENDER.md). Verificación:

```bash
curl https://TU-BACKEND.onrender.com/ai/status
curl -H "x-api-key: TU_N8N_API_KEY" https://TU-BACKEND.onrender.com/ai/interpret/ping
```

El segundo debe devolver `{"ok":true,...}`. Si devuelve 401, la API key no coincide.

### 5.2 Importar los workflows

1. n8n → **Workflows** → `...` → **Import from File**.
2. Importá los tres archivos de este directorio.
3. En cada nodo marcado en rojo (credencial no encontrada) seleccioná la
   credencial correspondiente de la tabla del punto 3.
4. En *Settings* de cada workflow confirmá **Timezone = America/Bogota**.

### 5.3 Conectar el webhook de Meta

1. Activá el workflow **01** (toggle *Active*). Sin activar, la URL de producción
   no existe.
2. Copiá la URL de producción del nodo *Webhook WhatsApp*:
   `https://n8n-production-1935.up.railway.app/webhook/whatsapp`
3. Meta → App → **WhatsApp → Configuración → Webhooks → Editar**:
   - Callback URL: la URL de arriba
   - Verify token: cualquier cadena (el flujo devuelve el `hub.challenge` sin
     validarla; ver *Pendientes* al final)
   - **Verificar y guardar** → debe quedar en verde
4. **Administrar → suscribirse al campo `messages`.** Este paso se olvida a
   menudo: sin él Meta valida el webhook pero nunca envía mensajes.

### 5.4 Dar de alta un negocio de prueba

El bot solo responde a números registrados. En la base:

El número de WhatsApp del bot vive en **`Sede.telefono`** (único en la base):
cada sede tiene su propia línea.

```sql
INSERT INTO "Negocio" (id, nombre, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'Panadería El Virrey', now(), now());

INSERT INTO "Sede" (id, nombre, telefono, "negocioId", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'Sede principal', '573001234567',
        (SELECT id FROM "Negocio" WHERE nombre = 'Panadería El Virrey'), now(), now());
```

Usá tu número real en formato internacional sin `+`, tal como lo manda Meta.

`Negocio.telefonoContacto` **no** sirve para esto: el esquema lo marca como
teléfono administrativo y el bot no lo consulta.

### 5.5 Verificación end-to-end

| # | Acción | Resultado esperado |
|---|---|---|
| 1 | `curl .../ai/interpret/ping` | `{"ok":true}` |
| 2 | Escribir por WhatsApp: **"compré mercancía por 8000"** | Respuesta: `✅ Registré un gasto de $8.000 en mercancía.` |
| 3 | `SELECT * FROM "Gasto" ORDER BY fecha DESC LIMIT 1;` | Aparece la fila con monto 8000 |
| 4 | Escribir: **"¿cómo voy esta semana?"** | Resumen con las cifras reales |
| 5 | Escribir: **"gasté algo ayer"** | Pide aclaración, no inventa monto ni registra |
| 6 | Escribir desde un número no registrado | Mensaje de alta, y en los logs del backend `Numero sin negocio asociado` |
| 7 | Ejecutar el workflow 02 con *Execute Workflow* | Log `Negocios sin movimientos hoy: N` |
| 8 | Ejecutar el workflow 03 con *Execute Workflow* | Log con los totales por negocio |

Los workflows 02 y 03 se activan al final, cuando las plantillas estén aprobadas.

---

## 6. Errores frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| `400 property phone should not exist` | El backend desplegado es la versión vieja | Redesplegar con `InterpretMessageDto` |
| `401` desde n8n | `N8N_API_KEY` distinta en backend y credencial | Igualarlas (sin espacios al final) |
| El webhook verifica pero no llegan mensajes | Falta suscribirse al campo `messages` | Meta → Webhooks → Administrar |
| El bot responde dos veces lo mismo | n8n no está enviando `messageId` | Revisar el nodo *Extraer datos* |
| `(#131047) Re-engagement message` | Envío de texto libre fuera de la ventana de 24 h | Usar plantilla aprobada (workflows 02/03) |
| `(#132000) number of parameters does not match` | La plantilla en Meta tiene otra cantidad de variables | Ajustar la plantilla o los `parameters` del nodo |
| El flujo se cae en *Extraer datos* con `undefined` | Llegó un acuse de entrega o un audio | Ya lo filtra *¿Es mensaje de texto?* |
| Respuestas cortadas o `Unexpected token` al enviar | JSON armado a mano con saltos de línea | Los nodos usan `JSON.stringify`: no reemplazar por texto plano |
| El recordatorio llega a quien sí registró | Zona horaria | `TZ=America/Bogota` en backend y n8n |
| `ECONNREFUSED` o `SSL required` en el nodo Postgres | Neon exige TLS | En la credencial de n8n, poner **SSL = `require`** |

Logs útiles del backend (Render → pestaña Logs):

```
[WhatsappInterpretService] Mensaje de Juan (*******4567): "compré mercancía..."
[WhatsappInterpretService] → expense · 8000 COP · confianza 0.95 · guardado=true · groq/llama-3.3-70b-versatile · 934 ms
[WhatsAppMessageService]   Interpretacion floja (confidence=0.4, type=unclear) para: "..."
[WhatsappRoutingService]   Numero sin negocio asociado: *******4567
```

---

## 7. Supuestos y decisiones (leer antes de extender)

1. **`businessId` del dominio de IA = `Sede.id`.** `Gasto`, `Venta` y `Compra`
   cuelgan de `Sede`, no de `Negocio`, y `Sede.telefono` es la línea de WhatsApp
   del bot. Cada sede con línea propia queda resuelta sin ambigüedad.
2. **Resolución del teléfono**: primero `Sede.telefono`, después
   `Usuario.telefono` (un socio o empleado que escribe desde su número personal;
   ahí sí se usa su primera sede). Si no hay coincidencia exacta, se compara por
   los últimos 10 dígitos, porque Meta normaliza prefijos (`52` vs `521`).
   `Negocio.telefonoContacto` no se consulta: es administrativo.
3. **Categorías**: la IA maneja 8 y el enum `CategoriaGasto` de Prisma tiene 5.
   Las que no tienen equivalente caen en `OTROS` y la etiqueta original queda en
   `descripcion` (`"Mercancía · Compra de harina"`). Para fidelidad total,
   agregar valores al enum y volver a generar el cliente:
   ```prisma
   enum CategoriaGasto { ARRIENDO SERVICIOS NOMINA TRANSPORTE OTROS
                         MERCANCIA INSUMOS MANTENIMIENTO INVERSION }
   ```
   y añadirlos a `CATEGORY_TO_PRISMA` en `prisma-finance-data.adapter.ts`.
4. **Inversiones** se guardan como `Gasto` con `descripcion` prefijada
   `"Inversion · ..."`. Al releerlas vuelven como gasto: la base no distingue el
   tipo hasta que exista el valor de enum.
5. **Moneda**: `COP` fija. El esquema todavía no guarda moneda por negocio.
6. **Deduplicación en memoria del proceso.** Con más de una instancia del backend
   hay que moverla a Redis o a un índice único sobre el `wamid`.
7. **Correcciones** (`"corrijo: eran $5.000"`, `"borra el último gasto"`) sí
   modifican el registro. El backend busca entre los movimientos de los últimos
   31 días de esa sede: sin referencia toma el más reciente, y con referencia
   (`"el de transporte"`) busca por texto. Si hay varios candidatos pregunta en
   vez de adivinar. Escribe sobre las mismas tablas que lee el panel, así que el
   cambio se ve en la web sin ningún paso de sincronización.
8. **Quién puede recibir un mensaje** se define **una sola vez**, en
   `DestinatariosService` (backend), y los workflows la consultan por HTTP. Antes
   el workflow 02 tenía su propio SQL que solo miraba `Sede.telefono` y
   `Sede.whatsappUserId`; quien usaba el bot desde su número personal escribía
   sin problema pero **nunca recibía el recordatorio**. Si esa regla vuelve a
   escribirse en dos sitios, el error vuelve.
9. **`GET /ai/recordatorios/fiados` marca los avisos como enviados al servirlos**,
   no después. Dos ejecuciones que se solapen mandarían el mismo recordatorio dos
   veces; se prefiere perder un aviso a repetirlo cada día. Por eso ese nodo no
   reintenta y **no conviene ejecutarlo a mano para probar**: quema los avisos del
   día.
10. **El `verify_token` de Meta no se valida** en el workflow (se devuelve el
   `hub.challenge` sin comprobarlo). Es la conducta que ya tenía el flujo actual y
   sirve; para endurecerlo, agregar una condición contra
   `{{ $json.query['hub.verify_token'] }}`.
11. **La firma `X-Hub-Signature-256` no se verifica.** Cualquiera que conozca la URL
   del webhook puede simular un mensaje de Meta. Como el backend sí valida el
   número contra la base, el daño está acotado, pero conviene añadirlo antes de
   operar con clientes reales.

---

## 8. Usuarios con nombre de usuario de WhatsApp (sin teléfono)

Meta permite activar un **nombre de usuario** en WhatsApp. Las cuentas que lo
hacen **no exponen su número**: el webhook llega sin `from` ni `wa_id`, y en su
lugar trae una identidad propia.

```
messages[0].from_user_id : "CO.1710763673557397"
contacts[0].user_id      : "CO.1710763673557397"
contacts[0].username     : "jdar0423"
```

Antes esto rompía el flujo: `phone` quedaba `null`, el backend respondía `400`
(`phone must be a string`) y el envío de la respuesta fallaba con
`The parameter to is required`. El usuario se quedaba sin ninguna respuesta y no
era evidente por qué le pasaba solo a él.

**Cómo funciona ahora**

| Dato | De dónde sale | Para qué |
|---|---|---|
| `phone` | `messages[0].from` o `contacts[0].wa_id` | Identificar la sede |
| `userId` | `messages[0].from_user_id` o `contacts[0].user_id` | Identificar la sede cuando no hay teléfono |
| `destinatario` | el primero de los dos que exista | Campo `to` al responder |

El backend acepta `phone`, `userId` o ambos, y resuelve en este orden:
`Sede.whatsappUserId` → `Sede.telefono` → `Usuario.telefono`.

**Vincular a alguien que escribe con identidad**

Lo que se le pide a la persona es su **nombre de usuario** ("jdar0423"), no el
BSUID: es lo que ella conoce y puede escribir. El BSUID lo captura el sistema
solo, del primer mensaje, y a partir del segundo resuelve por él (es más estable,
porque el nombre de usuario se puede cambiar).

```sql
UPDATE "Sede" SET "whatsappUsername" = jdar0423
WHERE telefono = 573014132284;
```

Cuando el frontend tenga el campo "Usuario de WhatsApp" en el formulario de
negocio, esto deja de necesitar SQL.

**Vincular a mano por identidad** (si Meta no mandó el nombre de usuario)

Su identificador aparece en el mensaje que Luka le responde (y en los logs del
backend). Con eso:

```sql
UPDATE "Sede"
SET "whatsappUserId" = 'CO.1710763673557397'
WHERE telefono = '573014132284';
```

El campo es único: una identidad no puede estar en dos sedes.

**Cómo responderles: con `recipient`, no con `to`.**

Meta llama a esa identidad **BSUID** (*business-scoped user ID*) y la Cloud API
usa un campo distinto según a quién se le escriba:

| Destinatario | Campo | Ejemplo |
|---|---|---|
| Teléfono | `to` | `573014132284` |
| Cuenta que oculta su número | `recipient` | `CO.1710763673557397` |

No son intercambiables. Mandar un BSUID en `to` devuelve **200 y un `wamid`**, así
que parece que funcionó, pero el acuse posterior llega así:

```json
"statuses": [{ "status": "failed", "recipient_id": "1710763673557397" }]
```

Meta le quitó el prefijo `CO.` y lo trató como si fuera un teléfono. Verificado en
producción el 28/08/2026, respondiendo dentro de la ventana de 24 h (o sea, no era
un problema de ventana).

El BSUID va **completo**: prefijo de país, punto y todos los caracteres. Quitar o
cambiar cualquier parte hace fallar la petición.

**Limitación que queda:** los BSUID no sirven para plantillas de autenticación
(one-tap, zero-tap, copy code), que exigen teléfono. No afecta a este proyecto.

Documentación: https://developers.facebook.com/documentation/business-messaging/whatsapp/business-scoped-user-ids/
