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
import { NominaService } from '../services/nomina.service';
import { CreatePagoNominaDto } from '../dto/nomina/create-pago-nomina.dto';
import { UpdatePagoNominaDto } from '../dto/nomina/update-pago-nomina.dto';
import { QueryPagoNominaDto } from '../dto/nomina/query-pago-nomina.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

type AuthUser = { userId: string; rolGlobal: string };

@Controller('nomina')
@UseGuards(JwtAuthGuard)
export class NominaController {
  constructor(private readonly nominaService: NominaService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePagoNominaDto) {
    return this.nominaService.create(user.userId, user.rolGlobal, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryPagoNominaDto) {
    return this.nominaService.findAll(user.userId, user.rolGlobal, query);
  }

  @Get('trabajador/:nombre')
  findByTrabajador(
    @CurrentUser() user: AuthUser,
    @Param('nombre') nombre: string,
    @Query('sedeId') sedeId?: string,
  ) {
    return this.nominaService.findByTrabajador(
      user.userId,
      user.rolGlobal,
      nombre,
      sedeId,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.nominaService.findOne(id, user.userId, user.rolGlobal);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePagoNominaDto,
  ) {
    return this.nominaService.update(id, user.userId, user.rolGlobal, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.nominaService.remove(id, user.userId, user.rolGlobal);
  }
}
