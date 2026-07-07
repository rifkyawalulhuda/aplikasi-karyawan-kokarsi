import { Module } from '@nestjs/common'
import { ContractsService } from './contracts.service'
import { ContractsController } from './contracts.controller'
import { ContractDocumentService } from './contract-document.service'
import { ContractTemplatesModule } from '../contract-templates/contract-templates.module'
import { SettingsModule } from '../settings/settings.module'
import { SharedModule } from '../shared/shared.module'

@Module({
  imports: [ContractTemplatesModule, SettingsModule, SharedModule],
  controllers: [ContractsController],
  providers: [ContractsService, ContractDocumentService],
})
export class ContractsModule {}
