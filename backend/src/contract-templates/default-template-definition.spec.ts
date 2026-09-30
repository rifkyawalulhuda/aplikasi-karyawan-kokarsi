import { CONTRACT_DOCUMENT_DEFINITIONS } from '../contracts/contract-document-definitions'
import { definitionToContentDefinition, definitionToFieldDefinitions } from './default-template-definition'
import { collectAllPlaceholders, validateContentDefinition } from './template-schema.validator'

describe('default contract template definitions', () => {
  it('menghasilkan content dan field snapshot valid untuk setiap template bawaan', () => {
    for (const definition of Object.values(CONTRACT_DOCUMENT_DEFINITIONS)) {
      const content = definitionToContentDefinition(definition)
      const fields = definitionToFieldDefinitions(definition)
      const placeholders = collectAllPlaceholders(content)

      expect(fields.map(field => field.key)).toEqual(expect.arrayContaining(placeholders))
      expect(() => validateContentDefinition(content, fields.map(field => field.key), definition.family)).not.toThrow()
    }
  })

  it('memuat template MITRA Driver Truck B3 dengan tugas operasional khusus', () => {
    const definition = CONTRACT_DOCUMENT_DEFINITIONS.MITRA_DRIVER_TRUCK_B3

    expect(definition).toBeDefined()
    expect(definition.roleLabel).toBe('Driver Truck B3')
    expect(definition.sections.flatMap(section => section.paragraphs).join(' ')).toMatch(/truck|keselamatan|pengiriman/i)
  })
})