### Declaración de Transferencia Internacional de Datos y Tratamiento de Información con Modelos de IA

Para la ejecución de tareas de procesamiento inteligente y análisis de datos, el sistema **Luka AI / Gerente AI** cuenta con un módulo de arquitectura desacoplada e interoperable (`src/ai/providers/`) que permite la integración con diversos proveedores globales de Inteligencia Artificial (tales como Google, Anthropic o proveedores compatibles con la especificación de OpenAI).

Actualmente, el proveedor activo y configurado por defecto en la aplicación es **Google LLC**, operando mediante la API comercial de **Google Gemini** (modelo activo: `Gemini 3.6 Flash`). 

En cumplimiento con los requerimientos legales y de tratamiento de datos personales:
1. **Transferencia Internacional:** La transmisión de las peticiones y contenidos de mensajes se realiza mediante conexiones API seguras (HTTPS/TLS) hacia la infraestructura de Google LLC situada principalmente en Estados Unidos.
2. **Uso de Datos y Entrenamiento:** Se declara y confirma, con base en los términos del servicio empresarial / API de Google, que los contenidos enviados, respuestas generadas y datos transmitidos a través de la API **NO son utilizados por el proveedor para entrenar, re-entrenar o mejorar sus modelos públicos o privados de IA**.