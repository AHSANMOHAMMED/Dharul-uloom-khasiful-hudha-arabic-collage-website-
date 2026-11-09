import { useState } from 'react';
import { Linking, TextInput } from 'react-native';
import { Redirect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { supabase, must } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { colors } from '../lib/theme';
import { Screen, Card, Txt, EmptyState, Row, Button } from '../components';

const WEB = process.env.EXPO_PUBLIC_WEB_URL || 'https://dharul-uloom-kashiful-hudha.vercel.app';

const inputStyle = {
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 10,
  padding: 10,
  marginBottom: 8,
  backgroundColor: '#fff',
};

export default function LibraryScreen() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const [qText, setQText] = useState('');
  const [query, setQuery] = useState('');

  // Parents are intentionally gated off the digital library.
  const blocked = profile?.account_type === 'parent';

  const q = useAsync(async () => {
    if (!query.trim()) {
      const { data, error } = await supabase
        .from('books')
        .select('id, title_ar, title_en, language, year, pages, file_path, cover_image, is_public')
        .eq('is_public', true)
        .order('title_ar')
        .limit(40);
      if (error) throw error;
      return data || [];
    }
    try {
      return await must(
        supabase.rpc('search_books', {
          q: query.trim(),
          p_language: null,
          p_category: null,
          p_author: null,
          p_limit: 40,
          p_offset: 0,
        }),
      );
    } catch {
      // Fallback if RPC signature differs
      const { data, error } = await supabase
        .from('books')
        .select('id, title_ar, title_en, language, year, pages, file_path')
        .or(`title_ar.ilike.%${query.trim()}%,title_en.ilike.%${query.trim()}%`)
        .limit(40);
      if (error) throw error;
      return data || [];
    }
  }, [query]);

  if (!profile) return null;
  if (blocked) return <Redirect href="/" />;

  const rows = q.data || [];

  const openBook = async (b) => {
    if (b.file_path) {
      const url = b.file_path.startsWith('http') ? b.file_path : `${WEB}/library/${b.id}`;
      try {
        await WebBrowser.openBrowserAsync(url);
      } catch {
        Linking.openURL(url);
      }
      return;
    }
    Linking.openURL(`${WEB}/library/${b.id}`);
  };

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <Txt variant="title">{t('nav.library') || 'Maktabah'}</Txt>
      <Txt variant="muted" style={{ marginBottom: 8 }}>
        Search the digital library. Open a title to read on the web viewer.
      </Txt>
      <TextInput
        style={inputStyle}
        value={qText}
        onChangeText={setQText}
        placeholder="Search Arabic / English title…"
        returnKeyType="search"
        onSubmitEditing={() => setQuery(qText.trim())}
      />
      <Row style={{ gap: 8, marginBottom: 12 }}>
        <Button title={t('common.search') || 'Search'} small onPress={() => setQuery(qText.trim())} />
        <Button title={t('common.clear') || 'Clear'} small variant="muted" onPress={() => { setQText(''); setQuery(''); }} />
        <Button title="Web library" small variant="outline" onPress={() => Linking.openURL(`${WEB}/library`)} />
      </Row>
      {!rows.length ? <EmptyState message={t('common.none')} icon="library-outline" /> : null}
      {rows.map((b) => (
        <Card key={b.id}>
          <Txt variant="strong">{b.title_ar || b.title_en || 'Untitled'}</Txt>
          {b.title_en && b.title_ar ? <Txt variant="muted">{b.title_en}</Txt> : null}
          <Txt variant="small">
            {[b.language, b.year, b.pages ? `${b.pages} pp` : null].filter(Boolean).join(' · ')}
          </Txt>
          <Button title="Open" small style={{ marginTop: 8 }} onPress={() => openBook(b)} />
        </Card>
      ))}
    </Screen>
  );
}
