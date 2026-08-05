/**
 * Reine Hilfen für Idle/Expanded/Dock des Global Composers (unit-testbar).
 */

export function resolveComposerSurfaceState({
  focused = false,
  draft = '',
  hasAttachment = false,
  dictating = false,
  reviewOpen = false,
} = {}) {
  const active = Boolean(
    focused
    || String(draft || '').trim()
    || hasAttachment
    || dictating
    || reviewOpen,
  );
  return active ? 'expanded' : 'idle';
}

export function resolveComposerDockMode({ scrolledPastHero = false } = {}) {
  return scrolledPastHero ? 'docked' : 'hero';
}

export const COMPOSER_SOFT_PLACEHOLDERS = [
  'Frage etwas, diktiere eine Notiz, füge eine Anfrage ein oder lade ein Dokument hoch …',
  'z. B. „Was liegt heute an?“ oder eine Notiz diktieren …',
  'z. B. Anfrage einfügen, PDF oder Foto hochladen …',
];

export function resolveComposerPlaceholder({
  draft = '',
  hintIndex = 0,
  placeholders = COMPOSER_SOFT_PLACEHOLDERS,
} = {}) {
  if (String(draft || '').trim()) return '';
  const list = placeholders?.length ? placeholders : COMPOSER_SOFT_PLACEHOLDERS;
  return list[Math.abs(hintIndex) % list.length];
}
