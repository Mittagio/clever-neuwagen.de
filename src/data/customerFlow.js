/** Sprint 16 – Kunden- vs. Händler-Routen & Begriffe */

export const CUSTOMER_ROUTES = {
  home: '/',
  vehicle: (slug) => `/fahrzeug/${slug}`,
  offer: (code) => `/angebot/${code}`,
  myArea: '/mein-bereich',
  login: '/login',
  vehicles: '/fahrzeuge',
};

export const DEALER_ROUTES = {
  backend: '/backend',
  salesOpportunities: '/backend/verkaufschancen',
  offers: '/backend/angebote',
  vehicles: '/backend/fahrzeuge',
  smartSales: '/sales/smart',
  conversation: '/gespraech',
};

export const CUSTOMER_LABELS = {
  saveOffer: 'Angebot merken',
  compare: 'Vergleichen',
  startInquiry: 'Anfrage senden',
  testDrive: 'Probefahrt anfragen',
  contactDealer: 'Händler kontaktieren',
  viewOffer: 'Angebot ansehen',
  myArea: 'Mein Bereich',
};

export const DEALER_LABELS = {
  salesOpportunity: 'Verkaufschance',
};

export function isCustomerPublicPath(pathname = '') {
  if (pathname.startsWith('/angebot') || pathname.startsWith('/offer')) return true;
  if (pathname.startsWith('/fahrzeug')) return true;
  if (pathname.startsWith('/mein-bereich') || pathname.startsWith('/login')) return true;
  if (pathname === '/' || pathname.startsWith('/fahrzeuge') || pathname.startsWith('/berater')) return true;
  if (pathname.startsWith('/vergleich')) return true;
  return false;
}

export function isDealerPath(pathname = '') {
  return pathname.startsWith('/backend') || pathname.startsWith('/communication') || pathname.startsWith('/offers') || pathname.startsWith('/sales');
}
