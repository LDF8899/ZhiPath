import { Module } from '@nestjs/common';
import { PdfService } from '../../services/pdf.service';

/**
 * PDF 模块
 */
@Module({
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}
