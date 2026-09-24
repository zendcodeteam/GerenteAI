import { Controller, Get, Param, Post, Body, Query, UseGuards } from '@nestjs/common';
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

  @Get('recordatorios')
  recordatorios() {
    return this.service.recordatorios();
  }
}
