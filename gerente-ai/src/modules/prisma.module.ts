import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../services/prisma.service';
import { UserContextCacheService } from '../services/user-context-cache.service';

@Global()
@Module({
  providers: [PrismaService, UserContextCacheService],
  exports: [PrismaService, UserContextCacheService],
})
export class PrismaModule {}
