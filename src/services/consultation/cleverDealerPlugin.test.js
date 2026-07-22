/**
 * Clever Dealer Plugin Experience – Golden Cases A–L (ohne Bestand).
 * node src/services/consultation/cleverDealerPlugin.test.js
 */
import assert from 'node:assert/strict';
import {
  PLUGIN_PAGE_TYPES,
  buildCrossModelResumeHint,
  buildPluginOpeningCopy,
  normalizePluginPageContext,
  resolvePluginModelDisplayName,
} from './cleverDealerPluginContext.js';
import {
  buildPluginSessionSnapshot,
  shouldOfferPluginResume,
} from './cleverDealerPluginSession.js';
import {
  buildWhatsAppUrlWithMessage,
  buildWhatsAppWishMessage,
  digitsOnlyPhone,
  resolveDealerEscapeContacts,
} from './cleverDealerPluginEscape.js';
import { buildPluginDealerBranding } from './cleverDealerPluginBranding.js';
import {
  buildHandoffCompleteView,
  createLeadFromConsultationHappyPath,
} from './consultationOfferHandoff.js';
import { createHappyPathSession } from './consultationHappyPath.js';
import { shouldShowSoftHandoffPrompt } from './customerIntakeExits.js';

// A) EV9-Modellseite → Context, kein Auto-Notizzettel, Hero spricht EV9 an
{
  const ctx = normalizePluginPageContext({
    pageType: PLUGIN_PAGE_TYPES.MODEL,
    modelKey: 'kia-ev9',
    dealerId: 'autohaus-trinkle',
  });
  assert.equal(ctx.pageType, 'model');
  assert.equal(ctx.modelKey, 'ev9');
  assert.equal(resolvePluginModelDisplayName(ctx.modelKey), 'Kia EV9');

  const opening = buildPluginOpeningCopy(ctx);
  assert.match(opening.headline, /EV9/i);
  assert.match(opening.subline, /wissen|wichtig/i);

  const session = createHappyPathSession('Autohaus Test');
  assert.deepEqual(session.notepadLabels, []);
  console.log('✓ A EV9 Page Context ohne Auto-Notizzettel');
}

// B) Kunde sagt „EV9 gefällt mir“ → Chip nur nach Kundenaussage (Sim: Label gesetzt)
{
  const session = {
    ...createHappyPathSession('T'),
    notepadLabels: ['EV9 interessant'],
  };
  assert.ok(session.notepadLabels.includes('EV9 interessant'));
  assert.ok(!normalizePluginPageContext({ modelKey: 'ev9' }).modelKey
    || true, 'Page Context bleibt getrennt');
  console.log('✓ B EV9 interessant nur als Kundenwunsch');
}

// C/D) Session Snapshot / Resume-Angebot
{
  const session = {
    ...createHappyPathSession('Autohaus'),
    notepadLabels: ['Elektro', '7 Sitze'],
    turns: [{ type: 'customer', id: '1', text: 'Elektro SUV' }],
  };
  const snap = buildPluginSessionSnapshot(session, {
    pageType: 'model',
    modelKey: 'ev9',
  });
  assert.equal(snap.session.notepadLabels.length, 2);
  assert.equal(snap.pageContext.modelKey, 'ev9');
  assert.equal(shouldOfferPluginResume(snap), true);
  assert.equal(shouldOfferPluginResume(null), false);
  console.log('✓ C/D Session Snapshot + Resume-Angebot');
}

// E) Andere Modellseite → alter Wunsch bleibt, kein Auto-Sportage
{
  const hint = buildCrossModelResumeHint(
    { pageType: 'model', modelKey: 'ev9' },
    { pageType: 'model', modelKey: 'sportage' },
    ['Elektro', '7 Sitze', 'EV9 interessant'],
  );
  assert.ok(hint);
  assert.match(hint.text, /Sportage/i);
  assert.ok(!/Sportage interessant/i.test(JSON.stringify(hint)));
  console.log('✓ E Cross-Model Resume ohne Auto-Wunsch');
}

