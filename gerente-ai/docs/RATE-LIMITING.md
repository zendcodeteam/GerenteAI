# Límites de peticiones

## Interruptor de emergencia

`RATE_LIMIT_DISABLED=true` en el servidor apaga **todos** los límites, incluido
el de WhatsApp, sin desplegar código. Railway reinicia el contenedor al cambiar
la variable. Es lo primero que hay que hacer si algo bloquea a usuarios reales.

## Qué se limita

| Endpoints | Límite | Por qué |
| --- | --- | --- |
| Todo lo demás | 600/min por IP y por ruta (`RATE_LIMIT_GLOBAL`) | Cada endpoint lleva su propio contador. No es más bajo porque el dashboard se refresca solo cada 8 s (7,5 peticiones/min por pestaña) y varios usuarios comparten IP: con 60 bastaban ocho pestañas para empezar a devolver 429. |
| `/ai/*` del frontend (`assistant/ask`, `insights`, `whatsapp/message`, `status`…) | 20/min por IP | Cada llamada cuesta una llamada al modelo y hoy estas rutas no piden sesión. |
| `login`, `google`, `google/register`, `mfa/*` | 30 cada 15 min por IP | No son 5: en redes móviles (CGNAT) y en el wifi de un negocio varios usuarios comparten IP. La fuerza bruta contra una cuenta la cortan los bloqueos por cuenta. |
| `register`, `forgot-password`, `reenviar-verificacion`, `cambiar-email` | 5 cada 15 min por IP | Cada petición manda un correo a una dirección que elige quien llama. Protege la reputación del remitente y la cuota de Brevo. |
| `verificar-email`, `reset-password`, `confirmar-cambio-email` | 10 cada 15 min por IP | Se abren desde el correo y a veces se reintentan. |
| `/ai/interpret` | 20 mensajes cada 5 min **por remitente de WhatsApp** | Todo n8n sale de una sola IP: limitar por IP sumaría a todos los negocios. Al pasarse, el comerciante recibe un aviso amable y no se llama a la IA. |

## Qué NO se limita

- **Rutas de n8n** (`/ai/interpret`, `/ai/interpret/enviado`, `/ai/recordatorios/*`,
  `/ai/interpret/ping`): las protege la API key, y un límite por IP dejaría sin
  servicio a todo WhatsApp.
- **`/pagos/webhook`**: lo autentica la firma de Wompi, que además reintenta lo
  que no confirmamos; un 429 solo generaría más reintentos.
- **`/health`**: lo consulta la plataforma de despliegue.

## Bloqueos por cuenta (no dependen de la IP)

- **Login:** 5 contraseñas incorrectas bloquean 15 minutos
  (`intentosFallidos`, `bloqueadoHasta`). Insistir durante el bloqueo no lo
  alarga, y cambiar la contraseña lo levanta. A quien no acierta la contraseña
  se le responde el mensaje genérico, para no revelar qué correos existen.
- **MFA:** 5 códigos incorrectos bloquean 15 minutos. Ver [MFA.md](MFA.md).

## `trust proxy`

`main.ts` hace `app.set('trust proxy', 1)`. Sin eso, Railway entrega su IP
interna para todo el tráfico y **todos los usuarios compartirían un solo
contador**. Para comprobarlo después de desplegar: llama
`GET /ai/interpret/ping` sin API key y mira el log; debe aparecer tu IP real,
no una `10.x` o `100.x`.

## Ajustar los límites

El global se puede cambiar sin desplegar con `RATE_LIMIT_GLOBAL` (por ejemplo
`RATE_LIMIT_GLOBAL=1200`). Los demás viven en `finance-ai.controller.ts` y en las constantes
`LIMITE_CREDENCIALES`, `LIMITE_CORREOS` y `LIMITE_ENLACES` de
`auth.controller.ts`. El de WhatsApp está en `limite-por-remitente.service.ts`.
Subirlos es cambiar un número.

## Limitación conocida

Los contadores viven en la memoria del proceso: se reinician con cada
despliegue y, si algún día corren varias réplicas, cada una cuenta por su lado
(el límite se relaja, nunca se endurece). Para un límite exacto entre réplicas
haría falta Redis.
