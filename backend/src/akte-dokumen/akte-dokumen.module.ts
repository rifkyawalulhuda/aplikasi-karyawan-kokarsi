import { Module } from '@nestjs/common'
import { AkteDokumenService } from './akte-dokumen.service'
import { AkteDokumenController } from './akte-dokumen.controller'
import { SharedModule } from '../shared/shared.module'

@Module({
  imports: [SharedModule],
  controllers: [AkteDokumenController],
  providers: [AkteDokumenService],
  exports: [AkteDokumenService],
})
export class AkteDokumenModule {}
