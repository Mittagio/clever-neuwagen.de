/**
 * Verkäufer-Darstellung: Modell zuerst, Nutzen statt Rohdaten.
 */
import { getMatchDisplayTitle, getMatchVariantLabel } from '../../logic/discoveryDisplay.js';
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';

/**
 * @param {object} group
 */
export function resolveDealerModelTitle(group) {
  const modelKey = group?.modelLineKey;
  const attr = modelKey && KIA_MODEL_ATTRIBUTES[modelKey];
  if (attr?.label) return `Kia ${attr.label}`;

  const raw = group?.label ?? getMatchDisplayTitle(group?.primaryMatch);
  const cleaned = String(raw ?? '')
    .replace(/\s+GT$/i, '')
    .replace(/\s+(Earth|Air|Vision|GT-Line|GT Line|Style|Design|Premium|Spirit|Gravity)\s*$/i, '')
    .trim();

  if (!cleaned) return 'Kia';
  return cleaned.startsWith('Kia') ? cleaned : `Kia ${cleaned}`;
}

/**
 * @param {object} group
 */
export function resolveDealerRecommendedTrim(group) {
  return group?.recommendedTrimLabel
    ?? getMatchVariantLabel(group?.primaryMatch)
    ?? null;
}

/**
 * @param {object} [quote]
 * @param {object[]} [checks]
 */
export function buildDealerFulfillmentHeadline(quote, checks = []) {
  const fulfilled = quote?.matched
    ?? checks.filter((c) => c.status === 'fulfilled').length;
  const total = quote?.scorableTotal
    ?? quote?.total
    ?? checks.filter((c) => c.status !== 'unknown').length;

  if (!total) return null;
  if (fulfilled >= total) return `Erfüllt alle ${total} Wünsche`;
  return `${fulfilled} von ${total} Wünschen erfüllt`;
}

/**
 * Kurztext unter dem CleverQuote-Score (kundenverständlich).
 * @param {object} [quote]
 * @param {object[]} [checks]
 */
export function buildCleverQuoteSubline(quote, checks = []) {
  const headline = buildDealerFulfillmentHeadline(quote, checks);
  if (!headline) return null;
  if (headline.startsWith('Erfüllt alle')) return 'Erfüllt alle erkannten Wünsche';
  return headline;
}

/**
 * ✓-Zeilen für CleverQuote – aus Quote-Items, Checks oder Fallback-Lines.
 * @param {object} [quote]
 * @param {object[]} [checks]
 * @param {string[]} [fallbackLines]
 * @param {number} [max]
 */
export function buildCleverQuoteWishLines(quote, checks = [], fallbackLines = [], max = 6) {
  const fromQuote = (quote?.items ?? [])
    .filter((item) => item.status === 'fulfilled' && item.label)
    .map((item) => item.label);
  const fromChecks = buildDealerWishCheckLines(checks);
  const merged = [...new Set([...fromQuote, ...fromChecks, ...fallbackLines])];
  return merged.slice(0, max);
}

/**
 * @param {object} check
 */
function benefitLineForCheck(check) {
  const id = check.canonicalId ?? check.id;

  if (id === 'seats' || id === 'seats_7') {
    const n = check.label?.match(/\d+/)?.[0] ?? '7';
    return `${n} Sitze für die ganze Familie`;
  }
  if (id === 'range_km') {
    if (check.detail) {
      const km = check.detail.replace(/\s*km/i, '').trim();
      return `Über ${km} km Reichweite`;
    }
    return 'Hohe Reichweite für lange Strecken';
  }
  if (id === 'height_mm') {
    return 'Passt in eine 2 m Garage';
  }
  if (id === 'length_mm') {
    return check.detail ? `Nur ${check.detail} lang – handlich im Alltag` : 'Kompakte Abmessungen';
  }
  if (id === 'tow_braked' || id === 'towbar' || id === 'tow_capacity_2000') {
    if (check.detail) {
      const kg = Number.parseInt(check.detail, 10);
      if (Number.isFinite(kg)) {
        const t = Math.round(kg / 100) / 10;
        return `${String(t).replace('.', ',')} t Anhängelast`;
      }
    }
    return 'Anhängerkupplung für Wohnwagen & Co.';
  }
  if (id === 'heated_seats') return 'Sitzheizung verfügbar';
  if (id === 'heat_pump') return 'Wärmepumpe für effizientes Elektrofahren';
  if (id === 'camera_360') return '360°-Kamera für sicheres Rangieren';
  if (id === 'rear_camera') return 'Rückfahrkamera serienmäßig';
  if (id === 'trunk_l' || id === 'large_trunk') {
    return check.detail ? `${check.detail} Kofferraum` : 'Großzügiger Kofferraum';
  }
  if (id === 'isofix_rear') return 'Isofix für Kindersitze';
  if (id === 'fuel') return check.label === 'Elektro' ? 'Vollelektro – lokal emissionsfrei' : check.label;

  return check.label;
}

/**
 * @param {object[]} checks
 * @param {number} [max]
 */
export function buildDealerBenefitBullets(checks = [], max = 6) {
  return checks
    .filter((c) => c.status === 'fulfilled' || c.status === 'package')
    .slice(0, max)
    .map((check) => benefitLineForCheck(check));
}

/**
 * Verständliche „Warum empfiehlt Clever …?“-Zeilen mit konkreten Werten.
 * @param {object[]} checks
 */
