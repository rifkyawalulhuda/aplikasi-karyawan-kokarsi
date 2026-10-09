import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { SearchService } from './search.service'

/**
 * Pencarian global terpadu (semua modul) untuk command palette.
 *
 * Dijaga JWT: hasil mengikuti izin yang sama dengan halaman asalnya. Endpoint
 * lama `/api/search` (fan-out 9 request di Nitro) dipertahankan untuk
 * kompatibilitas sampai seluruh pemanggil bermigrasi ke sini.
 */
@UseGuards(AuthGuard('jwt'))
@Controller('search')
export class SearchController {
  constructor(private readonly service: SearchService) {}

  @Get()
  search(@Query('q') q?: string, @Query('limit') limit?: string) {
    return this.service.search(q ?? '', limit ? Number(limit) : undefined)
  }
}