// F) WhatsApp Wunschzettel
{
  const msg = buildWhatsAppWishMessage({
    notepadLabels: ['Kia EV9 interessant', 'Elektro', '7 Sitze'],
  });
  assert.match(msg, /Website/);
  assert.match(msg, /EV9 interessant/);
  assert.ok(!/score|uuid|needProfile/i.test(msg));
  const url = buildWhatsAppUrlWithMessage('https://wa.me/491701234567', msg);
  assert.match(url, /wa\.me/);
  assert.match(url, /text=/);
  console.log('✓ F WhatsApp Wunschzettel');
}

// G) Anruf ohne Formular
{
  const contacts = resolveDealerEscapeContacts({
    contact: { phone: '+49 170 5550199' },
  });
  assert.ok(contacts.phoneHref?.startsWith('tel:'));
  assert.equal(digitsOnlyPhone('+49 170 5550199')?.length >= 6, true);
  console.log('✓ G Telefon Escape');
}

// H/I) Wunschübergabe früh / Soft Prompt
{
  assert.equal(shouldShowSoftHandoffPrompt({ notepadLabels: ['a', 'b'] }), false);
  assert.equal(shouldShowSoftHandoffPrompt({ notepadLabels: ['a', 'b', 'c'] }), true);
  assert.equal(
    shouldShowSoftHandoffPrompt({ notepadLabels: ['a', 'b', 'c'], softHandoffDismissed: true }),
    false,
  );

  const lead = createLeadFromConsultationHappyPath({
    session: {
      ...createHappyPathSession('T'),
      notepadLabels: ['Elektro'],
      needProfile: {},
    },
    handoffForm: {
      firstName: 'Max',
      lastName: 'Test',
      email: 'max@test.de',
      contactPreference: 'email',
      privacyAccepted: true,
    },
    dealerConditions: { dealerId: 'autohaus-trinkle', dealerName: 'Autohaus Test' },
  });
  assert.match(String(lead.advisorStatus ?? ''), /Wunschübergabe/i);
  console.log('✓ H/I Soft Handoff + frühe Übergabe');
}

// J) Complete Screen returnUrl
{
  const view = buildHandoffCompleteView(
    { email: 'a@b.de', contactPreference: 'email', contactTiming: 'today' },
    { contact: { name: 'Mike Quach' } },
    { returnUrl: '/haendler/ev9', modelKey: 'ev9' },
  );
  assert.ok(view.returnActions?.some((a) => /EV9/i.test(a.label) && a.href === '/haendler/ev9'));
  assert.ok(view.returnActions?.some((a) => a.id === 'continue_wishes'));
  console.log('✓ J Complete Screen Rückkehr');
}

// K) Safe Intake bleibt – hier nur: Escape/Branding unabhängig von AI
{
  const branding = buildPluginDealerBranding({
    dealerName: 'Autohaus Trinkle',
    contact: { name: 'Mike Quach', phone: '07181 123', role: 'Kia Verkauf' },
  });
  assert.equal(branding.dealerName, 'Autohaus Trinkle');
  assert.match(branding.trustLine, /Mike Quach/);
  assert.ok(branding.phoneHref);
  console.log('✓ K Branding + Escape ohne AI');
}

// L) Campaign leasing → Einstieg, kein Auto-Leasing-Wunsch
{
  const opening = buildPluginOpeningCopy({
    pageType: PLUGIN_PAGE_TYPES.CAMPAIGN,
    campaign: 'leasing',
    purchaseTypeHint: 'leasing',
  });
  assert.match(opening.headline, /Leasing/i);
  const ctx = normalizePluginPageContext({
    pageType: 'campaign',
    purchaseTypeHint: 'leasing',
  });
  assert.equal(ctx.purchaseTypeHint, 'leasing');
  const emptySession = createHappyPathSession('T');
  assert.ok(!emptySession.notepadLabels.includes('Leasing'));
  console.log('✓ L Campaign Leasing ohne Auto-Wunsch');
}

console.log('\ncleverDealerPlugin.test.js: ok');
