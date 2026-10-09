import { Module } from '@nestjs/common'
import { OrgStructureService } from './org-structure.service'
import { OrgStructureController } from './org-structure.controller'
import { SharedModule } from '../shared/shared.module'

@Module({
  imports: [SharedModule],
  controllers: [OrgStructureController],
  providers: [OrgStructureService],
  exports: [OrgStructureService],
})
export class OrgStructureModule {}
