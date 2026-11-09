import { Module } from '@nestjs/common';
import { ProductosController } from '../controllers/productos.controller';
import { ProductosService } from '../services/productos.service';
import { NegociosModule } from './negocios.module';
import { PlanesModule } from './planes.module';

@Module({
  imports: [NegociosModule, PlanesModule],
  controllers: [ProductosController],
  providers: [ProductosService],
})
export class ProductosModule {}
