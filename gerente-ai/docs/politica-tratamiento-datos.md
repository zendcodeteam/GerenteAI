### Declaración de Transferencia Internacional de Datos y Tratamiento de Información con Modelos de IA

Para la ejecución de tareas de procesamiento inteligente y análisis de datos, el sistema **Luka AI / Gerente AI** cuenta con un módulo de arquitectura desacoplada e interoperable (`src/ai/providers/`) que permite la integración con diversos proveedores globales de Inteligencia Artificial (tales como Google, Anthropic o proveedores compatibles con la especificación de OpenAI).

Actualmente, el proveedor activo y configurado por defecto en la aplicación es **Google LLC**, operando mediante la API comercial de **Google Gemini** (modelo activo: `Gemini 3.6 Flash`). 

En cumplimiento con los requerimientos legales y de tratamiento de datos personales:
1. **Transferencia Internacional:** La transmisión de las peticiones y contenidos de mensajes se realiza mediante conexiones API seguras (HTTPS/TLS) hacia la infraestructura de Google LLC situada principalmente en Estados Unidos.
2. **Uso de Datos y Entrenamiento:** Se declara y confirma, con base en los términos del servicio empresarial / API de Google, que los contenidos enviados, respuestas generadas y datos transmitidos a través de la API **NO son utilizados por el proveedor para entrenar, re-entrenar o mejorar sus modelos públicos o privados de IA**.

---

### Política de Retención y Supresión de Conversaciones y Mensajes

En cumplimiento de los principios de minimización de datos y limitación del plazo de conservación:

1. **Plazo de Retención:** Los mensajes, transcripciones y registros conversacionales generados a través de WhatsApp con **Luka AI / Gerente AI** (almacenados en la tabla `Mensaje`) se conservan en la base de datos operativa por un período máximo de **doce (12) meses** contados a partir de su fecha de emisión o recepción.
2. **Finalidad de la Retención Temporal:** Dicho plazo permite garantizar el soporte operativo, la auditoría contable de movimientos recientes, la trazabilidad de consultas sobre fiados y ventas, y la continuidad de contexto conversacional para el negocio.
3. **Mecanismo de Supresión Automatizada:** El sistema cuenta con una tarea programada (*cron job* diario y endpoint administrativo bajo rol `MASTER`) que ejecuta la depuración física de todos los registros cuya antigüedad supere los 12 meses, garantizando la eliminación irreversible de datos financieros históricos y nombres de terceros.