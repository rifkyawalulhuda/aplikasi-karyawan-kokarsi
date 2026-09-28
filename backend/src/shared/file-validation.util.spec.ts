import { BadRequestException } from '@nestjs/common'
import { validateImageBuffer } from './file-validation.util'

describe('file validation policy', () => {
  it('rejects SVG content because SVG uploads are disabled', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')

    await expect(validateImageBuffer(svg)).rejects.toBeInstanceOf(BadRequestException)
  })
})