/**
 * Progressive Fahrzeugrichtungen während des Intake-Gesprächs.
 * Nach Substanz (Budget/Leasing/km/…) 2–3 Modelle zeigen; ✓ → Notizzettel.
 */
import {
  buildUnderstoodLabels,
  mergeTextIntoNeedProfile,
  modelDisplayLabel,
} from './needProfileService.js';
import { buildVehicleDirectionsView } from './vehicleDirectionService.js';

export const PROGRESSIVE_DIRECTIONS_SOURCE = 'progressive';
export const VEHICLE_DIRECTIONS_TURN_TYPE = 'vehicle_directions';

function countDirectionSignals(needProfile = {}) {
  const budget = needProfile.budget ?? {};
  let n = 0;
  if (budget.maxMonthlyRate || budget.maxPrice) n += 1;
  if (budget.paymentType) n += 1;
  if (needProfile.annualKm) n += 1;
  if (needProfile.fuel || (needProfile.usage?.length ?? 0) > 0) n += 1;
  if (needProfile.selectedModelKey || needProfile.modelHint || needProfile.bodyType) n += 1;
  if (needProfile.children || needProfile.priorities?.includes('family')) n += 1;
  if (needProfile.leaseDurationMonths) n += 1;
  if (needProfile.towbar || needProfile.towing) n += 1;
  return n;
}

/**
 * Genug Substanz für erste/aktualisierte Richtungen.
 * @param {object} needProfile
 */
export function hasProgressiveDirectionSignal(needProfile = {}) {
  return countDirectionSignals(needProfile) >= 2;
}

function isHandoffPhase(session = {}) {
  return session.phase === 'personal_handoff'
    || session.phase === 'handoff_complete'
    || (session.turns ?? []).some((turn) => turn.type === 'personal_handoff');
}

function excludedModelKeys(session = {}) {
  const reactions = session.vehicleDirectionReactions ?? {};
  return Object.entries(reactions)
    .filter(([, reaction]) => reaction === 'not_fit')
    .map(([modelKey]) => modelKey);
}

/**
 * @param {string} modelKey
 */
export function buildInterestedDirectionLabel(modelKey = '') {
  const base = modelDisplayLabel(modelKey).replace(/^Kia\s+/i, '');
  return `${base} interessant`;
}

/**
 * @param {string[]} labels
 * @param {string} modelKey
 * @param {'add'|'remove'} mode
 */
export function syncInterestedDirectionLabel(labels = [], modelKey, mode = 'add') {
  const target = buildInterestedDirectionLabel(modelKey).toLowerCase();
  const next = labels.filter((label) => String(label).toLowerCase() !== target);
  if (mode === 'add') next.push(buildInterestedDirectionLabel(modelKey));
  return next;
}

/**
 * Hängt oder aktualisiert progressive Fahrzeugrichtungen.
 * @param {object} session
 * @param {object} [prevNeedProfile] vorheriges Profil (für Trigger)
 */
export function maybeAppendProgressiveVehicleDirections(session = {}, prevNeedProfile = null) {
  if (!session || isHandoffPhase(session)) return session;

  const needProfile = session.needProfile ?? {};
  if (!hasProgressiveDirectionSignal(needProfile)) return session;

  const prevSignals = prevNeedProfile ? countDirectionSignals(prevNeedProfile) : 0;
  const nextSignals = countDirectionSignals(needProfile);
  const signalGrew = nextSignals > prevSignals;
  const firstTime = !(session.turns ?? []).some(
    (turn) => turn.type === VEHICLE_DIRECTIONS_TURN_TYPE
      && turn.source === PROGRESSIVE_DIRECTIONS_SOURCE,
  );

  if (!firstTime && !signalGrew && session.vehicleDirectionsView?.source === PROGRESSIVE_DIRECTIONS_SOURCE) {
    return session;
  }

  const excludeKeys = excludedModelKeys(session);
  const directionsView = {
    ...buildVehicleDirectionsView(needProfile, {
      excludeModelKeys: excludeKeys,
      limit: 3,
    }),
    source: PROGRESSIVE_DIRECTIONS_SOURCE,
    reactions: { ...(session.vehicleDirectionReactions ?? {}) },
  };

  if (!directionsView.directions?.length) return session;

  const turns = [...(session.turns ?? [])];
  const lastIdx = turns.length - 1;
  const last = turns[lastIdx];
  const progressiveTurn = {
    type: VEHICLE_DIRECTIONS_TURN_TYPE,
    id: `directions-progressive-${Date.now()}`,
    source: PROGRESSIVE_DIRECTIONS_SOURCE,
    directionsView,
  };

  if (last?.type === VEHICLE_DIRECTIONS_TURN_TYPE && last.source === PROGRESSIVE_DIRECTIONS_SOURCE) {
    turns[lastIdx] = {
      ...last,
      directionsView: {
        ...directionsView,
        reactions: {
          ...(last.directionsView?.reactions ?? {}),
          ...(session.vehicleDirectionReactions ?? {}),
        },
      },
    };
  } else {
    turns.push(progressiveTurn);
  }

  return {
    ...session,
    vehicleDirectionsView: directionsView,
    turns,
  };
}

/**
 * Notizzettel + Reactions nach Interessens-Klick.
 * @param {object} session
 * @param {string} modelKey
 * @param {'interested'|'not_fit'|'explore'} reactionId
 */
export function applyInterestedDirectionToNotepad(session, modelKey, reactionId) {
  let notepadLabels = [...(session.notepadLabels ?? [])];
  if (reactionId === 'interested') {
    notepadLabels = syncInterestedDirectionLabel(notepadLabels, modelKey, 'add');
  } else if (reactionId === 'not_fit') {
    notepadLabels = syncInterestedDirectionLabel(notepadLabels, modelKey, 'remove');
  } else {
    return { notepadLabels, needProfile: session.needProfile };
  }

  const needProfile = {
    ...session.needProfile,
    understoodLabels: buildUnderstoodLabels({
      ...session.needProfile,
      understoodLabels: notepadLabels,
    }),
  };

  // Mehrere Interessenten erlauben – selectedModelKey nur bei explore setzen
  return { notepadLabels, needProfile };
}

/**
 * Expliziter Klick auf eine Inspiration-Modellkachel (Händlerseite).
 * Page Context allein erzeugt keinen Wunsch – dieser aktive Klick schon.
 * Danach kann Soft Wish Enrichment / Handoff geöffnet werden.
 *
 * @param {object} session
 * @param {string} modelKey
 */
export function applyInspirationModelSelection(session = {}, modelKey = '') {
  const key = String(modelKey || '').trim().toLowerCase();
  if (!key) return session;

  const seedText = modelDisplayLabel(key);
  const needProfile = mergeTextIntoNeedProfile(seedText, session.needProfile ?? {});
  const interest = applyInterestedDirectionToNotepad(
    { ...session, needProfile },
    key,
    'interested',
  );

  const notepadLabels = [];
  for (const label of [
    ...(interest.notepadLabels ?? []),
    ...(buildUnderstoodLabels(interest.needProfile ?? needProfile)),
  ]) {
    if (label && !notepadLabels.includes(label)) notepadLabels.push(label);
  }

  return {
    ...session,
    needProfile: {
      ...(interest.needProfile ?? needProfile),
      understoodLabels: notepadLabels,
    },
    notepadLabels,
    vehicleDirectionReactions: {
      ...(session.vehicleDirectionReactions ?? {}),
      [key]: 'interested',
    },
  };
}
