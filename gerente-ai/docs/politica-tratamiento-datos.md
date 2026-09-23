### Declaración de Transferencia Internacional de Datos y Tratamiento de Información con Modelos de IA

Para la ejecución de tareas de procesamiento inteligente y análisis de datos, el sistema **Luka AI / Gerente AI** cuenta con un módulo de arquitectura desacoplada e interoperable (`src/ai/providers/`) que permite la integración con diversos proveedores globales de Inteligencia Artificial (tales como Google, Anthropic o proveedores compatibles con la especificación de OpenAI).

Actualmente, el proveedor activo y configurado por defecto en la aplicación es **Google LLC**, operando mediante la API comercial de **Google Gemini** (modelo activo: `Gemini 3.6 Flash`). 

### Datos de terceros registrados por el negocio

Cuando un negocio utiliza Luka para registrar clientes fiados, el negocio actúa como responsable del tratamiento frente a esas personas. El negocio debe contar con una base de legitimación válida para recolectar y usar sus datos, informarles las finalidades aplicables y suministrarles los canales para ejercer sus derechos.

Luka actúa como encargado del tratamiento por cuenta del negocio, limitado a almacenar y procesar la información necesaria para gestionar cuentas por cobrar, ventas a crédito, abonos, recordatorios y reportes solicitados por el negocio. El negocio no debe registrar datos sensibles ni información que no sea necesaria para esas finalidades.

El negocio puede solicitar la supresión de un cliente fiado desde el flujo autorizado de clientes. Para proteger la integridad contable, la supresión elimina los datos identificables del tercero y desvincula su identidad de las ventas y abonos históricos, pero conserva los importes, fechas y demás datos estrictamente necesarios para la trazabilidad financiera y el cumplimiento de obligaciones legales. La operación se ejecuta de forma transaccional y no debe dejar referencias de base de datos hacia el cliente eliminado.

La relación entre el negocio responsable y Luka como encargado deberá documentarse mediante la aceptación de los términos del servicio o un contrato de encargo de tratamiento, incluyendo instrucciones, confidencialidad, seguridad, subcontratación, atención de derechos, devolución o supresión de información y gestión de incidentes.

En cumplimiento con los requerimientos legales y de tratamiento de datos personales:
1. **Transferencia Internacional:** La transmisión de las peticiones y contenidos de mensajes se realiza mediante conexiones API seguras (HTTPS/TLS) hacia la infraestructura de Google LLC situada principalmente en Estados Unidos.
2. **Uso de Datos y Entrenamiento:** Se declara y confirma, con base en los términos del servicio empresarial / API de Google, que los contenidos enviados, respuestas generadas y datos transmitidos a través de la API **NO son utilizados por el proveedor para entrenar, re-entrenar o mejorar sus modelos públicos o privados de IA**.