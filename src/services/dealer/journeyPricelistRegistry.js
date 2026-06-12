/**
 * Kia-Preislisten für Journey-Angebote (Trim-basiert, ohne voller Konfigurator).
 */
import ev3 from '../../data/kia/pricelist-imports/ev3.json' with { type: 'json' };
import ev4 from '../../data/kia/pricelist-imports/ev4.json' with { type: 'json' };
import ev4Fastback from '../../data/kia/pricelist-imports/ev4-fastback.json' with { type: 'json' };
import ev5 from '../../data/kia/pricelist-imports/ev5.json' with { type: 'json' };
import ev9 from '../../data/kia/pricelist-imports/ev9.json' with { type: 'json' };
import ev9Gt from '../../data/kia/pricelist-imports/ev9-gt.json' with { type: 'json' };
import sportage from '../../data/kia/pricelist-imports/sportage.json' with { type: 'json' };
import sportageHybrid from '../../data/kia/pricelist-imports/sportage-hybrid.json' with { type: 'json' };
import sportagePhev from '../../data/kia/pricelist-imports/sportage-phev.json' with { type: 'json' };
import sorento from '../../data/kia/pricelist-imports/sorento.json' with { type: 'json' };
import sorentoHybrid from '../../data/kia/pricelist-imports/sorento-hybrid.json' with { type: 'json' };
import sorentoPhev from '../../data/kia/pricelist-imports/sorento-phev.json' with { type: 'json' };

/** @type {Record<string, object>} */
export const JOURNEY_PRICELISTS = {
  ev3,
  ev4,
  'ev4-fastback': ev4Fastback,
  ev5,
  ev9,
  'ev9-gt': ev9Gt,
  sportage,
  'sportage-hybrid': sportageHybrid,
  'sportage-phev': sportagePhev,
  sorento,
  'sorento-hybrid': sorentoHybrid,
  'sorento-phev': sorentoPhev,
};

export const SORENTO_CONFIGURATOR_CATALOG_ID = 'sorento';

/**
 * @param {string} modelKey
 */
export function hasJourneyPricelist(modelKey) {
  return Boolean(JOURNEY_PRICELISTS[String(modelKey ?? '').toLowerCase()]);
}

/**
 * @param {string} modelKey
 */
export function getJourneyPricelist(modelKey) {
  return JOURNEY_PRICELISTS[String(modelKey ?? '').toLowerCase()] ?? null;
}
