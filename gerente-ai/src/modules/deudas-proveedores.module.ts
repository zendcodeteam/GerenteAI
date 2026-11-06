import { Module } from '@nestjs/common';
import { DeudasProveedoresController } from '../controllers/deudas-proveedores.controller';
import { DeudasProveedoresService } from '../services/deudas-proveedores.service';
import { PrismaModule } from './prisma.module';
import { NegociosModule } from './negocios.module';

@Module({
  imports: [PrismaModule, NegociosModule],
  controllers: [DeudasProveedoresController],
  providers: [DeudasProveedoresService],
  exports: [DeudasProveedoresService],
})
export class DeudasProveedoresModule {}
