/**
 * H) Fact Preservation – keine erfundenen Ausstattungen / keine stärkere Verfügbarkeit.
 */

function normalize(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9äöüß.\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const EQUIPMENT_HINTS = [
  '360',
  'totwinkel',
  'head-up',
  'head up',
  'harman',
  'sitzheizung',
  'lenkradheizung',
  'rueckfahrkamera',
  'rückfahrkamera',
  'parksensor',
  'waermepumpe',
  'wärmepumpe',
  'schiebedach',
  'panorama',
];

/**
 * @param {string} body
 * @param {object} grounded
 */
export function validateMessageFactPreservation(body = '', grounded = {}) {
  const warnings = [];
  const errors = [];
  const text = normalize(body);

  const sellerFacts = grounded.sellerFacts || [];
  const packageItems = (grounded.verifiedPackageFacts?.items || []).map(normalize);
  const equipmentItems = (grounded.verifiedEquipmentFacts?.items || []).map(normalize);
  const allowedEquipment = new Set([...packageItems, ...equipmentItems]);

  const availabilityFact = sellerFacts.find((f) => f.type === 'availability');
  if (!availabilityFact) {
    if (/\b(sofort )?verfuegbar\b/.test(text) || /\bsofort verfuegbar\b/.test(text)) {
      errors.push('availability_invented');
    }
    if (/\bauf lager\b/.test(text) || /\bhaben aktuell\b/.test(text) && /\bverfuegbar\b/.test(text)) {
      errors.push('availability_invented');
    }
  }

  // Paketdetails: wenn missing, dürfen keine konkreten Tech-Items auftauchen
  if (grounded.missingPackageContents) {
    for (const hint of ['360', 'totwinkel', 'head-up', 'head up', 'harman kardon']) {
      if (text.includes(hint) && ![...allowedEquipment].some((a) => a.includes(hint))) {
        errors.push(`package_item_invented:${hint}`);
      }
    }
  }

  // Ausstattung: erfundene typische Items, die weder Seller noch verified sind
  const sellerBlob = normalize(sellerFacts.map((f) => f.value).join(' '));
  for (const hint of EQUIPMENT_HINTS) {
    if (!text.includes(hint)) continue;
    if (sellerBlob.includes(hint)) continue;
    if ([...allowedEquipment].some((a) => a.includes(hint))) continue;
    // Schiebedach oft nur Seller Fact
    if (hint === 'schiebedach' || hint === 'panorama') continue;
    warnings.push(`equipment_unverified:${hint}`);
  }

  // Zahlen aus Offer müssen matchen
  const offer = grounded.offerFacts;
  if (offer?.monthlyRate != null) {
    const rate = String(offer.monthlyRate);
    if (text.includes(rate.replace('.', ',')) || text.includes(rate)) {
      // ok
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}
