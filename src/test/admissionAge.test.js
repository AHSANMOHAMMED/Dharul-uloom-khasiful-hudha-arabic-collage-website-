import { describe, expect, it } from 'vitest'
import { ageFromDob, isSriLankanPhone, shiftIso } from '../lib/admissionsApi'

describe('admission age + phone helpers', () => {
  it('computes completed years and months from the date of birth', () => {
    expect(ageFromDob('2014-09-08', '2026-11-08')).toEqual({ years: 12, months: 2 })
    expect(ageFromDob('2014-11-09', '2026-11-08')).toEqual({ years: 11, months: 11 })
    expect(ageFromDob('2027-01-01', '2026-11-08')).toBeNull()
  })

  it('shifts dates by years (leap day safe)', () => {
    expect(shiftIso('2026-11-08', { years: -26, days: 1 })).toBe('2000-11-09')
    expect(shiftIso('2024-02-29', { years: 1 })).toBe('2025-02-28')
  })

  it('accepts Sri Lankan numbers only', () => {
    expect(isSriLankanPhone('077 123 4567')).toBe(true)
    expect(isSriLankanPhone('+94 77 123 4567')).toBe(true)
    expect(isSriLankanPhone('12345')).toBe(false)
  })
})
