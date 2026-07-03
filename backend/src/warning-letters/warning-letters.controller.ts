import { Controller, Get, Post, Put, Delete, Param, Body, Query, Res, UseGuards, ParseIntPipe } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { WarningLettersService, CreateWarningLetterDto, UpdateWarningLetterDto } from './warning-letters.service'
import { PdfGeneratorService } from './pdf-generator.service'

@UseGuards(AuthGuard('jwt'))
@Controller('warning-letters')
export class WarningLettersController {
  constructor(
    private service: WarningLettersService,
    private pdfGenerator: PdfGeneratorService,
  ) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll(
      page ? +page : 1,
      limit ? +limit : 10,
      search,
    )
  }

  @Get('escalation/:employeeId')
  getEscalationStatus(@Param('employeeId', ParseIntPipe) employeeId: number) {
    return this.service.getEscalationStatus(employeeId)
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id)
  }

  @Get(':id/generate')
  async generate(@Param('id', ParseIntPipe) id: number, @Res() res: any) {
    const letter = await this.service.findOne(id)
    const buffer = await this.pdfGenerator.generateWarningLetter(letter)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="SP-${letter.letterNumber}.pdf"`)
    res.send(buffer)
  }

  @Get(':id/preview')
  async preview(@Param('id', ParseIntPipe) id: number, @Res() res: any) {
    const letter = await this.service.findOne(id)
    const buffer = await this.pdfGenerator.generateWarningLetter(letter)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="SP-${letter.letterNumber}.pdf"`)
    res.send(buffer)
  }

  @Post()
  create(@Body() dto: CreateWarningLetterDto) {
    return this.service.create(dto)
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateWarningLetterDto) {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id)
  }
}
