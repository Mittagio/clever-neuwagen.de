/**
 * WhatsApp-taugliche Textvorlagen für Journey/Reminder-Fälle.
 */
import { buildCleverGreeting } from '../cleverAntworten.js';

export const MESSAGE_TEMPLATE_IDS = {
  OFFER_FOLLOWUP: 'offer_followup',
  OFFER_OPENED: 'offer_opened',
  DOCUMENTS_MISSING: 'documents_missing',
  SELF_DISCLOSURE_REMINDER: 'self_disclosure_reminder',
  TEST_DRIVE_PLAN: 'test_drive_plan',
  VEHICLE_AVAILABLE: 'vehicle_available',
  LEASING_EXPIRING: 'leasing_expiring',
  AFTERCARE: 'aftercare',
  GENERAL_FOLLOWUP: 'general_followup',
};

export const MESSAGE_TEMPLATE_LABELS = {
  [MESSAGE_TEMPLATE_IDS.OFFER_FOLLOWUP]: 'Angebot nachfassen',
  [MESSAGE_TEMPLATE_IDS.OFFER_OPENED]: 'Angebot geöffnet – nachfragen',
  [MESSAGE_TEMPLATE_IDS.DOCUMENTS_MISSING]: 'Unterlagen anfordern',
  [MESSAGE_TEMPLATE_IDS.SELF_DISCLOSURE_REMINDER]: 'Selbstauskunft erinnern',
  [MESSAGE_TEMPLATE_IDS.TEST_DRIVE_PLAN]: 'Probefahrt planen',
  [MESSAGE_TEMPLATE_IDS.VEHICLE_AVAILABLE]: 'Fahrzeug verfügbar',
  [MESSAGE_TEMPLATE_IDS.LEASING_EXPIRING]: 'Leasing läuft aus',
  [MESSAGE_TEMPLATE_IDS.AFTERCARE]: 'Nachbetreuung',
  [MESSAGE_TEMPLATE_IDS.GENERAL_FOLLOWUP]: 'Freundlich nachfassen',
};

function closing(ctx) {
  const seller = ctx.sellerName?.trim();
  if (!seller || seller === 'Ihr Verkaufsteam') return '\n\nViele Grüße';
  return `\n\nViele Grüße\n${seller}`;
}

function vehicleLabel(ctx) {
  return ctx.vehicleTitle || 'Ihr Wunschfahrzeug';
}

function appendPortalHint(ctx, lines) {
  if (ctx.portalUrl) {
    lines.push('', `Ihre persönliche Auswahl: ${ctx.portalUrl}`);
    if (ctx.portalCodeHint) lines.push(ctx.portalCodeHint);
  }
}

function offerFollowup(ctx) {
  const vehicle = vehicleLabel(ctx);
  const lines = [buildCleverGreeting(ctx.customerName, ctx.salutation), ''];

  if (ctx.offerOpened) {
    lines.push(
      `ich wollte kurz nachfragen, ob das Angebot zum ${vehicle} grundsätzlich in die richtige Richtung geht. Wenn Sie möchten, kann ich Ihnen gerne noch eine zweite Variante mit weniger Anzahlung vorbereiten.`,
    );
  } else if (ctx.offerSent) {
    lines.push(
      `ich wollte kurz nachfragen, ob mein Angebot zum ${vehicle} bei Ihnen angekommen ist und ob die Richtung grundsätzlich passt.`,
    );
    if (ctx.offerUrl) lines.push('', `Zum Angebot: ${ctx.offerUrl}`);
  } else {
    lines.push(
      `ich wollte kurz nachfragen, ob Sie noch Fragen zum ${vehicle} haben oder ob ich noch etwas anpassen darf.`,
    );
  }

  if (ctx.priceLine) lines.push('', `Aktuelle Kondition: ${ctx.priceLine}`);
  appendPortalHint(ctx, lines);
  lines.push(closing(ctx));
  return lines.join('\n').trim();
}

function offerOpened(ctx) {
  const vehicle = vehicleLabel(ctx);
  const lines = [
    buildCleverGreeting(ctx.customerName, ctx.salutation),
    '',
    `ich habe gesehen, dass Sie sich das Angebot zum ${vehicle} angeschaut haben. Passt das grundsätzlich für Sie – oder soll ich Ihnen gerne noch eine Variante mit anderen Konditionen vorbereiten?`,
  ];
  if (ctx.offerUrl) lines.push('', `Hier nochmal der Link: ${ctx.offerUrl}`);
  appendPortalHint(ctx, lines);
  lines.push(closing(ctx));
  return lines.join('\n').trim();
}

function documentsMissing(ctx) {
  const vehicle = vehicleLabel(ctx);
  const lines = [
    buildCleverGreeting(ctx.customerName, ctx.salutation),
    '',
    `damit wir mit dem ${vehicle} zügig weitermachen können, fehlen noch ein paar Unterlagen von Ihnen.`,
  ];
  if (ctx.unterlagenUrl) {
    lines.push('', `Sie können alles bequem hier hochladen: ${ctx.unterlagenUrl}`);
  } else {
    lines.push('', 'Ich sende Ihnen gleich den Link zum Upload – das geht schnell und unkompliziert.');
  }
  lines.push(closing(ctx));
  return lines.join('\n').trim();
}

