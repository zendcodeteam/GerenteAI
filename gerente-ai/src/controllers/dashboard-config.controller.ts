import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpsertDashboardConfigDto } from '../dto/dashboard-config/upsert-dashboard-config.dto';
import { DashboardConfigService } from '../services/dashboard-config.service';

type AuthUser = { userId: string; rolGlobal: string };

@Controller('dashboard-config')
@UseGuards(JwtAuthGuard)
export class DashboardConfigController {
  constructor(private readonly config: DashboardConfigService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('sedeId') sedeId?: string,
  ) {
    return this.config.findAll(user.userId, user.rolGlobal, sedeId);
  }

  @Patch()
  upsert(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertDashboardConfigDto,
  ) {
    return this.config.upsert(user.userId, user.rolGlobal, dto);
  }
}