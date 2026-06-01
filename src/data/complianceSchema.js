/**
 * Compliance Shield – Pflichtfelder & Status (WLTP / CO₂)
 * Werte dürfen nur aus OEM-Daten / Admin-Freigabe stammen – kein Händler-Freitext.
 */

export const COMPLIANCE_STATUS = {
  verified: 'verified',
  missing: 'missing',
  needs_review: 'needs_review',
};

export const COMPLIANCE_STATUS_UI = {
  verified: { emoji: '🟢', label: 'Veröffentlichbar' },
  needs_review: { emoji: '🟡', label: 'Prüfung nötig' },
  missing: { emoji: '🔴', label: 'Veröffentlichung blockiert' },
};

/** @typedef {'ice' | 'hev' | 'phev' | 'bev'} PowertrainType */

/** Gemeinsame Basis (Verbrenner / HEV) */
export const FIELDS_ICE = [
  { id: 'fuel', label: 'Kraftstoff / Energieart' },
  { id: 'consumptionCombined', label: 'Kraftstoffverbrauch kombiniert' },
  { id: 'co2Combined', label: 'CO₂-Emissionen kombiniert' },
  { id: 'co2Class', label: 'CO₂-Klasse' },
  { id: 'dataStandard', label: 'WLTP-Datenstandard' },
];

/** Voll-Elektro */
export const FIELDS_BEV = [
  { id: 'fuel', label: 'Kraftstoff / Energieart' },
  { id: 'electricConsumptionCombined', label: 'Stromverbrauch kombiniert' },
  { id: 'co2Combined', label: 'CO₂-Emissionen kombiniert' },
  { id: 'co2Class', label: 'CO₂-Klasse' },
  { id: 'electricRange', label: 'Elektrische Reichweite' },
  { id: 'dataStandard', label: 'WLTP-Datenstandard' },
];

/** Plug-in-Hybrid – alle PHEV-Pflichtangaben */
export const FIELDS_PHEV = [
  { id: 'fuel', label: 'Kraftstoff / Energieart' },
  { id: 'weightedConsumptionCombined', label: 'Kraftstoffverbrauch gewichtet kombiniert' },
  { id: 'weightedElectricConsumption', label: 'Stromverbrauch gewichtet kombiniert' },
  { id: 'weightedCo2Combined', label: 'CO₂-Emissionen gewichtet kombiniert' },
  { id: 'co2Class', label: 'CO₂-Klasse' },
  { id: 'depletedBatteryConsumption', label: 'Verbrauch bei entladener Batterie' },
  { id: 'electricRange', label: 'Elektrische Reichweite' },
  { id: 'electricConsumptionCombined', label: 'Stromverbrauch' },
  { id: 'dataStandard', label: 'WLTP-Datenstandard' },
];

export function getRequiredFieldsForPowertrain(powertrain) {
  switch (powertrain) {
    case 'bev':
      return FIELDS_BEV;
    case 'phev':
      return FIELDS_PHEV;
    case 'hev':
    case 'ice':
    default:
      return FIELDS_ICE;
  }
}

export function createDefaultComplianceMeta(source = 'Hersteller-Preisliste') {
  return {
    source,
    sourceUrl: '',
    dataStandard: 'WLTP',
    verifiedBy: '',
    verifiedAt: '',
    status: COMPLIANCE_STATUS.missing,
    notes: [],
  };
}
