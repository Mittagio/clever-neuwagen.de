/**
 * Golden Moment – erklärbarer nächster Verkaufsschritt (keine %-Kaufchance).
 * Erweitert Journey-/Reminder-Denke, keine zweite Engine.
 */
import {
  listCustomerVehicleTracks,
  sortTracksForOverview,
  VEHICLE_TRACK_STATUS,
  REJECTION_REASON_LABEL,
} from '../crm/vehicleTrack.js';

export const GOLDEN_MOMENT_TYPE = {
  FAVORITE_NEEDS_REVISED_OFFER: 'favorite_vehicle_needs_revised_offer',
  FAVORITE_FOLLOW_UP: 'favorite_vehicle_follow_up',
  OFFER_OPENED_POSITIVE: 'offer_opened_positive_reaction',
  DEFERRED_PRICE_FOCUS: 'deferred_price_focus_elsewhere',
  CHANGE_REQUESTED: 'customer_change_requested',
  MULTI_COMPARE_READY: 'multi_offer_compare_ready',
  SEND_REVISED_OFFER: 'revised_offer_ready_to_send',
};

/**
 * @param {object} lead
 * @returns {object|null} goldenMoment
 */
export function buildGoldenMoment(lead = {}) {
  const tracks = sortTracksForOverview(listCustomerVehicleTracks(lead));
  if (!tracks.length) return null;

  const favorite = tracks.find((t) => t.status === VEHICLE_TRACK_STATUS.FAVORITE);
  const deferred = tracks.filter((t) => t.status === VEHICLE_TRACK_STATUS.DEFERRED);
  const customerName = resolveCustomerName(lead);

  if (favorite) {
    const reqs = favorite.requirementLabels ?? [];
    const offerMissesReqs = reqs.length > 0;
    const reasons = [
      `${favorite.modelLabel}: positive Kundenreaktion / Favorit`,
    ];
    if (deferred.length) {
      for (const d of deferred) {
        const reason = d.rejectionReasonLabel
          || REJECTION_REASON_LABEL[d.rejectionReason]
          || 'zurückgestellt';
        reasons.push(`${d.modelLabel}: zurückgestellt · ${reason}`);
      }
    }
    if (offerMissesReqs) {
      reasons.push(`Zusätzliche Wünsche: ${reqs.join(' · ')}`);
      reasons.push('Aktuelles Angebot spiegelt die Wünsche noch nicht vollständig');
    }

    const bodyLines = [
      `${customerName} tendiert aktuell zum ${favorite.modelLabel}.`,
    ];
    if (deferred[0]) {
      const reason = deferred[0].rejectionReasonLabel
        || REJECTION_REASON_LABEL[deferred[0].rejectionReason]
        || 'Preis';
      bodyLines.push(
        `Der ${deferred[0].modelLabel} wurde wegen des Preises zurückgestellt.`
          .replace('wegen des Preises', `wegen: ${reason}`)
          .replace('wegen: zu teuer', 'wegen des Preises'),
      );
    }
    if (reqs.length) {
      bodyLines.push(
        `Beim ${favorite.modelLabel} sind ${reqs.join(', ')} wichtig.`,
      );
    }

    return {
      type: offerMissesReqs
        ? GOLDEN_MOMENT_TYPE.FAVORITE_NEEDS_REVISED_OFFER
        : GOLDEN_MOMENT_TYPE.FAVORITE_FOLLOW_UP,
      customerId: lead?.id ?? null,
      vehicleTrackId: favorite.id,
      reasons,
      recommendedAction: offerMissesReqs
        ? 'prepare_revised_offer'
        : 'follow_up_favorite',
      primaryLabel: `${favorite.modelLabel}-Angebot anpassen`,
      secondaryLabel: 'Nachfassen',
      headline: bodyLines[0],
      body: bodyLines.slice(1).join(' '),
      bodyLines,
      createdAt: new Date().toISOString(),
      // Explizit: keine Prozentzahl
      score: null,
      closureChance: null,
    };
  }

  if (deferred.length && tracks.some((t) => t.status === VEHICLE_TRACK_STATUS.OPEN
    || t.status === VEHICLE_TRACK_STATUS.ACTIVE)) {
    const focus = tracks.find((t) => (
      t.status === VEHICLE_TRACK_STATUS.OPEN || t.status === VEHICLE_TRACK_STATUS.ACTIVE
    ));
    const d = deferred[0];
    return {
      type: GOLDEN_MOMENT_TYPE.DEFERRED_PRICE_FOCUS,
      customerId: lead?.id ?? null,
      vehicleTrackId: focus?.id ?? null,
      reasons: [
        `${d.modelLabel}: zurückgestellt`,
        focus ? `${focus.modelLabel}: weiterhin offen` : null,
      ].filter(Boolean),
      recommendedAction: 'focus_open_track',
      primaryLabel: focus ? `${focus.modelLabel} vertiefen` : 'Nachfassen',
      secondaryLabel: 'Nachfassen',
      headline: `${customerName}: ${d.modelLabel} zurückgestellt.`,
      body: focus
        ? `Fokus auf ${focus.modelLabel}.`
        : 'Offene Fahrzeugspuren prüfen.',
      bodyLines: [
        `${customerName}: ${d.modelLabel} zurückgestellt.`,
        focus ? `Fokus auf ${focus.modelLabel}.` : null,
      ].filter(Boolean),
      createdAt: new Date().toISOString(),
      score: null,
      closureChance: null,
    };
  }

  if (tracks.length >= 2) {
    const allSent = tracks.every((t) => t.sentAt || t.offerStatus === 'sent' || t.offerStatus === 'opened');
    if (allSent) {
      return {
        type: GOLDEN_MOMENT_TYPE.MULTI_COMPARE_READY,
        customerId: lead?.id ?? null,
        vehicleTrackId: tracks[0]?.id ?? null,
        reasons: tracks.map((t) => `${t.modelLabel}: gesendet`),
        recommendedAction: 'await_or_ask_feedback',
        primaryLabel: 'Feedback einholen',
        secondaryLabel: 'Nachfassen',
        headline: `${customerName} kann ${tracks.length} Angebote vergleichen.`,
        body: 'Auf Kundenreaktion warten oder gezielt nachfassen.',
        bodyLines: [
          `${customerName} kann ${tracks.length} Angebote vergleichen.`,
          'Auf Kundenreaktion warten oder gezielt nachfassen.',
        ],
        createdAt: new Date().toISOString(),
        score: null,
        closureChance: null,
      };
    }
  }

  return null;
}

function resolveCustomerName(lead = {}) {
  const raw = lead?.name
    || [lead?.firstName, lead?.lastName].filter(Boolean).join(' ')
    || lead?.crm?.customerName
    || 'Der Kunde';
  const name = String(raw).trim();
  if (/^(herr|frau)\b/i.test(name)) return name;
  return name;
}

/**
 * UI-View für Clever-Karte (Mockup): eine Karte, erklärbar, navy CTA.
 */
export function buildGoldenMomentView(lead = {}) {
  const moment = buildGoldenMoment(lead);
  if (!moment) return null;
  return {
    ...moment,
    eyebrow: 'Clever',
    title: moment.headline,
    summary: [moment.headline, moment.body].filter(Boolean).join(' '),
    // Guard: never expose purchase probability
    closureChance: undefined,
    closureLabel: undefined,
    score: undefined,
  };
}
