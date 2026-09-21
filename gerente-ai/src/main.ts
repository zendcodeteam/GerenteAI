import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { aplicarCabecerasDeSeguridad } from './seguridad';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Las notas de voz y las fotos de WhatsApp llegan en base64
  // dentro del JSON. Express tiene un límite por defecto de 100 kB,
  // por lo que lo aumentamos para soportar correctamente estos
  // archivos.
  //
  // Una foto de Meta puede pesar hasta aproximadamente 5 MB,
  // que en base64 puede superar los 6 MB.
  /**
   * Railway recibe la petición y la reenvía al contenedor con la IP real del
   * visitante en X-Forwarded-For. Sin esto, `req.ip` sería la IP interna del
   * proxy para todo el mundo y el rate limiting trataría a todos los usuarios
   * como uno solo: al quinto login de cualquiera, nadie más podría entrar.
   *
   * `1` = confiar solo en el último salto (el proxy de Railway). Un valor
   * mayor permitiría que el cliente falsificara su IP en el header.
   */
  app.set('trust proxy', 1);

  /**
   * Cabeceras de seguridad HTTP. Va lo primero para que las lleven TODAS las
   * respuestas, incluidas las de error: si se pusiera despues, un fallo en un
   * middleware anterior devolveria una respuesta sin proteger.
   *
   * El detalle de que se permite y por que esta en `seguridad.ts`.
   */
  aplicarCabecerasDeSeguridad(app);

  app.useBodyParser('json', {
    limit: '12mb',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  /*
   * CORS
   *
   * En producción, CORS_ORIGINS debe contener el dominio del
   * frontend de Luka.
   *
   * Ejemplo:
   *
   * CORS_ORIGINS=https://luka.finance,https://www.luka.finance
   *
   * También permitimos localhost para desarrollo.
   */
  const configuredOrigins = process.env.CORS_ORIGINS?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const allowedOrigins =
    configuredOrigins && configuredOrigins.length > 0
      ? configuredOrigins
      : ['http://localhost:5173', 'http://localhost:3000'];

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requests que no tengan Origin.
      //
      // Esto puede ocurrir con herramientas como Postman,
      // algunos health checks y determinadas peticiones
      // internas.
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origen no permitido por CORS: ${origin}`), false);
    },

    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],

    allowedHeaders: ['Content-Type', 'Authorization'],

    credentials: true,
  });

  const port = process.env.PORT ?? 3000;

  await app.listen(port);

  new Logger('Bootstrap').log(
    `Luka AI API escuchando en http://localhost:${port}`,
  );
}

void bootstrap();
