import { Module } from '@nestjs/common';
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
    ScheduleModule.forRoot(),
    AuthModule,
    DashboardConfigModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
