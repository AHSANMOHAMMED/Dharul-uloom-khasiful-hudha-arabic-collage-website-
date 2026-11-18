/**
 * GSM-7 vs UCS-2 SMS segment estimate (Unicode cost preview).
 * Not a carrier invoice — planning aid only.
 */
export function smsEncodingInfo(text) {
  const s = String(text || '');
  // Characters outside basic GSM-7 → UCS-2
  const gsmOk = /^[\r\n\f @£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà^{}\\[~\]|€]*$/.test(s);
  if (gsmOk) {
    const single = 160;
    const concat = 153;
    const len = s.length;
    const segments = len === 0 ? 0 : len <= single ? 1 : Math.ceil(len / concat);
    return { encoding: 'GSM-7', length: len, segments, charsPerSegment: segments <= 1 ? single : concat };
  }
  const single = 70;
  const concat = 67;
  const len = s.length;
  const segments = len === 0 ? 0 : len <= single ? 1 : Math.ceil(len / concat);
  return { encoding: 'UCS-2', length: len, segments, charsPerSegment: segments <= 1 ? single : concat };
}
