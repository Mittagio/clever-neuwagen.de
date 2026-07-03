/**
 * Activity-Feed & Admin-Tasks bei Mail-Ereignissen (nur Browser).
 */

let activityHook = null;

export function registerMailActivityHook(hook) {
  activityHook = hook;
}

function tryAppendActivity(entry) {
  if (activityHook) {
    activityHook(entry);
    return;
  }
  if (typeof window === 'undefined') return;
  import('../admin/leitstand/adminLeitstandStore.js')
    .then(({ appendActivityFeed }) => appendActivityFeed(entry))
    .catch(() => {});
}

export function logMailSentActivity({ to, templateName, subject }) {
  tryAppendActivity({
    actor: 'System',
    action: 'E-Mail versendet',
    detail: `${templateName ?? 'Mail'} → ${to} · ${subject}`,
    entityType: 'mail',
    severity: 'success',
  });
}

export function logMailFailedActivity({ to, templateName, error }) {
  tryAppendActivity({
    actor: 'System',
    action: 'E-Mail fehlgeschlagen',
    detail: `${templateName ?? 'Mail'} → ${to}: ${error ?? 'Unbekannter Fehler'}`,
    entityType: 'mail',
    severity: 'urgent',
  });
}

export function logMailRetryActivity({ to, templateName, retryCount }) {
  tryAppendActivity({
    actor: 'System',
    action: 'E-Mail erneut gesendet',
    detail: `${templateName ?? 'Mail'} → ${to} (Versuch ${retryCount})`,
    entityType: 'mail',
    severity: 'info',
  });
}
