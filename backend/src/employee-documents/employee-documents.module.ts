import { Module } from '@nestjs/common'
import { EmployeeDocumentsService } from './employee-documents.service'
import { EmployeeDocumentsController } from './employee-documents.controller'
import { SharedModule } from '../shared/shared.module'

@Module({
  imports: [SharedModule],
  controllers: [EmployeeDocumentsController],
  providers: [EmployeeDocumentsService],
  exports: [EmployeeDocumentsService],
})
export class EmployeeDocumentsModule {}
