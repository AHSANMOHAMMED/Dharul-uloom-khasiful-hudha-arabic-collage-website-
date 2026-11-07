import { describe, expect, it } from 'vitest'
import { normalizeArabic } from '../lib/arabicNormalize'

// Expected values were produced by the SQL function public.arabic_normalize()
// (migration 0021) — the browser search must normalise identically.
const CASES = [
  ['وَالْكِتَابِ', 'والكتاب'],
  ['أَكْتُبُ', 'اكتب'],
  ['إِسْلَام', 'اسلام'],
  ['آيَة', 'ايه'],
  ['مُؤْمِن', 'مومن'],
  ['شَيْء', 'شيء'],
  ['مُسْتَشْفَى', 'مستشفي'],
  ['رَحْمَةٌ', 'رحمه'],
  ['ٱلْحَمْدُ', 'الحمد'],
  ['قَالُوا', 'قالوا'],
  ['بِسْمِ اللَّهِ', 'بسمالله'],
]

describe('normalizeArabic matches SQL arabic_normalize()', () => {
  for (const [input, expected] of CASES) {
    it(input, () => expect(normalizeArabic(input)).toBe(expected))
  }
})
