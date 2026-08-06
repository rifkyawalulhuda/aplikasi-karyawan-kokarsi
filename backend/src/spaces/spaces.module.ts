import { Module } from '@nestjs/common'
import { MulterModule } from '@nestjs/platform-express'
import { PrismaModule } from '../prisma/prisma.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { SpacesController } from './spaces.controller'
import { SpacesService } from './spaces.service'
import { SpaceColumnsController } from './space-columns.controller'
import { SpaceColumnsService } from './space-columns.service'
import { SpaceCardsController } from './space-cards.controller'
import { SpaceCardsService } from './space-cards.service'
import { SpaceSseService } from './space-sse.service'
import { SpaceAnnouncementsController } from './space-announcements.controller'
import { SpaceAnnouncementsService } from './space-announcements.service'
import { SpaceDocumentsController } from './space-documents.controller'
import { SpaceDocumentsService } from './space-documents.service'
import { SpaceNotificationService } from './space-notification.service'

@Module({
  imports: [PrismaModule, MulterModule.register({}), NotificationsModule],
  controllers: [
    SpacesController,
    SpaceColumnsController,
    SpaceCardsController,
    SpaceAnnouncementsController,
    SpaceDocumentsController,
  ],
  providers: [
    SpacesService,
    SpaceColumnsService,
    SpaceCardsService,
    SpaceSseService,
    SpaceAnnouncementsService,
    SpaceDocumentsService,
    SpaceNotificationService,
  ],
  exports: [SpacesService, SpaceSseService, SpaceNotificationService],
})
export class SpacesModule {}
