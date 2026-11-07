// Shared PayHere helpers (checkout hash, signed hosted-checkout links).
import md5 from 'npm:blueimp-md5';

/** PayHere checkout hash: UPPER(md5(merchant_id + order_id + amount + currency + UPPER(md5(secret)))) */
export function checkoutHash(merchantId: string, orderId: string, amount: string, currency: string, secret: string) {
  return md5(merchantId + orderId + amount + currency + md5(secret).toUpperCase()).toUpperCase();
}

/** Expected md5sig of a PayHere notification (compare with constant time). */
export function notifySignature(merchantId: string, orderId: string, amount: string, currency: string, statusCode: string, secret: string) {
  return md5(merchantId + orderId + amount + currency + statusCode + md5(secret).toUpperCase()).toUpperCase();
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Signature for the hosted checkout URL (prevents enumerating other orders). */
export function checkoutSignature(orderId: string, secret: string) {
  return hmacHex(secret, `checkout:${orderId}`);
}

export function checkoutUrl(sandbox: boolean) {
  return sandbox ? 'https://sandbox.payhere.lk/pay/checkout' : 'https://www.payhere.lk/pay/checkout';
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
