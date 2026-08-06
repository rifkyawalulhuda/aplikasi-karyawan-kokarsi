import { Module } from '@nestjs/common'
import { MulterModule } from '@nestjs/platform-express'
import { PrismaModule } from '../prisma/prisma.module'
import { SpacesController } from './spaces.controller'
import { SpacesService } from './spaces.service'
import { SpaceColumnsController } from './space-columns.controller'
import { SpaceColumnsService } from './space-columns.service'
import { SpaceCardsController } from './space-cards.controller'
import { SpaceCardsService } from './space-cards.service'
import { SpaceSseService } from './space-sse.service'

@Module({
  imports: [PrismaModule, MulterModule.register({})],
  controllers: [SpacesController, SpaceColumnsController, SpaceCardsController],
  providers: [SpacesService, SpaceColumnsService, SpaceCardsService, SpaceSseService],
  exports: [SpacesService, SpaceSseService],
})
export class SpacesModule {}
