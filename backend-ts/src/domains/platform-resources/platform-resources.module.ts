import { Module } from '@nestjs/common';
import { PlatformResourcesController } from './platform-resources.controller';
import { PlatformResourcesService } from './platform-resources.service';

@Module({
  controllers: [PlatformResourcesController],
  providers: [PlatformResourcesService],
  exports: [PlatformResourcesService],
})
export class PlatformResourcesModule {}

