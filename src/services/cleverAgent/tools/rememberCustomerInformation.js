/**
 * Tool: remember_customer_information – WRITE (sofort speichern + Undo-fähig)
 */
import { appendSellerInsightsFromTexts } from '../../dealer/sellerInsights.js';

function categorizeRememberLines(text = '') {
  const raw = String(text || '').trim();
  const lower = raw.toLowerCase();
  const human = [];
  const vehicle = [];
  const criteria = [];

  const kids = lower.match(/(\d|zwei|drei)\s*kinder?/);
  if (kids) {
    const n = /zwei/.test(kids[0]) ? 2 : /drei/.test(kids[0]) ? 3 : Number(kids[1]);
    human.push(`${n} Kinder`);
  }
  if (/\bhund\b/.test(lower)) human.push('Hund');
  if (/\bkatze\b/.test(lower)) human.push('Katze');

  if (/\b(blau|weiss|weiß|schwarz|grau|rot|grün|gruen)\b/.test(lower)) {
    const color = lower.match(/\b(blau|weiss|weiß|schwarz|grau|rot|grün|gruen)\b/)?.[1];
    if (color) vehicle.push(`${color.charAt(0).toUpperCase()}${color.slice(1)} bevorzugt`);
  }
  if (/automatik/.test(lower)) vehicle.push('Automatik');

  if (/ladezeit|laden|reichweite|wltp/.test(lower)) criteria.push('Ladezeit / Laden wichtig');
  if (/preis|budget|günstig|guenstig/.test(lower)) criteria.push('Preis wichtig');
  if (/sofort|dringend|eilig/.test(lower)) criteria.push('braucht Auto sofort');

  // Fallback: ganze Zeile als Insight wenn nichts strukturiert
  const structured = [...human, ...vehicle, ...criteria];
  if (!structured.length && raw) structured.push(raw.slice(0, 160));

  return { human, vehicle, criteria, labels: structured };
}

export const rememberCustomerInformationToolDef = {
  name: 'remember_customer_information',
  kind: 'write',
  description:
    'Merkt sich Kundenwissen (Kinder, Hund, Farbe, Kaufkriterien). '
    + 'Keine Kundennachricht, kein Angebot. Sofort speichern mit Undo.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    required: ['note'],
    properties: {
      note: {
        type: 'string',
        description: 'Was gemerkt werden soll, z. B. „2 Kinder Hund blau Ladezeit wichtig“',
      },
    },
  },
};

export function executeRememberCustomerInformation(runtime = {}, args = {}) {
  const lead = runtime.lead || {};
  const note = String(args.note || runtime.sellerMessage || '').trim();
  if (!note) {
    return { ok: false, error: 'missing_note', message: 'Was soll ich merken?' };
  }

  const cats = categorizeRememberLines(note);
  const nextLead = appendSellerInsightsFromTexts(lead, cats.labels, {
    context: 'note',
  });

  const groups = [];
  if (cats.human.length) groups.push({ id: 'mensch', title: 'Mensch & Alltag', items: cats.human });
  if (cats.vehicle.length) groups.push({ id: 'fahrzeug', title: 'Fahrzeugpräferenz', items: cats.vehicle });
  if (cats.criteria.length) groups.push({ id: 'kriterien', title: 'Kaufkriterium', items: cats.criteria });

  return {
    ok: true,
    status: 'saved_with_undo',
    confirmationRequired: false,
    labels: cats.labels,
    groups,
    mutations: [
      {
        type: 'apply_lead_patch',
        leadPatch: {
          crm: nextLead.crm,
          updatedAt: nextLead.updatedAt,
        },
      },
    ],
    artifacts: [
      {
        type: 'remember',
        label: 'Gemerkt',
        data: { labels: cats.labels, groups },
      },
    ],
    suggestedActions: [
      { action: 'undo_remember', label: 'Rückgängig' },
    ],
    message: `Gemerkt: ${cats.labels.join(' · ')}`,
  };
}
