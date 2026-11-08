import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, space } from '../lib/theme';
import { useI18n } from '../lib/i18n';
import Txt from './Txt';
import Field from './Field';
import Button from './Button';
import { Row } from './Row';

/**
 * Cross-platform text prompt (Alert.prompt is iOS only).
 * onSubmit(value) may be async; the modal closes when it resolves and shows
 * the error in an Alert when it throws.
 */
export default function PromptModal({
  visible,
  title,
  message,
  label,
  placeholder,
  initialValue = '',
  required = false,
  requiredMessage,
  multiline = true,
  keyboardType,
  confirmLabel,
  confirmVariant = 'primary',
  onSubmit,
  onClose,
}) {
  const { t } = useI18n();
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  const submit = async () => {
    if (required && !value.trim()) {
      Alert.alert(title || t('common.error'), requiredMessage || t('common.required'));
      return;
    }
    setBusy(true);
    try {
      await onSubmit?.(value);
      onClose?.();
    } catch (e) {
      Alert.alert(t('common.error'), e?.message || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={busy ? undefined : onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onClose} accessibilityLabel={t('common.close')} />
        <View style={styles.sheet}>
          {title ? <Txt variant="h2">{title}</Txt> : null}
          {message ? <Txt variant="muted">{message}</Txt> : null}
          <Field
            label={label}
            placeholder={placeholder}
            value={value}
            onChangeText={setValue}
            multiline={multiline}
            keyboardType={keyboardType}
            inputStyle={multiline ? styles.input : undefined}
            autoFocus
          />
          <Row>
            <Button style={styles.flex} variant="outline" title={t('common.cancel')} disabled={busy} onPress={onClose} />
            <Button style={styles.flex} variant={confirmVariant} title={confirmLabel || t('common.submit')} loading={busy} onPress={submit} />
          </Row>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: space.lg, backgroundColor: 'rgba(11,59,46,0.45)' },
  sheet: { backgroundColor: colors.bg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.md },
  input: { minHeight: 90 },
  flex: { flex: 1 },
});