function selfDisclosureReminder(ctx) {
  const lines = [
    buildCleverGreeting(ctx.customerName, ctx.salutation),
    '',
    'Sie haben die Selbstauskunft bereits begonnen – super. Wenn Sie möchten, können Sie sie in wenigen Minuten fertigstellen, dann können wir direkt weitermachen.',
  ];
  if (ctx.unterlagenUrl) lines.push('', ctx.unterlagenUrl);
  lines.push(closing(ctx));
  return lines.join('\n').trim();
}

function testDrivePlan(ctx) {
  const vehicle = vehicleLabel(ctx);
  const lines = [
    buildCleverGreeting(ctx.customerName, ctx.salutation),
    '',
    `gerne vereinbaren wir eine Probefahrt mit dem ${vehicle}. Wann würde es Ihnen zeitlich passen – eher vormittags oder nachmittags?`,
  ];
  lines.push(closing(ctx));
  return lines.join('\n').trim();
}

function vehicleAvailable(ctx) {
  const vehicle = vehicleLabel(ctx);
  const status = ctx.vehicleFulfillmentStatus;
  const intro = status === 'delivery_ready'
    ? `gute Nachrichten: Ihr ${vehicle} ist bereit und wir können die Übergabe planen.`
    : `gute Nachrichten: Ihr ${vehicle} ist unterwegs bzw. bald verfügbar.`;

  const lines = [
    buildCleverGreeting(ctx.customerName, ctx.salutation),
    '',
    `${intro} Wann passt es Ihnen für ein kurzes Gespräch oder einen Termin?`,
  ];
  lines.push(closing(ctx));
  return lines.join('\n').trim();
}

function leasingExpiring(ctx) {
  const endHint = ctx.leasingEndDate ? ` (Ihr Leasingende: ${ctx.leasingEndDate})` : '';
  const lines = [
    buildCleverGreeting(ctx.customerName, ctx.salutation),
    '',
    `Ihr Leasing läuft demnächst aus${endHint}. Wenn Sie möchten, schaue ich mir gerne frühzeitig passende Anschluss- oder Wechseloptionen mit Ihnen an.`,
  ];
  lines.push(closing(ctx));
  return lines.join('\n').trim();
}

function aftercare(ctx) {
  const vehicle = vehicleLabel(ctx);
  const lines = [
    buildCleverGreeting(ctx.customerName, ctx.salutation),
    '',
    `ich hoffe, Sie sind mit Ihrem ${vehicle} zufrieden. Wenn Sie Fragen haben oder wir kurz nachhören sollen, melden Sie sich gern – ich bin für Sie da.`,
  ];
  lines.push(closing(ctx));
  return lines.join('\n').trim();
}

function generalFollowup(ctx) {
  const vehicle = vehicleLabel(ctx);
  const lines = [
    buildCleverGreeting(ctx.customerName, ctx.salutation),
    '',
    `ich wollte mich kurz melden bezüglich ${vehicle}. Haben Sie noch Fragen oder soll ich etwas für Sie vorbereiten?`,
  ];
  appendPortalHint(ctx, lines);
  lines.push(closing(ctx));
  return lines.join('\n').trim();
}

const TEMPLATE_RENDERERS = {
  [MESSAGE_TEMPLATE_IDS.OFFER_FOLLOWUP]: offerFollowup,
  [MESSAGE_TEMPLATE_IDS.OFFER_OPENED]: offerOpened,
  [MESSAGE_TEMPLATE_IDS.DOCUMENTS_MISSING]: documentsMissing,
  [MESSAGE_TEMPLATE_IDS.SELF_DISCLOSURE_REMINDER]: selfDisclosureReminder,
  [MESSAGE_TEMPLATE_IDS.TEST_DRIVE_PLAN]: testDrivePlan,
  [MESSAGE_TEMPLATE_IDS.VEHICLE_AVAILABLE]: vehicleAvailable,
  [MESSAGE_TEMPLATE_IDS.LEASING_EXPIRING]: leasingExpiring,
  [MESSAGE_TEMPLATE_IDS.AFTERCARE]: aftercare,
  [MESSAGE_TEMPLATE_IDS.GENERAL_FOLLOWUP]: generalFollowup,
};

export function renderCleverMessageTemplate(ctx = {}, templateId = MESSAGE_TEMPLATE_IDS.GENERAL_FOLLOWUP) {
  const renderer = TEMPLATE_RENDERERS[templateId] ?? TEMPLATE_RENDERERS[MESSAGE_TEMPLATE_IDS.GENERAL_FOLLOWUP];
  return renderer(ctx);
}

export function buildMessagePreview(text = '', maxLength = 150) {
  const flat = String(text).replace(/\s+/g, ' ').trim();
  if (flat.length <= maxLength) return flat;
  return `${flat.slice(0, maxLength - 1)}…`;
}
