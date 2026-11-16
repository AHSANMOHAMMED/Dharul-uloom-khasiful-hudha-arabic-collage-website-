// deno test supabase/functions/_shared/
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { isDialable, normalizeLkPhone } from './phone.ts';

Deno.test('normalizeLkPhone: local and +94 formats', () => {
  assertEquals(normalizeLkPhone('0771234567'), '94771234567');
  assertEquals(normalizeLkPhone('077-123 4567'), '94771234567');
  assertEquals(normalizeLkPhone('+94 77 123 4567'), '94771234567');
  assertEquals(normalizeLkPhone('771234567'), '94771234567');
  assertEquals(normalizeLkPhone('0112345678'), '94112345678'); // landline
});

Deno.test('normalizeLkPhone: 0094 prefix and +94 0… typo', () => {
  assertEquals(normalizeLkPhone('0094771234567'), '94771234567');
  assertEquals(normalizeLkPhone('+94 0771234567'), '94771234567');
  assertEquals(normalizeLkPhone('940771234567'), '94771234567');
});

Deno.test('normalizeLkPhone: several numbers in one field use the first', () => {
  assertEquals(normalizeLkPhone('0771234567 / 0719876543'), '94771234567');
  assertEquals(normalizeLkPhone('0771234567, 0719876543'), '94771234567');
});

Deno.test('normalizeLkPhone: foreign numbers pass through', () => {
  assertEquals(normalizeLkPhone('+44 7700 900123'), '447700900123');
  assertEquals(normalizeLkPhone('+966 50 123 4567'), '966501234567');
});

Deno.test('isDialable rejects junk', () => {
  assert(isDialable(normalizeLkPhone('0771234567')));
  assert(isDialable(normalizeLkPhone('+44 7700 900123')));
  assert(!isDialable(normalizeLkPhone('12345')));
  assert(!isDialable(normalizeLkPhone('077123456')));   // one digit short
  assert(!isDialable(normalizeLkPhone('')));
});
