export interface SectionOverride {
  heading: string
  paragraphs: string[]
}

export interface TemplateContentEditorState {
  // Tab 1: Teks Umum
  title: string
  subtitle: string
  roleLabel: string
  locationLine: string
  termLine: string
  compensationLabel: string
  firstPartyLabel: string
  secondPartyLabel: string

  // Tab 2: Pendahuluan
  recitals: string[]
  closingParagraphs: string[]

  // Tab 3: Pasal Indonesia
  sections: SectionOverride[]

  // Tab 4: Pasal English (hanya PKWT)
  englishSections: Record<string, string[]>
}

// Placeholder yang wajib dipertahankan
export const DYNAMIC_PLACEHOLDERS = [
  '__TERM_DATE__',
  '__WAGE_AMOUNT__',
  '__MITRA_TERM__',
  '__MITRA_IMBALAN__',
  '__MITRA_ADDRESS__',
  '__MITRA_PHONE__',
  '__MITRA_EMAIL__',
]

export function useTemplateContentEditor() {
  // Build editor state dari definition (merged = current state)
  function buildEditorState(definition: any): TemplateContentEditorState {
    return {
      title: definition.title ?? '',
      subtitle: definition.subtitle ?? '',
      roleLabel: definition.roleLabel ?? '',
      locationLine: definition.locationLine ?? '',
      termLine: definition.termLine ?? '',
      compensationLabel: definition.compensationLabel ?? '',
      firstPartyLabel: definition.firstPartyLabel ?? '',
      secondPartyLabel: definition.secondPartyLabel ?? '',
      recitals: (definition.recitals ?? []).map((r: string) => r),
      closingParagraphs: (definition.closingParagraphs ?? []).map((p: string) => p),
      sections: (definition.sections ?? []).map((s: any) => ({
        heading: s.heading,
        paragraphs: [...(s.paragraphs ?? [])],
      })),
      englishSections: definition.englishSections
        ? Object.fromEntries(
            Object.entries(definition.englishSections).map(([k, v]) => [k, [...(v as string[])]])
          )
        : {},
    }
  }

  // Build payload override — hanya field yang berbeda dari hardcode
  function buildOverridesPayload(
    editorState: TemplateContentEditorState,
    hardcoded: any,
  ): Record<string, any> {
    const overrides: Record<string, any> = {}

    // String fields
    const stringFields: (keyof TemplateContentEditorState)[] = [
      'title', 'subtitle', 'roleLabel', 'locationLine',
      'termLine', 'compensationLabel', 'firstPartyLabel', 'secondPartyLabel',
    ]
    for (const field of stringFields) {
      const val = editorState[field] as string
      const orig = (hardcoded[field] as string) ?? ''
      if (val !== orig && val.trim().length > 0) {
        overrides[field] = val
      }
    }

    // recitals
    const recitalsChanged = JSON.stringify(editorState.recitals) !== JSON.stringify(hardcoded.recitals ?? [])
    if (recitalsChanged && editorState.recitals.length > 0) {
      overrides.recitals = editorState.recitals
    }

    // closingParagraphs
    const closingChanged = JSON.stringify(editorState.closingParagraphs) !== JSON.stringify(hardcoded.closingParagraphs ?? [])
    if (closingChanged && editorState.closingParagraphs.length > 0) {
      overrides.closingParagraphs = editorState.closingParagraphs
    }

    // sections — hanya kirim pasal yang berubah
    const changedSections: SectionOverride[] = []
    for (const section of editorState.sections) {
      const origSection = (hardcoded.sections ?? []).find((s: any) => s.heading === section.heading)
      if (!origSection) continue
      if (JSON.stringify(section.paragraphs) !== JSON.stringify(origSection.paragraphs)) {
        changedSections.push(section)
      }
    }
    if (changedSections.length > 0) {
      overrides.sections = changedSections
    }

    // englishSections — hanya kirim pasal yang berubah
    const changedEnglish: Record<string, string[]> = {}
    for (const [heading, paras] of Object.entries(editorState.englishSections)) {
      const origParas = (hardcoded.englishSections ?? {})[heading] as string[] | undefined
      if (!origParas) continue
      if (JSON.stringify(paras) !== JSON.stringify(origParas)) {
        changedEnglish[heading] = paras
      }
    }
    if (Object.keys(changedEnglish).length > 0) {
      overrides.englishSections = changedEnglish
    }

    return overrides
  }

  // Count jumlah field yang berubah dari hardcode
  function countChanges(editorState: TemplateContentEditorState, hardcoded: any): number {
    const payload = buildOverridesPayload(editorState, hardcoded)
    let count = 0
    for (const key of Object.keys(payload)) {
      if (key === 'sections') count += (payload.sections as any[]).length
      else if (key === 'englishSections') count += Object.keys(payload.englishSections).length
      else count++
    }
    return count
  }

  // Cek apakah paragraf mengandung placeholder dinamis
  function containsPlaceholder(text: string): boolean {
    return DYNAMIC_PLACEHOLDERS.some(p => text.includes(p))
  }

  return {
    buildEditorState,
    buildOverridesPayload,
    countChanges,
    containsPlaceholder,
    DYNAMIC_PLACEHOLDERS,
  }
}
