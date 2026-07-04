import { Module } from '@nestjs/common'
import { ContractsService } from './contracts.service'
import { ContractsController } from './contracts.controller'
import { ContractDocumentService } from './contract-document.service'
import { ContractTemplatesModule } from '../contract-templates/contract-templates.module'
import { SettingsModule } from '../settings/settings.module'

@Module({
  imports: [ContractTemplatesModule, SettingsModule],
  controllers: [ContractsController],
  providers: [ContractsService, ContractDocumentService],
})
export class ContractsModule {}
