import { afterEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import { setLanguage, toTamil, tx } from '../lib/tx'
import taMain from '../locales/ta.json'
import taGov from '../locales/ta.governance.json'

const ta = { ...taMain, ...taGov }
import strings from '../../scripts/i18n/strings.json'

describe('Tamil (ta) support', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('every extracted UI string has a Tamil translation', () => {
    const missing = strings.filter((s) => !ta[s])
    expect(missing).toEqual([])
  })

  it('translations keep {placeholders} intact', () => {
    const bad = Object.entries(ta).filter(([en, t]) => {
      const p = (s) => (s.match(/\{\w+\}/g) || []).sort().join()
      return p(en) !== p(t)
    })
    expect(bad).toEqual([])
  })

  it('tx() picks Arabic, English or Tamil by UI language', async () => {
    expect(tx('دخول', 'Sign In')).toBe('Sign In')
    await i18n.changeLanguage('ar')
    expect(tx('دخول', 'Sign In')).toBe('دخول')
    await setLanguage('ta')
    expect(i18n.language).toBe('ta')
    expect(tx('دخول', 'Sign In')).toBe(ta['Sign In'] || 'Sign In')
    expect(toTamil('Sign In')).toMatch(/[஀-௿]/)
  })

  it('keyed i18n resources exist for Tamil', async () => {
    await i18n.changeLanguage('ta')
    expect(i18n.t('nav.home')).toMatch(/[஀-௿]/)
  })
})
