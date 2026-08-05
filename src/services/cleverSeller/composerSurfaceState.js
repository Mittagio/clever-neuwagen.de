/**
 * Reine Hilfen für Idle/Expanded/Dock des Global Composers (unit-testbar).
 */

export const COMPOSER_DOCK_PLACEHOLDER = 'Frag Clever etwas oder erledige eine Aufgabe …';

export const COMPOSER_HERO_PLACEHOLDERS = [
  'Frage etwas, diktiere eine Notiz, füge eine Anfrage ein oder lade ein Dokument hoch …',
  'z. B. „Was liegt heute an?“ oder eine Notiz diktieren …',
  'z. B. Anfrage einfügen, PDF oder Foto hochladen …',
];

/** @deprecated Alias – Hero-Platzhalter */
export const COMPOSER_SOFT_PLACEHOLDERS = COMPOSER_HERO_PLACEHOLDERS;

export function resolveComposerSurfaceState({
  focused = false,
  draft = '',
  hasAttachment = false,
  dictating = false,
  reviewOpen = false,
  pendingAction = false,
  customerMessageEdit = false,
} = {}) {
  const active = Boolean(
    focused
    || String(draft || '').trim()
    || hasAttachment
    || dictating
    || reviewOpen
    || pendingAction
    || customerMessageEdit,
  );
  return active ? 'expanded' : 'idle';
}

/**
 * Hero oben ↔ Dock unten. Während Expanded nicht zurück zum Hero springen.
 */
export function resolveComposerDockMode({
  scrolledPastHero = false,
  surfaceExpanded = false,
  currentlyDocked = false,
} = {}) {
  if (scrolledPastHero) return 'docked';
  if (surfaceExpanded && currentlyDocked) return 'docked';
  return 'hero';
}

export function resolveComposerPlaceholder({
  draft = '',
  hintIndex = 0,
  dockMode = 'hero',
  placeholders = COMPOSER_HERO_PLACEHOLDERS,
} = {}) {
  if (String(draft || '').trim()) return '';
  if (dockMode === 'docked') return COMPOSER_DOCK_PLACEHOLDER;
  const list = placeholders?.length ? placeholders : COMPOSER_HERO_PLACEHOLDERS;
  return list[Math.abs(hintIndex) % list.length];
}

/** Content-Spacer unter docked Composer: Höhe + Safe-Area + 16px. */
export function resolveDockedContentSpacerPx({
  dockedComposerHeight = 72,
  safeAreaInsetBottom = 0,
  extraGap = 16,
} = {}) {
  const height = Math.max(0, Number(dockedComposerHeight) || 0);
  const safe = Math.max(0, Number(safeAreaInsetBottom) || 0);
  const gap = Math.max(0, Number(extraGap) || 0);
  return Math.ceil(height + safe + gap);
}
