/**
 * Strict JSON Schema für Screenshot-/WhatsApp-Vision-Interpret (OpenAI Responses).
 */
export const CLEVER_SCREENSHOT_INTERPRET_SCHEMA = {
  name: 'clever_screenshot_interpret',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'sourceKind',
      'phone',
      'email',
      'customerName',
      'as24OfferId',
      'vehicleLabel',
      'paymentType',
      'termMonths',
      'annualMileage',
      'openQuestions',
      'transcript',
      'confidence',
    ],
    properties: {
      sourceKind: {
        type: 'string',
        enum: ['whatsapp_screenshot', 'screenshot', 'photo', 'unknown'],
      },
      phone: { type: ['string', 'null'] },
      email: { type: ['string', 'null'] },
      customerName: { type: ['string', 'null'] },
      as24OfferId: { type: ['string', 'null'] },
      vehicleLabel: { type: ['string', 'null'] },
      paymentType: {
        type: ['string', 'null'],
        enum: ['leasing', 'financing', 'cash', null],
      },
      termMonths: { type: ['number', 'null'] },
      annualMileage: { type: ['number', 'null'] },
      openQuestions: {
        type: 'array',
        items: { type: 'string' },
      },
      transcript: { type: 'string' },
      confidence: { type: 'number' },
    },
  },
};

export const SCREENSHOT_VISION_INSTRUCTIONS = [
  'Du liest Screenshots von Autohaus-Anfragen (WhatsApp, AutoScout24, Mail-Apps).',
  'Liefere ausschließlich das JSON laut Schema.',
  'Erfinde nichts. Wenn unsicher: null / leeres Array.',
  'sourceKind=whatsapp_screenshot wenn WhatsApp-UI erkennbar, sonst screenshot oder photo.',
  'as24OfferId nur bei klarer AutoScout24-Angebotsnummer.',
  'openQuestions: offene Verkäufer-Fragen aus dem Chat (z.B. „KM?“).',
  'transcript: kurzer lesbarer Text der relevanten Chat-/Preview-Zeilen (ohne Bildbeschreibung).',
  'Keine IBAN, Ausweis, Adresse, Gehalt.',
].join('\n');
