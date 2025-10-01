import { describe, expect, it } from 'vitest'

import { normalizeBaseUrl } from '@/components/agent-settings/defaults'

describe('normalizeBaseUrl', () => {
  it('returns the fallback when value is undefined or empty', () => {
    expect(normalizeBaseUrl(undefined, 'http://fallback')).toBe('http://fallback')
    expect(normalizeBaseUrl('', 'http://fallback')).toBe('http://fallback')
    expect(normalizeBaseUrl('   ', 'http://fallback')).toBe('http://fallback')
  })

  it('trims trailing slashes', () => {
    expect(normalizeBaseUrl('http://example.com/', 'http://fallback')).toBe('http://example.com')
    expect(normalizeBaseUrl('http://example.com///', 'http://fallback')).toBe('http://example.com')
  })

  it('preserves scheme and path', () => {
    expect(normalizeBaseUrl('https://example.com/api', 'http://fallback')).toBe('https://example.com/api')
  })
})
