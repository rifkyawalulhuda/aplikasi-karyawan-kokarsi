import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { CalendarEventDto } from './dto/calendar-event.dto'
import { CalendarService } from './calendar.service'

@UseGuards(AuthGuard('jwt'))
@Controller('calendar')
export class CalendarController {
  constructor(private readonly service: CalendarService) {}

  @Get()
  getCalendar(@Query('start') start: string, @Query('end') end: string) {
    return this.service.getCalendarData(start, end)
  }

  @Post()
  create(@Request() req: any, @Body() dto: CalendarEventDto) {
    const createdByName = req.user?.fullName ?? req.user?.name ?? req.user?.username ?? 'User'
    return this.service.create(dto, createdByName)
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: CalendarEventDto, @Request() req: any) {
    const updatedByName = req.user?.fullName ?? req.user?.name ?? req.user?.username ?? 'User'
    return this.service.update(id, dto, updatedByName)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id)
  }
}
