import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';

import { AiModule } from './ai/ai.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FinanceAiModule } from './modules/finance-ai/finance-ai.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { PrismaModule } from './modules/prisma.module';
import { NegociosModule } from './modules/negocios.module';
import { SedesModule } from './modules/sedes.module';
import { ProductosModule } from './modules/productos.module';
import { ClientesModule } from './modules/clientes.module';
import { ProveedoresModule } from './modules/proveedores.module';
import { GastosModule } from './modules/gastos.module';
import { UsuarioSedesModule } from './modules/usuario-sedes.module';
import { VentasModule } from './modules/ventas.module';
import { ComprasModule } from './modules/compras.module';
import { AbonosModule } from './modules/abonos.module';
import { ReportesModule } from './modules/reportes.module';
import { PlanesModule } from './modules/planes.module';
import { PagosModule } from './modules/pagos.module';
import { RecordatoriosModule } from './modules/recordatorios.module';
import { RetencionMensajesModule } from './modules/retencion-mensajes.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { DashboardConfigModule } from './modules/dashboard-config.module';

@Module({
  imports: [
    // Carga .env antes de que AiModule resuelva el proveedor.
    ConfigModule.forRoot({ isGlobal: true }),

    // Inteligencia Artificial
    AiModule,
    FinanceAiModule,

    // Canal de WhatsApp: lo consume n8n (ver docs/INTEGRACIONES.md)
    WhatsappModule,

    // Backend / negocio
    PrismaModule,
    NegociosModule,
    SedesModule,
    ProductosModule,
    ClientesModule,
    ProveedoresModule,
    GastosModule,
    UsuarioSedesModule,
    VentasModule,
    ComprasModule,
    AbonosModule,
    ReportesModule,
    PlanesModule,
    PagosModule,
    RecordatoriosModule,
    RetencionMensajesModule,
    ScheduleModule.forRoot(),
    /**
     * Límite global: 600 peticiones por minuto, por IP y por ruta (cada
     * endpoint lleva su propio contador).
     *
     * No es más bajo porque el dashboard se refresca solo cada 8 segundos
     * (7,5 peticiones por minuto y por pestaña) y en Colombia es normal que
     * varios usuarios compartan IP pública: el wifi de un negocio, o el CGNAT
     * de un operador móvil. Con 60 bastaban ocho pestañas abiertas para
     * empezar a devolverles 429 a usuarios que no hicieron nada malo. Lo que
     * este límite corta es el martilleo de un script, no el uso normal; lo
     * sensible (credenciales, correos, IA) tiene su propio límite más bajo.
     *
     * Quedan fuera con @SkipThrottle lo que no llega desde el navegador de
     * una persona: n8n (todo WhatsApp sale de una sola IP), el webhook de
     * Wompi y /health.
     *
     * Contadores en memoria: se reinician con cada despliegue y, con varias
     * réplicas, cada una cuenta por su lado (el límite se relaja, nunca se
     * endurece).
     */
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60_000,
          limit: Number(
            process.env.RATE_LIMIT_GLOBAL ?? 600,
          ),
        },
      ],
      errorMessage:
        'Demasiadas solicitudes seguidas. Espera un momento e inténtalo de nuevo.',
      // Interruptor de emergencia: RATE_LIMIT_DISABLED=true en el servidor
      // apaga todos los límites sin desplegar código.
      skipIf: () => process.env.RATE_LIMIT_DISABLED === 'true',
    }),
    AuthModule,
    DashboardConfigModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
