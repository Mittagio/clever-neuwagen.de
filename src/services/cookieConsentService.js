import { COOKIE_CONSENT_KEY } from '../constants/legal.js';

/** Consent-Stufen – Marketing/Analyse erst nach Tool-Aktivierung wirksam */
export const CONSENT_LEVEL = {
  ESSENTIAL: 'essential',
  ALL: 'all',
  CUSTOM: 'custom',
};

export const CONSENT_CATEGORIES = {
  essential: {
    id: 'essential',
    label: 'Technisch notwendig',
    description: 'Erforderlich für Betrieb, Login und Speicherung Ihrer Einstellungen.',
    required: true,
    active: true,
  },
  analytics: {
    id: 'analytics',
    label: 'Analyse',
    description: 'Hilft uns, die Plattform zu verbessern (z. B. Google Analytics, Microsoft Clarity, Hotjar).',
    required: false,
    active: false,
    tools: ['Google Analytics', 'Microsoft Clarity', 'Hotjar'],
  },
  marketing: {
    id: 'marketing',
    label: 'Marketing',
    description: 'Für personalisierte Werbung (z. B. Meta Pixel).',
    required: false,
    active: false,
    tools: ['Meta Pixel'],
  },
};

const DEFAULT_CONSENT = {
  level: CONSENT_LEVEL.ESSENTIAL,
  categories: {
    essential: true,
    analytics: false,
    marketing: false,
  },
  at: null,
};

export function getStoredConsent() {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveConsent(consent) {
  const payload = {
    ...DEFAULT_CONSENT,
    ...consent,
    at: new Date().toISOString(),
  };
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(payload));
  } catch {
    /* ignorieren */
  }
  return payload;
}

export function acceptEssentialOnly() {
  return saveConsent({
    level: CONSENT_LEVEL.ESSENTIAL,
    categories: { essential: true, analytics: false, marketing: false },
  });
}

export function acceptAll() {
  return saveConsent({
    level: CONSENT_LEVEL.ALL,
    categories: { essential: true, analytics: true, marketing: true },
  });
}

export function acceptCustom(categories) {
  return saveConsent({
    level: CONSENT_LEVEL.CUSTOM,
    categories: {
      essential: true,
      analytics: !!categories.analytics,
      marketing: !!categories.marketing,
    },
  });
}

/** Analytics/Marketing-Skripte erst laden, wenn Tool aktiv UND Consent erteilt */
export function hasAnalyticsConsent() {
  const stored = getStoredConsent();
  if (!stored) return false;
  return !!stored.categories?.analytics && CONSENT_CATEGORIES.analytics.active;
}

export function hasMarketingConsent() {
  const stored = getStoredConsent();
  if (!stored) return false;
  return !!stored.categories?.marketing && CONSENT_CATEGORIES.marketing.active;
}
