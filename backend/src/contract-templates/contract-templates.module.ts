import { Module, OnModuleInit } from '@nestjs/common'
import { ContractTemplatesController } from './contract-templates.controller'
import { ContractTemplatesService } from './contract-templates.service'
import { TemplateFieldsService } from './template-fields.service'
import { TemplateFieldsController } from './template-fields.controller'
import { TemplateMasterSourcesController } from './template-master-sources.controller'
import { ContractTemplateVersionsService } from './contract-template-versions.service'
import { ContractTemplateVersionsController } from './contract-template-versions.controller'
import { TemplateValueResolverService } from './template-value-resolver.service'
import { TemplateSnapshotService } from './template-snapshot.service'

@Module({
  controllers: [
    ContractTemplatesController,
    TemplateFieldsController,
    TemplateMasterSourcesController,
    ContractTemplateVersionsController,
  ],
  providers: [
    ContractTemplatesService,
    TemplateFieldsService,
    ContractTemplateVersionsService,
    TemplateValueResolverService,
    TemplateSnapshotService,
  ],
  exports: [
    ContractTemplatesService,
    TemplateFieldsService,
    ContractTemplateVersionsService,
    TemplateValueResolverService,
    TemplateSnapshotService,
  ],
})
export class ContractTemplatesModule implements OnModuleInit {
  constructor(private fieldsService: TemplateFieldsService) {}

  async onModuleInit() {
    // Idempotent seed katalog field system + ktp_issued_date
    try {
      await this.fieldsService.ensureSystemFields()
    } catch {
      // DB mungkin belum ter-migrate saat unit test; tidak fatal
    }
  }
}
