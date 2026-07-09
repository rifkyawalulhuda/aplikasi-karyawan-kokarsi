import { Module } from '@nestjs/common'
import { VendorContractsService } from './vendor-contracts.service'
import { VendorContractsController } from './vendor-contracts.controller'
import { SharedModule } from '../shared/shared.module'

@Module({
  imports: [SharedModule],
  controllers: [VendorContractsController],
  providers: [VendorContractsService],
  exports: [VendorContractsService],
})
export class VendorContractsModule {}
