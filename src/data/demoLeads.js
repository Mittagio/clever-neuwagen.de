const now = Date.now();

/** Pilot Trinkle – 30-Sekunden End-to-End Demo (Bestellung → Auslieferung → Gutschein) */
export const PILOT_LEAD_ID = 'lead-pilot-trinkle';

export const PILOT_DEMO_LEAD = {
  id: PILOT_LEAD_ID,
  createdAt: new Date(now - 1000 * 60 * 60 * 4).toISOString(),
  updatedAt: new Date(now - 1000 * 60 * 15).toISOString(),
  status: 'bestellung',
  source: 'pilot',
  pilot: true,
  dealerId: 'autohaus-trinkle',
  contact: {
    name: 'Markus Brenner',
    phone: '+49 170 5550199',
    email: 'markus.brenner@demo-mail.de',
  },
  vehicle: {
    brand: 'Kia',
    model: 'Sportage',
    trim: 'Vision',
    engine: '1.6 T-GDI Plug-in Hybrid',
    label: 'Kia Sportage Vision Plug-in Hybrid',
  },
  paymentType: 'leasing',
  desiredRate: 329,
  currentRate: 319,
  notes: '🏁 Pilot Trinkle: Status „Ausgeliefert“ setzen → Bestätigungslink → Ja → 20-€-Gutschein wählen.',
  history: [
    {
      id: 'pilot-h1',
      at: new Date(now - 1000 * 60 * 60 * 4).toISOString(),
      type: 'system',
      text: 'Lead aus KI-Beratung · Autohaus Trinkle',
    },
    {
      id: 'pilot-h2',
      at: new Date(now - 1000 * 60 * 60 * 2).toISOString(),
      type: 'offer',
      text: 'Angebot CN-PILOT-001 versendet · 319 €/Monat Leasing',
    },
    {
      id: 'pilot-h3',
      at: new Date(now - 1000 * 60 * 15).toISOString(),
      type: 'status',
      text: 'Status: Bestellung · bereit für Auslieferungs-Flow',
    },
  ],
};

export const DEMO_LEADS = [
  PILOT_DEMO_LEAD,
  {
    id: 'lead-demo-001',
    createdAt: new Date(now - 1000 * 60 * 12).toISOString(),
    updatedAt: new Date(now - 1000 * 60 * 5).toISOString(),
    status: 'neu',
    source: 'configurator',
    contact: {
      name: 'Sarah Müller',
      phone: '+49 170 1234567',
      email: 'sarah.mueller@mail.de',
    },
    vehicle: {
      brand: 'Kia',
      model: 'Sportage',
      trim: 'GT-Line',
      engine: '1.6 T-GDI Plug-in Hybrid',
      label: 'Sportage GT-Line Plug-in Hybrid',
    },
    paymentType: 'leasing',
    desiredRate: 349,
    currentRate: 362,
    notes: 'Panorama-Glasdach wichtig. Rückruf nach 17 Uhr.',
    history: [
      {
        id: 'h1',
        at: new Date(now - 1000 * 60 * 12).toISOString(),
        type: 'system',
        text: 'Anfrage über Konfigurator eingegangen',
      },
      {
        id: 'h2',
        at: new Date(now - 1000 * 60 * 5).toISOString(),
        type: 'note',
        text: 'Kundin möchte Probefahrt am Wochenende',
      },
    ],
  },
  {
    id: 'lead-demo-002',
    createdAt: new Date(now - 1000 * 60 * 60 * 3).toISOString(),
    updatedAt: new Date(now - 1000 * 60 * 30).toISOString(),
    status: 'angebotVersendet',
    source: 'sales',
    contact: {
      name: 'Thomas Weber',
      phone: '+49 171 9876543',
      email: 't.weber@firma.de',
    },
    vehicle: {
      brand: 'Kia',
      model: 'Sportage',
      trim: 'Pulse',
      engine: '1.6 T-GDI MHEV',
      label: 'Sportage Pulse',
    },
    paymentType: 'leasing',
    desiredRate: 299,
    currentRate: 289,
    notes: '',
    history: [
      {
        id: 'h3',
        at: new Date(now - 1000 * 60 * 60 * 3).toISOString(),
        type: 'system',
        text: 'Anfrage aus Verkäufermodus',
      },
      {
        id: 'h4',
        at: new Date(now - 1000 * 60 * 45).toISOString(),
        type: 'status',
        text: 'Status: Angebot versendet',
      },
    ],
  },
  {
    id: 'lead-demo-003',
    createdAt: new Date(now - 1000 * 60 * 60 * 26).toISOString(),
    updatedAt: new Date(now - 1000 * 60 * 60 * 2).toISOString(),
    status: 'probefahrt',
    source: 'berater',
    contact: {
      name: 'Lisa Hoffmann',
      phone: '+49 160 5554433',
      email: 'lisa.h@web.de',
    },
    vehicle: {
      brand: 'Kia',
      model: 'Sportage',
      trim: 'GT-Line',
      engine: '1.6 T-GDI MHEV',
      label: 'Sportage GT-Line',
    },
    paymentType: 'finance',
    desiredRate: null,
    currentRate: 412,
    notes: 'Probefahrt Samstag 10 Uhr bestätigt',
    history: [
      {
        id: 'h5',
        at: new Date(now - 1000 * 60 * 60 * 26).toISOString(),
        type: 'system',
        text: 'Anfrage über Ausstattungsberater',
      },
      {
        id: 'h6',
        at: new Date(now - 1000 * 60 * 60 * 2).toISOString(),
        type: 'status',
        text: 'Status: Probefahrt',
      },
    ],
  },
];
