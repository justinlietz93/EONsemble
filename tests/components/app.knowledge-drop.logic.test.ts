import { describe, expect, it } from 'vitest'

import { detectUnexpectedKnowledgeDrop } from '@/App'

describe('detectUnexpectedKnowledgeDrop', () => {
  it('treats any prior non-zero knowledge count as unexpected when empty', () => {
    expect(detectUnexpectedKnowledgeDrop(3, 'user-selection', 'none')).toBe(true)
  })

  it('flags persistence resets as unexpected even when prior count is zero', () => {
    expect(detectUnexpectedKnowledgeDrop(0, 'persistence-reset', 'none')).toBe(true)
  })

  it('flags auto restores as unexpected even when prior count is zero', () => {
    expect(detectUnexpectedKnowledgeDrop(0, 'auto-restore', 'restored')).toBe(true)
  })

  it('falls back to the last detected reset metadata when deciding', () => {
    expect(detectUnexpectedKnowledgeDrop(0, 'user-selection', 'persistence-reset')).toBe(true)
  })

  it('treats initial empty knowledge without reset context as expected', () => {
    expect(detectUnexpectedKnowledgeDrop(0, 'initial-load', 'none')).toBe(false)
  })
})
