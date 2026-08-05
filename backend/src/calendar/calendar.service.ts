import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CalendarEventDto } from './dto/calendar-event.dto'

export type CalendarItemType = 'agenda' | 'employee_contract' | 'employee_document' | 'vendor_contract' | 'legal_koperasi'

export interface CalendarItem {
  id: string
  sourceId: number
  type: CalendarItemType
  title: string
  description?: string | null
  location?: string | null
  startDate: string
  endDate: string
  startTime?: string | null
  endTime?: string | null
  color: string
  readOnly: boolean
  status?: string | null
  deeplink?: string
  createdByName?: string | null
  assignedUserIds?: number[]
}

const DEFAULT_COLOR = 'blue'

@Injectable()
export class CalendarService {
  constructor(private prisma: PrismaService) {}

  private dateOnly(value: Date | string): string {
    return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10)
  }

  private overlaps(rangeStart: Date, rangeEnd: Date) {
    return { startDate: { lte: rangeEnd }, endDate: { gte: rangeStart } }
  }

  private normalizeAgenda(event: any): CalendarItem {
    return {
      id: `agenda-${event.id}`,
      sourceId: event.id,
      type: 'agenda',
      title: event.title,
      description: event.description,
      location: event.location,
      startDate: this.dateOnly(event.startDate),
      endDate: this.dateOnly(event.endDate),
      startTime: event.startTime,
      endTime: event.endTime,
      color: event.color || DEFAULT_COLOR,
      readOnly: false,
      createdByName: event.createdByName,
      assignedUserIds: event.assignedUserIds ?? [],
    }
  }

  async getCalendarData(start: string, end: string): Promise<CalendarItem[]> {
    const rangeStart = new Date(`${start}T00:00:00.000Z`)
    const rangeEnd = new Date(`${end}T23:59:59.999Z`)
    if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime()) || rangeStart > rangeEnd) {
      throw new BadRequestException('Rentang tanggal kalender tidak valid')
    }

    const overlap = this.overlaps(rangeStart, rangeEnd)
    const [agendas, contracts, documents, vendorContracts, legalDocuments] = await Promise.all([
      this.prisma.calendarEvent.findMany({
        where: overlap,
        orderBy: [{ startDate: 'asc' }, { startTime: 'asc' }],
      }),
      this.prisma.contract.findMany({
        where: { endDate: { gte: rangeStart, lte: rangeEnd } },
        include: { employee: { select: { fullName: true } } },
        orderBy: { endDate: 'asc' },
      }),
      this.prisma.employeeDocument.findMany({
        where: { expiryDate: { gte: rangeStart, lte: rangeEnd } },
        include: {
          employee: { select: { fullName: true } },
          documentType: { select: { name: true } },
        },
        orderBy: { expiryDate: 'asc' },
      }),
      this.prisma.vendorContract.findMany({
        where: { endDate: { gte: rangeStart, lte: rangeEnd } },
        include: { company: { select: { name: true } } },
        orderBy: { endDate: 'asc' },
      }),
      this.prisma.legalKoperasi.findMany({
        where: { endDate: { gte: rangeStart, lte: rangeEnd } },
        orderBy: { endDate: 'asc' },
      }),
    ])

    return [
      ...agendas.map(event => this.normalizeAgenda(event)),
      ...contracts.map(contract => ({
        id: `employee_contract-${contract.id}`,
        sourceId: contract.id,
        type: 'employee_contract' as const,
        title: `Kontrak: ${contract.employee.fullName}`,
        description: contract.contractNo,
        startDate: this.dateOnly(contract.endDate),
        endDate: this.dateOnly(contract.endDate),
        color: 'yellow',
        readOnly: true,
        status: contract.status,
        deeplink: `/kontrak?openId=${contract.id}`,
      })),
      ...documents.map(document => ({
        id: `employee_document-${document.id}`,
        sourceId: document.id,
        type: 'employee_document' as const,
        title: `Dokumen: ${document.employee.fullName}`,
        description: document.documentType.name,
        startDate: this.dateOnly(document.expiryDate!),
        endDate: this.dateOnly(document.expiryDate!),
        color: 'red',
        readOnly: true,
        status: document.status,
        deeplink: `/dokumen/sertifikasi-ijin?openId=${document.id}`,
      })),
      ...vendorContracts.map(contract => ({
        id: `vendor_contract-${contract.id}`,
        sourceId: contract.id,
        type: 'vendor_contract' as const,
        title: `Vendor: ${contract.documentName}`,
        description: contract.company.name,
        startDate: this.dateOnly(contract.endDate!),
        endDate: this.dateOnly(contract.endDate!),
        color: 'blue',
        readOnly: true,
        status: contract.status,
        deeplink: `/dokumen-legal/kontrak-vendor?openId=${contract.id}`,
      })),
      ...legalDocuments.map(document => ({
        id: `legal_koperasi-${document.id}`,
        sourceId: document.id,
        type: 'legal_koperasi' as const,
        title: `Legal: ${document.documentName}`,
        description: document.publisher,
        startDate: this.dateOnly(document.endDate!),
        endDate: this.dateOnly(document.endDate!),
        color: 'purple',
        readOnly: true,
        status: document.status,
        deeplink: `/dokumen-legal/legal-koperasi?openId=${document.id}`,
      })),
    ].sort((a, b) => a.startDate.localeCompare(b.startDate))
  }

  async create(dto: CalendarEventDto, createdByName: string) {
    if (dto.endDate < dto.startDate) throw new BadRequestException('Tanggal selesai tidak boleh sebelum tanggal mulai')
    return this.prisma.calendarEvent.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        location: dto.location?.trim() || null,
        startDate: new Date(`${dto.startDate}T00:00:00.000Z`),
        endDate: new Date(`${dto.endDate}T00:00:00.000Z`),
        startTime: dto.startTime,
        endTime: dto.endTime || null,
        color: dto.color,
        createdByName,
        assignedUserIds: dto.assignedUserIds ?? [],
      },
    })
  }

  async update(id: number, dto: CalendarEventDto) {
    if (dto.endDate < dto.startDate) throw new BadRequestException('Tanggal selesai tidak boleh sebelum tanggal mulai')
    await this.findOne(id)
    return this.prisma.calendarEvent.update({
      where: { id },
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        location: dto.location?.trim() || null,
        startDate: new Date(`${dto.startDate}T00:00:00.000Z`),
        endDate: new Date(`${dto.endDate}T00:00:00.000Z`),
        startTime: dto.startTime,
        endTime: dto.endTime || null,
        color: dto.color,
        assignedUserIds: dto.assignedUserIds ?? [],
        // Reset sent flags saat agenda diubah agar notifikasi dikirim ulang
        notifyMorningSent: false,
        notifyBeforeSent: false,
      },
    })
  }

  async findOne(id: number) {
    const event = await this.prisma.calendarEvent.findUnique({ where: { id } })
    if (!event) throw new NotFoundException('Agenda tidak ditemukan')
    return event
  }

  async remove(id: number) {
    await this.findOne(id)
    return this.prisma.calendarEvent.delete({ where: { id } })
  }
}
