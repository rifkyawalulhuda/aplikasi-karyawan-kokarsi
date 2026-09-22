import { Module } from '@nestjs/common'
import { OperationalVehicleUsageController } from './operational-vehicle-usage.controller'
import { OperationalVehicleUsageService } from './operational-vehicle-usage.service'
import { SharedModule } from '../shared/shared.module'

@Module({
  imports: [SharedModule],
  controllers: [OperationalVehicleUsageController],
  providers: [OperationalVehicleUsageService],
})
export class OperationalVehicleUsageModule {}
