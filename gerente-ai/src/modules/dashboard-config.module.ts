import { Module } from '@nestjs/common';
import { DashboardConfigController } from '../controllers/dashboard-config.controller';
import { DashboardConfigService } from '../services/dashboard-config.service';
import { NegociosModule } from './negocios.module';

@Module({
  imports: [NegociosModule],
  controllers: [DashboardConfigController],
  providers: [DashboardConfigService],
})
export class DashboardConfigModule {}