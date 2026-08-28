import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LlmService } from '../../services/llm.service';
import { ExamQuestion, ExamRecord } from '../../entities/exam.entity';
import { QuestionBankImport } from '../../entities/question-bank-import.entity';
import { QuestionBankImportCandidate } from '../../entities/question-bank-import-candidate.entity';
import { QuestionBankImportController } from './question-bank-import.controller';
import { QuestionBankImportService } from './question-bank-import.service';
import { QuestionBankController } from './question-bank.controller';
import { QuestionBankService } from './question-bank.service';

@Module({
  imports: [TypeOrmModule.forFeature([QuestionBankImport, QuestionBankImportCandidate, ExamQuestion, ExamRecord])],
  controllers: [QuestionBankImportController, QuestionBankController],
  providers: [LlmService, QuestionBankImportService, QuestionBankService],
  exports: [QuestionBankImportService, QuestionBankService],
})
export class BankImportModule {}
