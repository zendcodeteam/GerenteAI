import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DeudasProveedoresService } from '../services/deudas-proveedores.service';
import { CreateDeudaProveedorDto } from '../dto/deudas-proveedores/create-deuda-proveedor.dto';
import { UpdateDeudaProveedorDto } from '../dto/deudas-proveedores/update-deuda-proveedor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

type AuthUser = { userId: string; rolGlobal: string };

@Controller('deudas-proveedores')
@UseGuards(JwtAuthGuard)
export class DeudasProveedoresController {
  constructor(
    private readonly deudasProveedoresService: DeudasProveedoresService,
  ) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDeudaProveedorDto) {
    return this.deudasProveedoresService.create(
      user.userId,
      user.rolGlobal,
      dto,
    );
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('sedeId') sedeId?: string,
    @Query('proveedorId') proveedorId?: string,
  ) {
    return this.deudasProveedoresService.findAll(
      user.userId,
      user.rolGlobal,
      sedeId,
      proveedorId,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.deudasProveedoresService.findOne(
      id,
      user.userId,
      user.rolGlobal,
    );
  }

  @Get(':id/plan')
  plan(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.deudasProveedoresService.plan(id, user.userId, user.rolGlobal);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateDeudaProveedorDto,
  ) {
    return this.deudasProveedoresService.update(
      id,
      user.userId,
      user.rolGlobal,
      dto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.deudasProveedoresService.remove(
      id,
      user.userId,
      user.rolGlobal,
    );
  }
}