export function buildDealerWhyReasonLines(checks = []) {
  return checks
    .filter((c) => c.status === 'fulfilled' || c.status === 'package')
    .map((check) => {
      const id = check.canonicalId ?? check.id;

      if (id === 'seats' || id === 'seats_7') {
        const n = check.detail?.match(/\d+/)?.[0]
          ?? check.label?.match(/\d+/)?.[0]
          ?? '7';
        return `${n} Sitze vorhanden`;
      }
      if (id === 'range_km') {
        const km = check.detail?.replace(/\s*km/i, '').trim()
          ?? check.label?.match(/\d+/)?.[0];
        return km ? `Reichweite ${km} km` : 'Hohe Reichweite';
      }
      if (id === 'tow_braked' || id === 'towbar' || id === 'tow_capacity_2000') {
        if (check.detail) {
          const kg = Number.parseInt(check.detail, 10);
          if (Number.isFinite(kg) && kg >= 1000) {
            const t = Math.round(kg / 100) / 10;
            return `Anhängelast bis ${String(t).replace('.', ',')} t`;
          }
        }
        return 'Anhängerkupplung verfügbar';
      }
      if (id === 'trunk_l' || id === 'large_trunk') {
        return check.detail ? `Kofferraum ${check.detail}` : 'Großer Kofferraum';
      }
      if (id === 'heat_pump') return 'Wärmepumpe verfügbar';
      if (id === 'camera_360') return '360° Kamera verfügbar';
      if (id === 'heated_seats') return 'Sitzheizung verfügbar';
      if (check.detail) return `${check.label}: ${check.detail}`;
      return `${check.label} vorhanden`;
    });
}

/**
 * Kurze Wunsch-Zeilen für „Warum passt dieses Fahrzeug?“
 * @param {object[]} checks
 */
export function buildDealerWishCheckLines(checks = []) {
  return checks
    .filter((c) => c.status === 'fulfilled' || c.status === 'package')
    .map((check) => {
      const id = check.canonicalId ?? check.id;
      if (id === 'seats' || id === 'seats_7') {
        const n = check.label?.match(/\d+/)?.[0];
        return n ? `${n} Sitze` : check.label;
      }
      if (id === 'range_km') {
        if (check.detail) {
          const km = check.detail.replace(/\s*km/i, '').trim();
          return `über ${km} km Reichweite`;
        }
        return check.label;
      }
      if (id === 'height_mm') return 'passt in Ihre Garage';
      if (id === 'towbar' || id === 'tow_braked' || id === 'tow_capacity_2000') {
        if (check.detail) {
          const kg = Number.parseInt(check.detail, 10);
          if (Number.isFinite(kg) && kg >= 1000) {
            const t = Math.round(kg / 100) / 10;
            return `${String(t).replace('.', ',')} t Anhängelast`;
          }
        }
        return 'Anhängerkupplung';
      }
      if (id === 'heated_seats') return 'Sitzheizung';
      if (id === 'heat_pump') return 'Wärmepumpe';
      if (id === 'camera_360') return '360° Kamera';
      if (id === 'large_trunk' || id === 'trunk_l') return 'großer Kofferraum';
      return check.label;
    });
}

function resolveGroupTowKg(group) {
  const v = group?.primaryMatch?.vehicle;
  const check = group?.modelChecks?.find((c) => ['tow_braked', 'towbar'].includes(c.id));
  if (check?.detail) {
    const kg = Number.parseInt(check.detail, 10);
    if (Number.isFinite(kg)) return kg;
  }
  return v?.towCapacityKg ?? v?.cleverRecord?.towing?.brakedKg ?? null;
}

/**
 * Ein Beratersatz über der Top-Empfehlung.
 * @param {object} group
 * @param {object[]} [allGroups]
 */
export function buildDealerRecommendationLead(group, allGroups = []) {
  const modelTitle = resolveDealerModelTitle(group);
  const shortName = modelTitle.replace(/^Kia\s+/i, '');
  const checks = group?.modelChecks ?? [];
  const fulfillment = buildDealerFulfillmentHeadline(group?.modelQuote, checks);

  let sentence = `Clever empfiehlt ${modelTitle}.`;

  if (fulfillment?.startsWith('Erfüllt alle')) {
    const n = fulfillment.match(/(\d+)/)?.[1] ?? '';
    sentence += ` Er erfüllt alle ${n} Ihrer Wünsche`;
  } else if (fulfillment) {
    sentence += ` Er erfüllt ${fulfillment.toLowerCase()}`;
  }

  const towKg = resolveGroupTowKg(group);
  const peerTow = allGroups
    .filter((g) => g !== group)
    .map(resolveGroupTowKg)
    .filter((kg) => kg != null);
  if (towKg != null && peerTow.length > 0 && towKg >= Math.max(...peerTow)) {
    sentence += ' und bietet die höchste Anhängelast unter den Top-Empfehlungen';
  } else if (fulfillment?.startsWith('Erfüllt alle')) {
    sentence += ` – der ${shortName} passt besonders gut zu Ihrer Anfrage`;
  }

  return `${sentence}.`;
}

/**
 * @param {object[]} checks
 */
export function buildDealerMissingWishSummary(checks = []) {
  const missing = checks.filter((c) => c.status === 'missing');
  if (!missing.length) return null;
  return missing.map((c) => c.label);
}
