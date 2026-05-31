const SUBDOMAIN_BASE = 'clever-neuwagen.de';

export function slugifyDealerName(name) {
  return (name ?? '')
    .toLowerCase()
    .trim()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildSubdomain(slug) {
  if (!slug) return null;
  return `${slug}.${SUBDOMAIN_BASE}`;
}

export function buildPartnerUrl(slug) {
  const subdomain = buildSubdomain(slug);
  if (typeof window !== 'undefined' && window.location?.origin?.includes('localhost')) {
    return `${window.location.origin}/haendler/${slug}`;
  }
  return `https://${subdomain}`;
}

export function validateStep(step, draft) {
  switch (step) {
    case 1:
      if (!draft.dealer.name?.trim()) return 'Bitte Händlernamen eingeben.';
      if (!draft.dealer.plz?.trim()) return 'Bitte PLZ eingeben.';
      if (!draft.dealer.city?.trim()) return 'Bitte Ort eingeben.';
      if (!draft.slug?.trim()) return 'Bitte gültigen Slug prüfen.';
      return null;
    case 2:
      if (!draft.brands?.length) return 'Bitte mindestens eine Marke wählen.';
      return null;
    case 3:
      return null;
    case 4:
      return null;
    case 5:
      if (!draft.deliveryTimes?.default?.trim()) return 'Bitte Standard-Lieferzeit angeben.';
      return null;
    case 6:
      return null;
    default:
      return null;
  }
}

export async function copySubdomain(subdomain) {
  await navigator.clipboard.writeText(`https://${subdomain}`);
}
