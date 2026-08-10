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
  const tradeIn = [];
  const budget = [];
  const notes = [];

  const kids = lower.match(/(\d|zwei|drei)\s*kinder?/);
  if (kids) {
    const n = /zwei/.test(kids[0]) ? 2 : /drei/.test(kids[0]) ? 3 : Number(kids[1]);
    human.push(`${n} Kinder`);
  }
  if (/\bhund\b/.test(lower)) human.push('1 Hund');
  if (/\bkatze\b/.test(lower)) human.push('1 Katze');

  if (/\bsmart\s+fortwo\b/.test(lower)) tradeIn.push('Smart fortwo');
  else if (/\bfortwo\b/.test(lower)) tradeIn.push('Smart fortwo');

  const rate = lower.match(/wunschrate\s*(?:ca\.?\s*)?(\d{2,4})|(\d{2,4})\s*(?:€|euro)?\s*wunschrate/);
  if (rate) budget.push(`${rate[1] || rate[2]} € Wunschrate`);
  const az = lower.match(/anzahlung\s*(?:von\s*)?(\d{1,3}(?:[.\s]?\d{3})|\d{3,5})|(\d{1,3}(?:[.\s]?\d{3})|\d{3,5})\s*(?:€|euro)?\s*(?:az|anzahlung)/);
  if (az) {
    const n = Number(String(az[1] || az[2]).replace(/[.\s]/g, ''));
    if (Number.isFinite(n)) budget.push(`${n.toLocaleString('de-DE')} € AZ`);
  }

  if (/\b(eq2|ev2)\b/.test(lower)) vehicle.push('Kia EV2');
  if (/\b(blau|weiss|weiß|schwarz|grau|rot|grün|gruen)\b/.test(lower)) {
    const color = lower.match(/\b(blau|weiss|weiß|schwarz|grau|rot|grün|gruen)\b/)?.[1];
    if (color) vehicle.push(`${color.charAt(0).toUpperCase()}${color.slice(1)}`);
  }
  if (/automatik/.test(lower)) vehicle.push('Automatik');

  if (/ladezeit|laden|reichweite|wltp/.test(lower)) criteria.push('Ladezeit / Laden wichtig');
  if (/preis|budget|günstig|guenstig/.test(lower)) criteria.push('Preis wichtig');
  if (/sofort|dringend|eilig|verfügbar|verfuegbar/.test(lower)) criteria.push('sofort verfügbar');

  const structured = [...human, ...tradeIn, ...budget, ...vehicle, ...criteria];
  // Zero-Loss: Rest der Eingabe als Notiz, wenn nicht alles strukturiert wurde
  if (!structured.length && raw) {
    notes.push(raw.slice(0, 160));
  } else if (raw.length > 40 && structured.length < 2) {
    notes.push(raw.slice(0, 160));
  }

  return {
    human,
    vehicle,
    criteria,
    tradeIn,
    budget,
    notes,
    labels: [...structured, ...notes],
  };
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
  if (cats.human.length) groups.push({ id: 'persoenliches', title: 'Persönliches', items: cats.human });
  if (cats.tradeIn?.length) groups.push({ id: 'bestand', title: 'Bestandsfahrzeug', items: cats.tradeIn });
  if (cats.budget?.length) groups.push({ id: 'budget', title: 'Budget', items: cats.budget });
  if (cats.vehicle.length) groups.push({ id: 'fahrzeug', title: 'Fahrzeugwunsch', items: cats.vehicle });
  if (cats.criteria.length) groups.push({ id: 'kriterien', title: 'Ausstattung', items: cats.criteria });
  if (cats.notes?.length) {
    groups.push({
      id: 'sonstiges',
      title: 'Sonstiges',
      items: cats.notes.map((n) => `${n} · Noch nicht strukturiert`),
    });
  }

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
