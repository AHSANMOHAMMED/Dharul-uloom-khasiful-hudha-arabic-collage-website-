import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { supabase, must, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { useI18n } from '../lib/i18n';
import { colors } from '../lib/theme';
import { Screen, Card, Txt, Button, Field, Badge, EmptyState, ErrorBanner, KeyValue, SectionHeader, Row } from '../components';

// Same rule as the translate-word edge function: one Arabic word, ≤ 40 chars.
const ARABIC = /^[؀-ۿݐ-ݿ\s]{1,40}$/;
const TIMEOUT_MS = 12000;

async function translateWord(word, context) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/translate-word`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(context ? { word, context } : { word }),
      signal: controller.signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `translate-word ${res.status}`);
    return json;
  } finally {
    clearTimeout(timer);
  }
}

async function lookup(word, context) {
  try {
    return await translateWord(word, context);
  } catch (e) {
    // Edge function unreachable: fall back to the curated dictionary only.
    const dict = await must(supabase.rpc('lookup_arabic_word', { p_word: word, p_limit: 8 }));
    return { ...(dict || {}), from: 'dictionary', fallback: true, note: e?.message };
  }
}

function Entry({ r, primary, t }) {
  const isAi = r.source === 'ai' || r.match === 'ai';
  const verified = !!r.verified && !isAi;
  return (
    <Card accent={primary ? colors.gold : undefined}>
      <Row style={styles.between}>
        <Txt style={[styles.arabic, primary && styles.arabicBig]}>{r.arabic}</Txt>
        <Badge label={verified ? t('dict.verified') : t('dict.unverified')} tone={verified ? 'success' : 'warning'} />
      </Row>
      <Txt variant="label">{t('dict.tamil')}</Txt>
      <Txt style={[styles.tamil, primary && styles.tamilBig]}>{r.tamil || '—'}</Txt>
      {r.root ? <KeyValue label={t('dict.root')} value={<Txt style={styles.arabicInline}>{r.root}</Txt>} /> : null}
      {r.part_of_speech ? <KeyValue label={t('dict.pos')} value={t(`pos.${r.part_of_speech}`)} /> : null}
      {r.english ? <KeyValue label={t('dict.english')} value={r.english} /> : null}
      {r.example_ar || r.example_ta ? (
        <View style={styles.example}>
          <Txt variant="label">{t('dict.example')}</Txt>
          {r.example_ar ? <Txt style={styles.arabicInline}>{r.example_ar}</Txt> : null}
          {r.example_ta ? <Txt variant="muted">{r.example_ta}</Txt> : null}
        </View>
      ) : null}
      {r.match && r.match !== 'exact' && r.match !== 'ai' ? <Txt variant="small">{t(`dict.match.${r.match}`)}</Txt> : null}
    </Card>
  );
}

/** Arabic word → Sri Lankan Tamil meaning (dictionary first, AI fallback on the server). */
export default function Dictionary() {
  const { t } = useI18n();
  const [word, setWord] = useState('');
  const [context, setContext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const search = async () => {
    const w = word.trim();
    if (!w) return;
    if (!ARABIC.test(w)) {
      setError(t('dict.arabicOnly'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setResult(await lookup(w, context.trim().slice(0, 400)));
    } catch (e) {
      setError(e?.message || t('common.error'));
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const rows = result?.results || [];
  const aiUsed = result?.from === 'ai' || result?.unverified;

  return (
    <Screen>
      <Card>
        <Field
          label={t('dict.word')}
          placeholder={t('dict.wordPlaceholder')}
          value={word}
          onChangeText={setWord}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={search}
          inputStyle={styles.rtlInput}
        />
        <Field
          label={t('dict.context')}
          placeholder={t('dict.contextPlaceholder')}
          value={context}
          onChangeText={setContext}
          multiline
          inputStyle={[styles.rtlInput, styles.contextInput]}
        />
        <Button title={busy ? t('dict.searching') : t('dict.search')} icon="search-outline" loading={busy} onPress={search} disabled={!word.trim()} />
      </Card>

      {error ? <ErrorBanner message={error} /> : null}

      {result ? (
        <>
          <SectionHeader title={t('dict.meaning')} />
          {aiUsed ? <Txt variant="small">{t('dict.aiNote')}</Txt> : null}
          {result.fallback ? <Txt variant="small">{t('dict.offlineNote')}</Txt> : null}
          {!rows.length ? <EmptyState message={result.note ? `${t('dict.noMatch')} (${result.note})` : t('dict.noMatch')} icon="book-outline" /> : null}
          {rows.map((r, i) => (
            <Entry key={`${r.id || r.arabic}-${i}`} r={r} primary={i === 0} t={t} />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { justifyContent: 'space-between', alignItems: 'center' },
  rtlInput: { textAlign: 'right', writingDirection: 'rtl', fontSize: 20 },
  contextInput: { fontSize: 16, minHeight: 70 },
  arabic: { fontSize: 22, fontWeight: '700', color: colors.primaryDark, writingDirection: 'rtl', textAlign: 'right', flex: 1 },
  arabicBig: { fontSize: 30 },
  arabicInline: { writingDirection: 'rtl', textAlign: 'right', fontSize: 17 },
  tamil: { fontSize: 17, fontWeight: '700', color: colors.text },
  tamilBig: { fontSize: 22, color: colors.primary },
  example: { gap: 2, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 },
});
