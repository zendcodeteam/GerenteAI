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
import { ProductosService } from '../services/productos.service';
import { CreateProductoDto } from '../dto/productos/create-producto.dto';
import { UpdateProductoDto } from '../dto/productos/update-producto.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

type AuthUser = { userId: string; rolGlobal: string };

@Controller('productos')
@UseGuards(JwtAuthGuard)
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductoDto) {
    return this.productosService.create(user.userId, user.rolGlobal, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('sedeId') sedeId?: string,
    @Query('categoria') categoria?: string,
    @Query('search') search?: string,
    @Query('stockBajo') stockBajo?: string,
  ) {
    return this.productosService.findAll(user.userId, user.rolGlobal, {
      sedeId,
      categoria,
      search,
      // En la query todo llega como texto. Se aceptan las dos formas que
      // manda un frontend: ?stockBajo=true y ?stockBajo=1.
      stockBajo: stockBajo === 'true' || stockBajo === '1',
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.productosService.findOne(id, user.userId, user.rolGlobal);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProductoDto,
  ) {
    return this.productosService.update(id, user.userId, user.rolGlobal, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.productosService.remove(id, user.userId, user.rolGlobal);
  }
}
