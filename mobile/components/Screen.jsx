import { ScrollView, RefreshControl, View, StyleSheet } from 'react-native';
import { colors, space } from '../lib/theme';
import Loading from './Loading';
import ErrorBanner from './ErrorBanner';

/**
 * Standard page container: light background, padding, pull-to-refresh,
 * optional loading / error states.
 */
export default function Screen({
  children,
  onRefresh,
  refreshing = false,
  loading = false,
  error = null,
  onRetry,
  scroll = true,
  contentStyle,
  footer,
}) {
  if (loading) return <Loading />;
  const body = (
    <>
      {error ? <ErrorBanner message={error} onRetry={onRetry || onRefresh} /> : null}
      {children}
    </>
  );
  if (!scroll) {
    return <View style={[styles.wrap, styles.content, contentStyle]}>{body}</View>;
  }
  return (
    <View style={styles.wrap}>
      <ScrollView
        contentContainerStyle={[styles.content, contentStyle]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
          ) : undefined
        }
      >
        {body}
      </ScrollView>
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md, paddingBottom: 40 },
});
