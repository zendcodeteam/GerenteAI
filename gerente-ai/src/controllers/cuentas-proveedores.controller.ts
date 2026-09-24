import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CuentasProveedoresService } from '../services/cuentas-proveedores.service';
import { CreatePagoProveedorDto } from '../dto/compras/create-pago-proveedor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

type AuthUser = { userId: string; rolGlobal: string };

@Controller('cuentas-proveedores')
@UseGuards(JwtAuthGuard)
export class CuentasProveedoresController {
  constructor(private readonly service: CuentasProveedoresService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query('sedeId') sedeId?: string) {
    return this.service.findAll(user.userId, user.rolGlobal, sedeId);
  }

  @Post(':id/pagos')
  pagar(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePagoProveedorDto,
  ) {
    return this.service.pagar(id, user.userId, user.rolGlobal, dto);
  }

  /*
   * Aqui habia un GET 'recordatorios' y se quito porque filtraba datos entre
   * negocios.
   *
   * Llamaba a `service.recordatorios()` sin usuario y sin filtro de sede, asi
   * que cualquiera con una cuenta en Luka recibia las deudas con proveedores,
   * los montos, los telefonos y los nombres de TODOS los negocios de la
   * plataforma. Y como ese metodo ademas escribe —marca los avisos como
   * enviados y pone la cuenta en VENCIDA—, bastaba con llamarlo para que los
   * recordatorios de otro negocio no le llegaran nunca.
   *
   * No se reemplaza por una version filtrada porque nadie la consumia: el
   * frontend no la usa y n8n tiene la suya, GET /ai/recordatorios/proveedores,
   * protegida con la API key de integracion. Un endpoint que nadie llama es
   * superficie de ataque y nada mas.
   */
}
