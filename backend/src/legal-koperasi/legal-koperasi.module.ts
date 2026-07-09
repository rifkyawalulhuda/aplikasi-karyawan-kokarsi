import { Module } from '@nestjs/common'
import { LegalKoperasiService } from './legal-koperasi.service'
import { LegalKoperasiController } from './legal-koperasi.controller'
import { SharedModule } from '../shared/shared.module'

@Module({
  imports: [SharedModule],
  controllers: [LegalKoperasiController],
  providers: [LegalKoperasiService],
  exports: [LegalKoperasiService],
})
export class LegalKoperasiModule {}
