# Manejo de secretos

Cómo se comparten, dónde viven y cómo se rotan las credenciales de Luka AI.

Este documento nace del hallazgo **A-7** de la auditoría de seguridad
(SCRUM-11): durante el desarrollo se compartieron por chat la cadena de
conexión completa de Neon, el token de Meta y el `N8N_API_KEY`. El repositorio
está limpio —se revisó el histórico completo—, pero esas credenciales quedaron
en conversaciones que nadie controla y que no se pueden borrar de verdad.

---

## 1. El acuerdo

Seis reglas. Son cortas a propósito: un acuerdo que nadie recuerda no sirve.

1. **Un secreto nunca se pega en un chat.** Ni en WhatsApp, ni en Discord, ni
   por correo. Tampoco "solo por ahora" ni "solo para que lo pruebes": esas dos
   frases son exactamente como se filtraron las tres de arriba.

2. **Se comparten por el gestor de contraseñas del equipo, o no se comparten.**
   Lo segundo suele ser mejor: quien necesite una credencial la lee del panel
   del proveedor, donde además queda registro de quién entró.

3. **Nunca en el repositorio.** Ni en un `.env` versionado, ni en un comentario,
   ni en una captura de pantalla dentro de un issue. La referencia de qué
   variables existen es [`.env.example`](../.env.example), siempre con valores
   de mentira.

4. **Si un secreto se filtra, se rota. No se borra el mensaje.** Borrar el
   mensaje no borra las capturas, las notificaciones ni las copias locales de
   quien lo recibió. Lo único que corta el riesgo es cambiar el valor.

5. **Cuando alguien sale del equipo se rota todo lo que tuvo a la vista.** No
   es desconfianza: es que un acceso que ya no se usa no debería seguir vivo.

6. **Cada rotación se anota** en la sección 4 de este documento. Sin registro no
   hay forma de saber si una credencial lleva un mes o un año sin cambiarse.

---

## 2. Inventario: qué secretos existen y dónde vive cada uno

Un secreto suele estar en **dos** sitios a la vez, y ese es el detalle que rompe
las rotaciones: se cambia en uno y se olvida el otro.

| Secreto | Se genera en | Lo consume |
|---|---|---|
| `DATABASE_URL` | Neon → Roles | Render (backend) · n8n, credencial `PostgreSQL Luka AI` (flujo 03) |
| Token de Meta | Meta Business → Usuarios del sistema | n8n, credencial `Bearer Auth account` (flujos 01, 02, 03, 05) |
| `META_APP_SECRET` | Meta for Developers → Configuración básica | n8n, nodo `Verificar firma de Meta` (flujo 01) |
| `N8N_API_KEY` | Lo inventamos nosotros | Render (backend) · n8n, credencial `Backend Luka AI (x-api-key)` (flujos 01, 02, 05) |
| `JWT_SECRET` | Lo inventamos nosotros | Render (backend) |
| `MFA_ENCRYPTION_KEY` | Lo inventamos nosotros | Render (backend) |
| `AI_API_KEY` y `AI_FALLBACK_API_KEY` | Panel del proveedor de IA activo | Render (backend) |
| `WOMPI_EVENTS_SECRET`, `WOMPI_INTEGRITY_SECRET` | Panel de Wompi | Render (backend) |
| `SMTP_PASS` / `BREVO_API_KEY` | Panel del proveedor de correo | Render (backend) |

**Los que inventamos nosotros no se escriben a mano.** Una clave pensada por una
persona es adivinable. Se generan así:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 3. Runbook de rotación

El orden importa. Hecho al revés, el bot se cae y no se sabe cuál de los
cambios lo rompió.

**Antes de empezar:** avisar al equipo y acordar día y hora. Hay unos minutos de
corte y no deberían caer en medio de una demostración a un cliente.

### Paso 1 · Token de Meta — sin interrupción

1. [business.facebook.com](https://business.facebook.com) → Configuración del
   negocio → Usuarios del sistema → **Generar nuevo token**.
2. Pegarlo en la credencial `Bearer Auth account` de n8n.
3. **Después** revocar el token anterior.

Los dos conviven mientras tanto, así que no hay corte. Revocar antes de pegar el
nuevo sí lo habría.

### Paso 2 · `N8N_API_KEY` — corte de 2 a 5 minutos

El backend compara contra un solo valor, así que hay ventana sí o sí.

1. Generar la clave nueva con el comando de arriba.
2. Ponerla en Render. Eso dispara un redespliegue: el backend queda abajo
   durante el build.
3. **Mientras Render reconstruye**, cambiar la credencial
   `Backend Luka AI (x-api-key)` en n8n.

Cuando Render vuelve, las dos ya coinciden y el corte no fue mayor que el propio
despliegue.

### Paso 3 · Neon — el más delicado, va de último

1. [console.neon.tech](https://console.neon.tech) → proyecto → Roles →
   **Reset password**. La cadena anterior muere en ese instante.
2. Actualizar `DATABASE_URL` en Render.
3. Actualizar la credencial `PostgreSQL Luka AI` en n8n.

⚠️ El Start Command de Render corre `prisma db push`, así que si la cadena queda
mal escrita el despliegue **falla** y Render se queda sirviendo la versión
anterior. Hay que leer el log del despliegue hasta el final, no solo ver que el
servicio responde.

### Verificación

No se da por cerrada una rotación sin estas tres:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://gerenteai.onrender.com/health
# 200

curl -s -o /dev/null -w "%{http_code}\n" -H "x-api-key: LA_CLAVE_NUEVA" \
  https://gerenteai.onrender.com/ai/interpret/ping
# 200
```

Y un mensaje real a Luka por WhatsApp, que es lo único que prueba la cadena
completa: Meta → n8n → backend → base de datos → respuesta.

---

## 4. Registro de rotaciones

| Fecha | Secreto | Quién | Notas |
|---|---|---|---|
| _pendiente_ | Token de Meta | | |
| _pendiente_ | `DATABASE_URL` (Neon) | | |

---

## 5. Decisiones tomadas

### `N8N_API_KEY`: rotación aplazada

**21 de septiembre de 2026.** Se decide no rotarla por ahora y conservar el
valor actual.

Queda anotado para que la decisión sea explícita y no un olvido: esa clave se
compartió por chat igual que las otras dos, y además es una palabra corta de
diccionario, así que se adivina por fuerza bruta en poco tiempo. Quien la tenga
puede escribir y borrar movimientos en la contabilidad de cualquier negocio a
través de `/ai/interpret`.

Lo que sí está mitigado: desde SCRUM-11 el webhook de WhatsApp verifica la firma
de Meta, así que el camino de entrada por n8n ya no está abierto. El riesgo que
queda es el acceso directo al backend por parte de quien conozca la clave.

Cuando se rote, seguir el paso 2 del runbook y anotarlo en la sección 4.
