import { Module } from '@nestjs/common'
import { GeneralArchivesController } from './general-archives.controller'
import { GeneralArchivesService } from './general-archives.service'
import { SharedModule } from '../shared/shared.module'

@Module({
  imports: [SharedModule],
  controllers: [GeneralArchivesController],
  providers: [GeneralArchivesService],
})
export class GeneralArchivesModule {}
