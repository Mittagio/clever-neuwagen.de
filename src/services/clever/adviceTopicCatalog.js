/**
 * Regelbasierte Beratungs-Faktensnippets – Quelle der Wahrheit für advice_question.
 */
export const ADVICE_TOPICS = {
  HEAT_PUMP_BENEFIT: 'heat_pump_benefit',
  AWD_NEED: 'awd_need',
  LEASING_VS_FINANCE: 'leasing_vs_finance',
  BATTERY_SIZE: 'battery_size',
  RANGE_WINTER: 'range_winter',
  BUY_VS_LEASE: 'buy_vs_lease',
};

const TOPIC_RULES = [
  {
    topic: ADVICE_TOPICS.HEAT_PUMP_BENEFIT,
    featureId: 'heat_pump',
    patterns: [
      /warum.*wärmepumpe/i,
      /wärmepumpe.*(sinnvoll|brauch|lohnt|nehmen)/i,
      /wärmepumpe.*warum/i,
    ],
    headline: 'Wärmepumpe bei Elektroautos',
    snippets: [
      'Eine Wärmepumpe nutzt Umgebungswärme statt nur Heizstab-Heizung.',
      'Im Winter bleibt oft mehr Reichweite übrig als ohne Wärmepumpe.',
      'Bei vielen E-Modellen ab mittlerer Ausstattung üblich.',
    ],
  },
  {
    topic: ADVICE_TOPICS.AWD_NEED,
    featureId: 'awd',
    patterns: [
      /brauche?\s+ich\s+allrad/i,
      /allrad.*(sinnvoll|nötig|lohnt)/i,
      /\b4x4\b.*(brauch|nötig)/i,
    ],
    headline: 'Allrad – wann sinnvoll?',
    snippets: [
      'Allrad hilft bei Schnee, Steigung und unbefestigten Wegen.',
      'Für reine Pendlerstrecken reicht oft Frontantrieb.',
      'Welches Modell passt, hängt von Alltag und Budget ab.',
    ],
  },
  {
    topic: ADVICE_TOPICS.LEASING_VS_FINANCE,
    patterns: [
      /leasing\s+oder\s+finanzierung/i,
      /finanzierung\s+oder\s+leasing/i,
      /kauf\s+oder\s+leasing/i,
      /was\s+lohnt.*(leasing|finanzierung)/i,
    ],
    headline: 'Leasing oder Finanzierung?',
    snippets: [
      'Leasing: feste Rate, planbare Laufzeit, Fahrzeug geht zurück.',
      'Finanzierung: Sie werden Eigentümer, oft längere Nutzung.',
      'Die passende Form hängt von Laufzeit, Kilometern und Steuer ab.',
    ],
  },
  {
    topic: ADVICE_TOPICS.BATTERY_SIZE,
    patterns: [
      /welche\s+batterie/i,
      /batteriegröße/i,
      /kleine\s+batterie.*reicht/i,
      /große\s+batterie.*nötig/i,
    ],
    headline: 'Batteriegröße einschätzen',
    snippets: [
      'Kurze Pendelstrecken: kompaktere Batterie kann reichen.',
      'Vielfahrer und Urlaub: größere Batterie bringt mehr Puffer.',
      'Reichweite hängt stark von Temperatur und Fahrstil ab.',
    ],
  },
  {
    topic: ADVICE_TOPICS.RANGE_WINTER,
    featureId: 'heat_pump',
    patterns: [
      /reichweite.*winter/i,
      /winter.*reichweite/i,
      /kälte.*reichweite/i,
    ],
    headline: 'Reichweite im Winter',
    snippets: [
      'Kälte reduziert die Reichweite – das ist bei allen E-Autos normal.',
      'Wärmepumpe und Vorklimatisierung beim Laden helfen.',
      'Im Alltag oft 15–25 % weniger als WLTP-Wert.',
    ],
  },
  {
    topic: ADVICE_TOPICS.BUY_VS_LEASE,
    patterns: [
      /kaufen\s+oder\s+leasen/i,
      /lohnt\s+sich\s+kauf/i,
      /barzahlung\s+oder\s+leasing/i,
    ],
    headline: 'Kaufen oder leasen?',
    snippets: [
      'Kauf lohnt sich oft bei langer Haltedauer.',
      'Leasing hält die monatliche Belastung planbar.',
      'Ihr Autohaus rechnet beide Varianten gern durch.',
    ],
  },
];

/**
 * @param {string} query
 */
export function matchAdviceTopic(query = '') {
  const text = String(query).trim();
  for (const rule of TOPIC_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return {
        topic: rule.topic,
        featureId: rule.featureId ?? null,
        headline: rule.headline,
        snippets: [...rule.snippets],
      };
    }
  }
  return null;
}

/**
 * @param {string} topic
 */
export function getAdviceTopicById(topic) {
  const rule = TOPIC_RULES.find((item) => item.topic === topic);
  if (!rule) return null;
  return {
    topic: rule.topic,
    featureId: rule.featureId ?? null,
    headline: rule.headline,
    snippets: [...rule.snippets],
  };
}
