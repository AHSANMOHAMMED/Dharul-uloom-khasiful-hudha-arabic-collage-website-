// supabase/functions/translate-word/index.ts
// Arabic word → Tamil meaning for the Shamela / library reader.
//
// POST { word: string, context?: string }
// Dictionary lookups are public (readers may be signed out); the AI fallback
// (which costs money) runs only for a verified signed-in user.
//
// Order of trust:
//   1. Dictionary (curated + imported lexicon, then cached AI entries) via
//      lookup_arabic_word() — handles tashkeel, alef/ya/ta-marbuta forms,
//      clitics (و ف ب ك ل س ال) and common suffixes, then the root.
//   2. Only when nothing matches: Claude produces root, part of speech and the
//      Tamil meaning *for this context*; the answer is cached as an
//      UNVERIFIED 'ai' entry that librarians can correct and verify.
// Hard 8 s budget for the model call so the endpoint answers in < 10 s.
//
// Secrets: ANTHROPIC_API_KEY (optional — without it only the dictionary is used).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import { z } from 'npm:zod@4';
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk/helpers/zod';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const ARABIC = /^[؀-ۿݐ-ݿ\s]{1,40}$/;

const Meaning = z.object({
  lemma: z.string().describe('Dictionary headword (lemma) in Arabic with tashkeel'),
  root: z.string().describe('Triliteral/quadriliteral root letters, e.g. ك ت ب written كتب; empty for particles'),
  part_of_speech: z.enum(['noun', 'verb', 'particle', 'adjective', 'phrase', 'name', 'other']),
  tamil: z.string().describe('Concise Tamil meaning(s) as used in this context, separated by "; "'),
  english: z.string().describe('Short English gloss'),
  example_ar: z.string().describe('A short Arabic example phrase using the word'),
  example_ta: z.string().describe('Tamil translation of the example'),
});

const SYSTEM = `You are an expert Arabic lexicographer (in the tradition of al-Munjid, Lisan al-Arab and Hans Wehr) and a professional Sri Lankan Tamil translator for an Islamic Arabic college.
Given one Arabic word (possibly with clitics, inflection or tashkeel) and optionally the sentence it appears in, identify its lemma and root and give its meaning in Sri Lankan Tamil as used in Islamic scholarship.
Rules:
- Strip attached particles (و ف ب ك ل س ال) and pronoun suffixes to find the lemma; report the lemma, not the inflected form.
- Prefer the meaning that fits the provided context; if no context, give the most common meanings (at most three, separated by "; ").
- Use established Tamil Muslim terminology: ஸலாத்/தொழுகை, ஸகாத், நோன்பு, ஹதீஸ், ஃபிக்ஹ், தஃப்ஸீர், அகீதா, ஸுன்னா, ஹலால், ஹராம்.
- Never invent a root for particles; leave root empty.
- Keep Tamil concise (dictionary style), no transliteration unless it is an Islamic technical term.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const started = Date.now();

  let body: { word?: string; context?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const word = String(body.word || '').trim();
  const context = String(body.context || '').slice(0, 400);
  if (!word || !ARABIC.test(word)) return json({ error: 'Send one Arabic word (max 40 characters)' }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  // 1. dictionary
  const { data: dict, error: dictErr } = await admin.rpc('lookup_arabic_word', { p_word: word, p_limit: 8 });
  if (dictErr) return json({ error: dictErr.message }, 500);
  if (dict?.results?.length) return json({ ...dict, from: 'dictionary', ms: Date.now() - started });

  // 2. model fallback — signed-in users only
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ ...dict, from: 'dictionary', ms: Date.now() - started, note: 'No dictionary match' });
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: auth } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } };
  if (!auth?.user) {
    return json({ ...dict, from: 'dictionary', ms: Date.now() - started, note: 'Sign in for AI-assisted meanings' });
  }

  const client = new Anthropic({ apiKey, timeout: 8000, maxRetries: 0 });
  try {
    const response = await client.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 1024,
      system: SYSTEM,
      output_config: { effort: 'low', format: zodOutputFormat(Meaning) },
      messages: [{
        role: 'user',
        content: context ? `Word: ${word}\nContext sentence: ${context}` : `Word: ${word}`,
      }],
    });
    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      return json({ ...dict, from: 'dictionary', ms: Date.now() - started, note: 'No meaning found' });
    }
    const m = response.parsed_output;
    await admin.rpc('save_ai_dictionary_entry', {
      p_arabic: m.lemma || word, p_root: m.root, p_pos: m.part_of_speech, p_tamil: m.tamil,
      p_english: m.english, p_example_ar: m.example_ar, p_example_ta: m.example_ta, p_model: 'claude-opus-5-5',
    });
    const { data: again } = await admin.rpc('lookup_arabic_word', { p_word: word, p_limit: 8 });
    const results = again?.results?.length ? again.results : [{
      arabic: m.lemma, root: m.root, part_of_speech: m.part_of_speech, tamil: m.tamil, english: m.english,
      example_ar: m.example_ar, example_ta: m.example_ta, source: 'ai', verified: false, match: 'ai',
    }];
    return json({ ...(again || dict), results, from: 'ai', unverified: true, ms: Date.now() - started });
  } catch (e) {
    const timedOut = e instanceof Anthropic.APIConnectionTimeoutError;
    console.error('[translate-word]', timedOut ? 'timeout' : e);
    return json({ ...dict, from: 'dictionary', ms: Date.now() - started,
                  note: timedOut ? 'Translator timed out — try again' : 'Translator unavailable' });
  }
});
