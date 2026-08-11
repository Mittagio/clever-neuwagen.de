/**
 * Reine Hilfen für Idle/Expanded/Dock des Global Composers (unit-testbar).
 *
 * Universal Clever grammar (product freeze):
 * verstehen → gezielt ergänzen → handeln → bestätigen → weiterreden
 * Composer = Sprache + Arbeit; Chips = Quick decisions; Cards = Results;
 * Review nur bei Risiko / business binding.
 */

export const COMPOSER_DOCK_PLACEHOLDER = 'Frag Clever etwas oder erledige eine Aufgabe …';

/** Nach quiet Intake-Erkennung – Composer bleibt Arbeitsfläche */
export const COMPOSER_QUIET_INTAKE_PLACEHOLDER =
  'Frag Clever weiter oder ergänze fehlende Infos …';

/** Task-Titel: Aktionsverb + Name (nicht nur Status). */
const COMPOSER_TASK_TITLE_BY_KIND = {
  phone_add: 'TELEFON ERGÄNZEN',
  model_fix: 'MODELL KORRIGIEREN',
  offer_prepare: 'ANGEBOT VORBEREITEN',
  note_add: 'NOTIZ ERGÄNZEN',
};

/**
 * @param {{ kind?: string, name?: string }} opts
 * @returns {string} z. B. „TELEFON ERGÄNZEN · Matthias Wittig“
 */
export function buildComposerTaskTitle({ kind = '', name = '' } = {}) {
  const verb = COMPOSER_TASK_TITLE_BY_KIND[kind]
    || String(kind || '')
      .replace(/_/g, ' ')
      .trim()
      .toUpperCase()
    || 'ERGÄNZEN';
  const who = String(name || '').trim() || 'den Kunden';
  return `${verb} · ${who}`;
}

/**
 * Optional lokale Micro-Confirm nach Telefon-Subtask (Karte/Chip, nicht Composer).
 * Kein grüner Erfolgstext unter dem Composer – Erfolg = Chip + Glow.
 * @param {{ name?: string }} [_opts]
 * @returns {{ text: string, undoLabel: string, field: string }}
 */
export function buildPhoneAddedMicroConfirm(_opts = {}) {
  return {
    text: 'Telefon ergänzt',
    undoLabel: 'Rückgängig',
    field: 'phone',
  };
}

/**
 * Kurze Micro-Confirm nach Live-Edit / Korrektur (Karte, nicht Composer-Erfolg).
 * @param {{ fieldLabel?: string, verb?: string, field?: string }} [opts]
 */
export function buildFactChangedMicroConfirm({
  fieldLabel = 'Wert',
  verb = 'geändert',
  field = null,
} = {}) {
  return {
    text: `${fieldLabel} ${verb}`,
    undoLabel: 'Rückgängig',
    field: field || null,
  };
}

/**
 * @deprecated Prefer buildPhoneAddedMicroConfirm – lange Composer-Erfolgssätze sind eingefroren.
 * Liefert nur noch die kurze Micro-Confirm-Zeile (lavender/neutral, nicht grün).
 * @param {{ name?: string }} opts
 */
export function buildPhoneAddedConfirmation(opts = {}) {
  const micro = buildPhoneAddedMicroConfirm(opts);
  return `${micro.text} · ${micro.undoLabel}`;
}

export const COMPOSER_HERO_PLACEHOLDERS = [
  'Frag Clever … Anfrage einfügen, PDF oder Foto hochladen …',
  'Frag Clever … Was liegt heute an? Oder Notiz diktieren …',
  'Frag Clever … Anfrage einfügen, PDF oder Foto hochladen …',
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
  quietIntake = false,
} = {}) {
  if (String(draft || '').trim()) return '';
  if (quietIntake) return COMPOSER_QUIET_INTAKE_PLACEHOLDER;
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
