import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphController } from './graph.controller';
import { GraphService } from './graph.service';
import { GraphEnhancedService } from '../../services/graph-enhanced.service';
import { GraphImportService } from '../../services/graph-import.service';
import { JobPosition } from '../../entities/job.entity';

@Module({
  imports: [TypeOrmModule.forFeature([JobPosition])],
  controllers: [GraphController],
  providers: [GraphService, GraphEnhancedService, GraphImportService],
  exports: [GraphEnhancedService, GraphImportService],
})
export class GraphModule {}
