import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put,
  Request, Sse, UploadedFile, UseGuards, UseInterceptors, MessageEvent,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname } from 'path'
import { Observable } from 'rxjs'
import { SpaceCardsService } from './space-cards.service'
import { SpaceSseService } from './space-sse.service'
import { CreateCardDto, MoveCardDto, UpdateCardDto } from './dto/create-card.dto'
import { CreateCommentDto, UpdateCommentDto } from './dto/create-comment.dto'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

function ensureUploadDir() {
  const dir = join(process.cwd(), 'uploads', 'spaces')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

@Controller('spaces/:spaceId')
export class SpaceCardsController {
  constructor(
    private readonly cardsService: SpaceCardsService,
    private readonly sseService: SpaceSseService,
  ) {}

  // ── SSE Stream ─────────────────────────────────────────────────────────────
  @UseGuards(AuthGuard('jwt-cookie'))
  @Sse('stream')
  stream(@Param('spaceId', ParseIntPipe) spaceId: number): Observable<MessageEvent> {
    return this.sseService.subscribeToSpace(spaceId)
  }

  // ── Cards ──────────────────────────────────────────────────────────────────
  @UseGuards(AuthGuard('jwt'))
  @Post('columns/:colId/cards')
  createCard(
    @Param('spaceId', ParseIntPipe) spaceId: number,
    @Param('colId', ParseIntPipe) colId: number,
    @Body() dto: CreateCardDto,
    @Request() req: any,
  ) {
    const name = req.user?.fullName ?? req.user?.name ?? req.user?.username ?? 'User'
    return this.cardsService.create(spaceId, colId, dto, req.user.sub, name)
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('cards/:cardId')
  getCard(
    @Param('spaceId', ParseIntPipe) spaceId: number,
    @Param('cardId', ParseIntPipe) cardId: number,
    @Request() req: any,
  ) {
    return this.cardsService.findOne(spaceId, cardId, req.user.sub)
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('cards/:cardId')
  updateCard(
    @Param('spaceId', ParseIntPipe) spaceId: number,
    @Param('cardId', ParseIntPipe) cardId: number,
    @Body() dto: UpdateCardDto,
    @Request() req: any,
  ) {
    const name = req.user?.fullName ?? req.user?.name ?? req.user?.username ?? 'User'
    return this.cardsService.update(spaceId, cardId, dto, req.user.sub, name)
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('cards/:cardId')
  deleteCard(
    @Param('spaceId', ParseIntPipe) spaceId: number,
    @Param('cardId', ParseIntPipe) cardId: number,
    @Request() req: any,
  ) {
    const name = req.user?.fullName ?? req.user?.name ?? req.user?.username ?? 'User'
    return this.cardsService.remove(spaceId, cardId, req.user.sub, name)
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('cards/:cardId/move')
  moveCard(
    @Param('spaceId', ParseIntPipe) spaceId: number,
    @Param('cardId', ParseIntPipe) cardId: number,
    @Body() dto: MoveCardDto,
    @Request() req: any,
  ) {
    const name = req.user?.fullName ?? req.user?.name ?? req.user?.username ?? 'User'
    return this.cardsService.move(spaceId, cardId, dto, req.user.sub, name)
  }

  // ── Checklist ──────────────────────────────────────────────────────────────
  @UseGuards(AuthGuard('jwt'))
  @Post('cards/:cardId/checklists')
  addChecklist(
    @Param('spaceId', ParseIntPipe) spaceId: number,
    @Param('cardId', ParseIntPipe) cardId: number,
    @Body() body: { title: string },
    @Request() req: any,
  ) {
    const name = req.user?.fullName ?? req.user?.name ?? req.user?.username ?? 'User'
    return this.cardsService.addChecklist(spaceId, cardId, body.title, req.user.sub, name)
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('cards/:cardId/checklists/:itemId')
  toggleChecklist(
    @Param('spaceId', ParseIntPipe) spaceId: number,
    @Param('cardId', ParseIntPipe) cardId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: { checked: boolean },
    @Request() req: any,
  ) {
    const name = req.user?.fullName ?? req.user?.name ?? req.user?.username ?? 'User'
    return this.cardsService.toggleChecklist(spaceId, cardId, itemId, body.checked, req.user.sub, name)
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('cards/:cardId/checklists/:itemId')
  removeChecklist(
    @Param('spaceId', ParseIntPipe) spaceId: number,
    @Param('cardId', ParseIntPipe) cardId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Request() req: any,
  ) {
    return this.cardsService.removeChecklist(spaceId, cardId, itemId, req.user.sub)
  }

  // ── Attachments ────────────────────────────────────────────────────────────
  @UseGuards(AuthGuard('jwt'))
  @Post('cards/:cardId/attachments')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (_req, _file, cb) => cb(null, ensureUploadDir()),
      filename: (_req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
        cb(null, `${uniqueSuffix}${extname(file.originalname)}`)
      },
    }),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  }))
  addAttachment(
    @Param('spaceId', ParseIntPipe) spaceId: number,
    @Param('cardId', ParseIntPipe) cardId: number,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { name?: string; url?: string },
    @Request() req: any,
  ) {
    const name = req.user?.fullName ?? req.user?.name ?? req.user?.username ?? 'User'
    if (file) {
      return this.cardsService.addAttachmentFile(spaceId, cardId, file, req.user.sub, name)
    }
    if (body.url) {
      return this.cardsService.addAttachmentLink(spaceId, cardId, body.name ?? body.url, body.url, req.user.sub, name)
    }
    throw new Error('File atau URL wajib disertakan')
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('cards/:cardId/attachments/:attId')
  removeAttachment(
    @Param('spaceId', ParseIntPipe) spaceId: number,
    @Param('cardId', ParseIntPipe) cardId: number,
    @Param('attId', ParseIntPipe) attId: number,
    @Request() req: any,
  ) {
    const name = req.user?.fullName ?? req.user?.name ?? req.user?.username ?? 'User'
    return this.cardsService.removeAttachment(spaceId, cardId, attId, req.user.sub, name)
  }

  // ── Comments ───────────────────────────────────────────────────────────────
  @UseGuards(AuthGuard('jwt'))
  @Post('cards/:cardId/comments')
  addComment(
    @Param('spaceId', ParseIntPipe) spaceId: number,
    @Param('cardId', ParseIntPipe) cardId: number,
    @Body() dto: CreateCommentDto,
    @Request() req: any,
  ) {
    const name = req.user?.fullName ?? req.user?.name ?? req.user?.username ?? 'User'
    const photoUrl = req.user?.photoUrl ?? null
    return this.cardsService.addComment(spaceId, cardId, dto, req.user.sub, name, photoUrl)
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('cards/:cardId/comments/:cmtId')
  updateComment(
    @Param('spaceId', ParseIntPipe) spaceId: number,
    @Param('cardId', ParseIntPipe) cardId: number,
    @Param('cmtId', ParseIntPipe) cmtId: number,
    @Body() dto: UpdateCommentDto,
    @Request() req: any,
  ) {
    const name = req.user?.fullName ?? req.user?.name ?? req.user?.username ?? 'User'
    return this.cardsService.updateComment(spaceId, cardId, cmtId, dto, req.user.sub, name)
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('cards/:cardId/comments/:cmtId')
  deleteComment(
    @Param('spaceId', ParseIntPipe) spaceId: number,
    @Param('cardId', ParseIntPipe) cardId: number,
    @Param('cmtId', ParseIntPipe) cmtId: number,
    @Request() req: any,
  ) {
    const name = req.user?.fullName ?? req.user?.name ?? req.user?.username ?? 'User'
    return this.cardsService.removeComment(spaceId, cardId, cmtId, req.user.sub, name)
  }
}
