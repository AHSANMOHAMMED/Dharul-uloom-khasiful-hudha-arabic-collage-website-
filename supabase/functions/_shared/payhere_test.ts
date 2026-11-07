// deno test supabase/functions/_shared/payhere_test.ts
// Reference vectors computed independently with Python hashlib/hmac:
//   md5(mid+oid+amt+cur+UPPER(md5(secret))).upper() etc.
import { assertEquals, assert } from 'jsr:@std/assert@1';
import { checkoutHash, checkoutSignature, notifySignature, safeEqual, escapeHtml, checkoutUrl } from './payhere.ts';

const MID = '1211149';
const OID = 'KH-1234abcd-1700000000000';
const SECRET = 'MySecret123';

Deno.test('checkout hash matches PayHere spec (uppercase md5 chain)', () => {
  assertEquals(checkoutHash(MID, OID, '2500.00', 'LKR', SECRET), '73BA6F38B9D5C094BB2F33A431CCE6D0');
});

Deno.test('notification signature matches PayHere spec', () => {
  assertEquals(notifySignature(MID, OID, '2500.00', 'LKR', '2', SECRET), 'DB08EA3A4AC6DC7D9A6B65014028AA47');
});

Deno.test('tampered amount or status changes the signature', () => {
  const ok = notifySignature(MID, OID, '2500.00', 'LKR', '2', SECRET);
  assert(ok !== notifySignature(MID, OID, '1.00', 'LKR', '2', SECRET));
  assert(ok !== notifySignature(MID, OID, '2500.00', 'LKR', '-2', SECRET));
});

Deno.test('hosted checkout HMAC is stable and order-specific', async () => {
  assertEquals(await checkoutSignature(OID, SECRET), '29a86e44fa3c71a97963000d2d79b57bf8b12f4c27520dc23c98ad0ac2f5ed3b');
  assert((await checkoutSignature(OID + 'x', SECRET)) !== (await checkoutSignature(OID, SECRET)));
});

Deno.test('safeEqual / escapeHtml / endpoints', () => {
  assert(safeEqual('ABC', 'ABC'));
  assert(!safeEqual('ABC', 'ABD'));
  assert(!safeEqual('ABC', 'AB'));
  assertEquals(escapeHtml(`"><script>alert('x')</script>`), '&quot;&gt;&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;');
  assertEquals(checkoutUrl(true), 'https://sandbox.payhere.lk/pay/checkout');
  assertEquals(checkoutUrl(false), 'https://www.payhere.lk/pay/checkout');
});
