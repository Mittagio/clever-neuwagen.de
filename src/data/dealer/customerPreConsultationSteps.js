/**
 * Vorberatung nach Modellinteresse – einfache Beratungsfragen (kein Katalog).
 */

/** @typedef {{ id: string, label: string, chipIds?: string[] }} PreConsultOption */

/** @type {PreConsultOption[]} */
export const PRECONSULT_PRIORITY_OPTIONS = [
  { id: 'price', label: 'möglichst günstig fahren', chipIds: ['advisor_price_low'] },
  { id: 'range', label: 'viel Reichweite', chipIds: ['advisor_range_max'] },
  { id: 'comfort', label: 'bequem im Alltag', chipIds: ['sitzheizung_vorne', 'lenkradheizung'] },
  { id: 'tech', label: 'viel Technik', chipIds: ['surround_view_camera', 'head_up_display'] },
  { id: 'family', label: 'Familie & Gepäck', chipIds: ['advisor_large_trunk', 'advisor_stroller'] },
  { id: 'tow', label: 'Anhänger / Transport', chipIds: ['advisor_towbar'] },
  { id: 'design', label: 'sportliches Design', chipIds: ['advisor_premium'] },
];

/** @type {PreConsultOption[]} */
export const PRECONSULT_USAGE_OPTIONS = [
  { id: 'city', label: 'Stadt / Kurzstrecke' },
  { id: 'commute', label: 'Pendeln' },
  { id: 'vacation', label: 'Urlaub / Langstrecke', chipIds: ['advisor_range_max'] },
  { id: 'family', label: 'Familie', chipIds: ['advisor_stroller', 'advisor_large_trunk'] },
  { id: 'luggage', label: 'viel Gepäck', chipIds: ['advisor_large_trunk', 'advisor_dog_luggage'] },
  { id: 'trailer', label: 'Anhänger oder Fahrradträger', chipIds: ['advisor_towbar'] },
];

/** @type {PreConsultOption[]} */
export const PRECONSULT_EQUIPMENT_OPTIONS = [
  { id: 'sitzheizung_vorne', label: 'Sitzheizung' },
  { id: 'surround_view_camera', label: '360° Kamera' },
  { id: 'waermepumpe', label: 'Wärmepumpe' },
  { id: 'advisor_towbar', label: 'Anhängelast' },
  { id: 'elektrische_heckklappe', label: 'elektrische Heckklappe' },
  { id: 'head_up_display', label: 'Head-up Display' },
  { id: 'navigation', label: 'großes Navi', chipIds: ['navigation'] },
  { id: 'harman_kardon', label: 'Soundsystem', chipIds: ['harman_kardon'] },
  { id: 'v2l', label: 'bidirektionales Laden / V2L' },
];

export const PRECONSULT_STEPS = ['intro', 'priorities', 'usage', 'equipment', 'result'];

export const PRECONSULT_COPY = {
  introHeadline: 'Wir grenzen Ihren Wunsch kurz ein',
  introSubline: 'Beantworten Sie ein paar einfache Fragen – Ihr Autohaus prüft danach die passende Variante.',
  introCta: 'Los geht\'s',
  prioritiesQuestion: 'Was ist Ihnen besonders wichtig?',
  usageQuestion: 'Wie nutzen Sie das Auto meistens?',
  equipmentQuestion: 'Gibt es Ausstattung, die Ihnen wichtig ist?',
  equipmentOptional: 'Optional – Sie können auch direkt weiter.',
  nextCta: 'Weiter',
  showSummaryCta: 'Zusammenfassung anzeigen',
  resultHeadline: 'Das haben wir verstanden',
  resultWishLabel: 'Ihr Wunsch',
  resultDirectionTitle: 'Das könnte eine passende Richtung sein',
  resultDirectionSuffix: 'prüfen',
  resultLead: 'Clever hat vorsortiert. Ihr Verkäufer prüft, welche Variante wirklich passt.',
  resultHint: 'Ausstattung, Verfügbarkeit und Rate bestätigt Ihr Autohaus.',
  contactCta: 'Experte soll mich kontaktieren',
  editCta: 'Angaben ändern',
  stepLabels: {
    priorities: 'Wichtig',
    usage: 'Nutzung',
    equipment: 'Ausstattung',
    result: 'Zusammenfassung',
  },
};

/**
 * @param {string} optionId
 * @param {PreConsultOption[]} options
 */
export function getPreConsultOptionLabel(optionId, options) {
  return options.find((o) => o.id === optionId)?.label ?? optionId;
}
