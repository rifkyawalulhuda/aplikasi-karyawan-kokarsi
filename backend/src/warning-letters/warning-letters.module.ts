import { Module } from '@nestjs/common'
import { WarningLettersService } from './warning-letters.service'
import { WarningLettersController } from './warning-letters.controller'
import { PdfGeneratorService } from './pdf-generator.service'
import { SharedModule } from '../shared/shared.module'

@Module({
  imports: [SharedModule],
  controllers: [WarningLettersController],
  providers: [WarningLettersService, PdfGeneratorService],
  exports: [WarningLettersService],
})
export class WarningLettersModule {}
