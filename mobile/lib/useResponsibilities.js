import { useState } from 'react';
import { Alert } from 'react-native';
import { supabase, must } from './supabase';
import { useAuth } from './auth';
import { useAsync } from './useAsync';
import { useLiveReload } from './live';
import { useI18n } from './i18n';
import { respondActivity } from './activities';

/**
 * my_responsibilities() + live reload + Accept / Decline (note) / Done flow.
 * Returns { q, live, busy, prompt, setPrompt, respond, submitPrompt }.
 * Render a PromptModal for `prompt` ({ activityId, status }) and call
 * submitPrompt(note) from it.
 */
export function useResponsibilities({ enabled = true } = {}) {
  const { t } = useI18n();
  const { user, caps } = useAuth();
  const uid = user?.id;
  const on = enabled && !!uid && caps.isEmployee;
  const [busy, setBusy] = useState(null); // `${activityId}:${status}`
  const [prompt, setPrompt] = useState(null);

  const q = useAsync(() => must(supabase.rpc('my_responsibilities')), [uid], { enabled: on });
  const liveA = useLiveReload(['activity_assignees'], uid ? `profile_id=eq.${uid}` : undefined, q.reload, on);
  const liveB = useLiveReload(['activities', 'duty_assignments'], undefined, q.reload, on);
  const liveT = useLiveReload(['tasks'], uid ? `assignee_id=eq.${uid}` : undefined, q.reload, on);

  const run = async (activityId, status, note) => {
    setBusy(`${activityId}:${status}`);
    try {
      await respondActivity(activityId, status, note);
      q.reload();
    } finally {
      setBusy(null);
    }
  };

  const respond = (activityId, status) => {
    if (status === 'accepted') {
      run(activityId, status).catch((e) => Alert.alert(t('common.error'), e?.message || t('common.error')));
      return;
    }
    setPrompt({ activityId, status });
  };

  // Throws so PromptModal shows the error and stays open.
  const submitPrompt = (note) => run(prompt.activityId, prompt.status, note);

  const busyFor = (activityId) => (busy && busy.startsWith(`${activityId}:`) ? busy.split(':')[1] : null);

  return { q, live: liveA && liveB && liveT, busyFor, prompt, setPrompt, respond, submitPrompt };
}

/** PromptModal props for the current prompt. */
export function promptProps(t, prompt) {
  if (prompt?.status === 'declined') {
    return {
      title: t('activity.declineTitle'),
      message: t('activity.declineHint'),
      label: t('common.reason'),
      required: true,
      requiredMessage: t('activity.reasonRequired'),
      confirmLabel: t('activity.decline'),
      confirmVariant: 'danger',
    };
  }
  return {
    title: t('activity.doneTitle'),
    message: t('activity.doneHint'),
    label: t('activity.reportOptional'),
    required: false,
    confirmLabel: t('activity.markDone'),
    confirmVariant: 'primary',
  };
}
