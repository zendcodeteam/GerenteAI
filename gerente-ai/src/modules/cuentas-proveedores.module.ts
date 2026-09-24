import { Module } from '@nestjs/common';
import { CuentasProveedoresController } from '../controllers/cuentas-proveedores.controller';
import { CuentasProveedoresService } from '../services/cuentas-proveedores.service';
import { NegociosModule } from './negocios.module';

@Module({
  imports: [NegociosModule],
  controllers: [CuentasProveedoresController],
  providers: [CuentasProveedoresService],
  exports: [CuentasProveedoresService],
})
export class CuentasProveedoresModule {}
