import { describe, test, expect } from 'vitest'
import i18n from '../i18n'

describe('i18n configuration', () => {
  test('English and Arabic expose an identical set of keys', () => {
    const en = Object.keys(i18n.getResourceBundle('en', 'translation')).sort()
    const ar = Object.keys(i18n.getResourceBundle('ar', 'translation')).sort()
    expect(ar).toEqual(en)
  })

  test('every navbar item has a translation key', () => {
    const navKeys = [
      'nav.home',
      'nav.about',
      'nav.courses',
      'nav.admissions',
      'nav.faculty',
      'nav.curriculum',
      'nav.library',
      'nav.gallery',
      'nav.news',
      'nav.contact',
    ]
    for (const key of navKeys) {
      expect(i18n.exists(key)).toBe(true)
    }
  })
})
