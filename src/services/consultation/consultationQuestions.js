/**
 * Welt 1 – Bedarfsfragen (kein Fahrzeug, keine Ausstattung).
 */
export const NEED_CONSULTATION_QUESTIONS = [
  {
    id: 'annualKm',
    world: 'need_consultation',
    prompt: 'Wie viele Kilometer fahren Sie pro Jahr?',
    hint: 'Hilft bei Leasing-Laufleistung und Reichweitenplanung.',
    options: [
      { id: '8000', label: 'bis 8.000 km' },
      { id: '12000', label: '8.000 – 12.000 km' },
      { id: '15000', label: '12.000 – 15.000 km' },
      { id: '20000', label: '15.000 – 20.000 km' },
      { id: '25000', label: 'über 20.000 km' },
    ],
    skipIf: (ctx) => Boolean(ctx.searchProfile?.mileagePerYear || ctx.needProfile?.annualKm),
  },
  {
    id: 'paymentType',
    world: 'need_consultation',
    prompt: 'Leasing, Finanzierung oder Kauf?',
    options: [
      { id: 'leasing', label: 'Leasing' },
      { id: 'finance', label: 'Finanzierung' },
      { id: 'cash', label: 'Barzahlung' },
      { id: 'open', label: 'Noch unentschieden' },
    ],
    skipIf: (ctx) => Boolean(
      ctx.searchProfile?.paymentPreference
      || ctx.searchFilters?.payment
      || ctx.needProfile?.budget?.paymentType,
    ),
  },
  {
    id: 'monthlyBudget',
    world: 'need_consultation',
    prompt: 'Gibt es ein monatliches Budget?',
    options: [
      { id: '200', label: 'bis 200 €' },
      { id: '300', label: 'bis 300 €' },
      { id: '400', label: 'bis 400 €' },
      { id: '500', label: 'bis 500 €' },
      { id: '600', label: 'über 500 €' },
      { id: 'open', label: 'Noch kein Budget' },
    ],
    skipIf: (ctx) => Boolean(
      ctx.searchProfile?.maxMonthlyRate
      || ctx.searchFilters?.maxRate
      || ctx.needProfile?.budget?.maxMonthlyRate,
    ),
  },
  {
    id: 'passengers',
    world: 'need_consultation',
    prompt: 'Wie viele Personen fahren regelmäßig mit?',
    options: [
      { id: '2', label: '1–2 Personen' },
      { id: '4', label: '3–4 Personen' },
      { id: '5', label: '5 Personen' },
      { id: '7', label: '6–7 Personen' },
    ],
    skipIf: (ctx) => (ctx.searchProfile?.seatsMin ?? ctx.needProfile?.persons ?? 0) >= 5,
  },
  {
    id: 'towCapacity',
    world: 'need_consultation',
    prompt: 'Benötigen Sie Anhängelast?',
    options: [
      { id: 'no', label: 'Nein' },
      { id: 'light', label: 'Leichter Anhänger (bis 750 kg)' },
      { id: 'braked', label: 'Gebremster Anhänger (ab 1,5 t)' },
      { id: 'heavy', label: 'Wohnwagen / schwer (ab 2 t)' },
    ],
    skipIf: (ctx) => ctx.searchProfile?.requiredFeatures?.some((f) => f.startsWith('tow'))
      || (ctx.searchFilters?.towCapacityKg ?? 0) >= 750
      || ctx.needProfile?.towing != null,
  },
  {
    id: 'rangeImportance',
    world: 'need_consultation',
    prompt: 'Wie wichtig sind Reichweite und Ladegeschwindigkeit?',
    options: [
      { id: 'low', label: 'Weniger wichtig' },
      { id: 'medium', label: 'Wichtig' },
      { id: 'high', label: 'Sehr wichtig' },
    ],
    skipIf: (ctx) => ctx.searchProfile?.requiredFeatures?.includes('range_400')
      || (ctx.searchFilters?.rangeKmMin ?? 0) >= 400
      || ctx.needProfile?.priorities?.includes('range'),
  },
  {
    id: 'trunkImportance',
    world: 'need_consultation',
    prompt: 'Wie wichtig ist Kofferraumvolumen?',
    options: [
      { id: 'low', label: 'Weniger wichtig' },
      { id: 'medium', label: 'Wichtig' },
      { id: 'high', label: 'Sehr wichtig' },
    ],
    skipIf: (ctx) => ctx.searchProfile?.requiredFeatures?.includes('large_trunk')
      || ctx.needProfile?.dog
      || ctx.needProfile?.children,
  },
  {
    id: 'chargingAtHome',
    world: 'need_consultation',
    prompt: 'Können Sie zu Hause laden – Garage oder Wallbox?',
    options: [
      { id: 'yes', label: 'Ja, problemlos' },
      { id: 'maybe', label: 'Vielleicht / in Planung' },
      { id: 'no', label: 'Nein, eher öffentlich' },
      { id: 'open', label: 'Noch unklar' },
    ],
    skipIf: (ctx) => ctx.needProfile?.chargingAtHome != null
      || ctx.searchProfile?.chargingHomeHint != null,
  },
  {
    id: 'longDistance',
    world: 'need_consultation',
    prompt: 'Fahren Sie regelmäßig lange Strecken?',
    options: [
      { id: 'rarely', label: 'Selten – vor allem Stadt' },
      { id: 'sometimes', label: 'Ab und zu' },
      { id: 'often', label: 'Ja, häufig Langstrecke' },
    ],
    skipIf: (ctx) => ctx.answers?.longDistance != null,
  },
];

/**
 * Welt 2 – Fahrzeugberatung (Modell bekannt).
 */
export const VEHICLE_EQUIPMENT_QUESTIONS = [
  {
    id: 'heatPump',
    world: 'vehicle_consultation',
    prompt: 'Benötigen Sie eine Wärmepumpe?',
    options: [
      { id: 'yes', label: 'Ja, unbedingt' },
      { id: 'nice', label: 'Schön, aber nicht Pflicht' },
      { id: 'no', label: 'Nein' },
    ],
    skipIf: (ctx) => ctx.answers?.heatPump != null,
    requiresModelKey: true,
  },
  {
    id: 'hud',
    world: 'vehicle_consultation',
    prompt: 'Möchten Sie ein Head-up-Display?',
    options: [
      { id: 'yes', label: 'Ja' },
      { id: 'nice', label: 'Wäre schön' },
      { id: 'no', label: 'Nein' },
    ],
    requiresModelKey: true,
  },
  {
    id: 'v2l',
    world: 'vehicle_consultation',
    prompt: 'Ist V2L oder bidirektionales Laden wichtig?',
    options: [
      { id: 'yes', label: 'Ja, wichtig' },
      { id: 'nice', label: 'Interessant, aber optional' },
      { id: 'no', label: 'Nein' },
    ],
    skipIf: (ctx) => ctx.searchProfile?.fuel !== 'electric' && ctx.searchFilters?.fuel !== 'elektro',
    requiresModelKey: true,
  },
];

/** @deprecated Nutze NEED_CONSULTATION_QUESTIONS oder VEHICLE_EQUIPMENT_QUESTIONS */
export const CONSULTATION_QUESTIONS = [
  ...NEED_CONSULTATION_QUESTIONS,
  ...VEHICLE_EQUIPMENT_QUESTIONS,
];

export const NEED_QUESTION_IDS = new Set(NEED_CONSULTATION_QUESTIONS.map((q) => q.id));
export const VEHICLE_QUESTION_IDS = new Set(VEHICLE_EQUIPMENT_QUESTIONS.map((q) => q.id));
