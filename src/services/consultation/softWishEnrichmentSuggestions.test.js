/**
 * Soft Wish Enrichment – Vorschläge vor Identifikation.
 */
import assert from 'node:assert/strict';
import {
  buildSoftWishEnrichmentSuggestions,
  sanitizeSoftWishSuggestions,
} from './softWishEnrichmentSuggestions.js';
import {
  buildWishHandoffNotepadLabels,
  emptyWishHandoffEnrichment,
  mergeWishHandoffNotepadLabels,
} from './wishHandoffEnrichment.js';
import {
  buildHandoffCompleteView,
  buildPersonalHandoffView,
  validateHandoffForm,
} from './consultationOfferHandoff.js';
import { buildWishHandoffExitLabel } from './customerIntakeExits.js';

{
  const suggestions = buildSoftWishEnrichmentSuggestions({
    needProfile: { selectedModelKey: 'ev9', fuel: 'electric' },
    notepadLabels: ['EV9', 'Elektro', 'Finanzierung', '48 Monate'],
  });
  assert.ok(suggestions.length >= 4 && suggestions.length <= 6);
  assert.ok(!suggestions.some((s) => /finanzierung|48 monate/i.test(s.label)));
  assert.ok(suggestions.some((s) => /Head-up|Anhänger|Kofferraum|Sitz/i.test(s.label)));
  console.log('✓ Soft suggestions EV9 ohne Duplikate');
}

{
  const suggestions = buildSoftWishEnrichmentSuggestions({
    needProfile: { selectedModelKey: 'ev2' },
    notepadLabels: ['EV2', 'Elektro', 'Kleinwagen', 'Sitzheizung'],
  });
  assert.ok(!suggestions.some((s) => s.label === 'Sitzheizung'));
  console.log('✓ Bereits notierte Chips werden nicht erneut vorgeschlagen');
}

{
  const enrichment = emptyWishHandoffEnrichment();
  enrichment.equipmentWishIds = ['hud'];
  enrichment.softExtraLabels = ['Reichweite wichtig'];
  const labels = buildWishHandoffNotepadLabels(enrichment);
  assert.ok(labels.includes('Head-up-Display'));
  assert.ok(labels.includes('Reichweite wichtig'));

  const merged = mergeWishHandoffNotepadLabels(
    ['EV9 interessant'],
    enrichment,
  );
  assert.ok(merged.includes('EV9 interessant'));
  assert.ok(merged.includes('Head-up-Display'));
  console.log('✓ Auswahl → Notizzettel, Vorschlag ohne Auswahl nicht');
}

{
  const empty = emptyWishHandoffEnrichment();
  const merged = mergeWishHandoffNotepadLabels(['Finanzierung'], empty);
  assert.deepEqual(merged, ['Finanzierung']);
  console.log('✓ Soft Opt-in optional – keine Auswahl ändert Baseline nicht');
}

{
  const view = buildPersonalHandoffView({ notepadLabels: ['EV9'] }, { dealerName: 'Autohaus Trinkle' });
  assert.equal(view.title, 'Meine Wünsche weitergeben');
  assert.ok(!/Übergabe/.test(view.title));
  assert.ok(!/Übergabe/.test(view.privacyText || ''));
  assert.match(view.softHeadline, /Verkäufer noch etwas/);
  console.log('✓ Keine Kundenheadline „Übergabe“');
}

{
  const ok = validateHandoffForm({
    email: 'mike@example.de',
    privacyAccepted: true,
  });
  assert.equal(ok.valid, true);

  const missing = validateHandoffForm({ email: '', privacyAccepted: true });
  assert.equal(missing.valid, false);
  assert.ok(missing.errors.email);
  console.log('✓ E-Mail ist Pflicht, Name nicht');
}

{
  const complete = buildHandoffCompleteView(
    { email: 'mike@example.de' },
    { dealerName: 'Autohaus Trinkle', contact: { name: 'Max Trinkle' } },
    {},
    { notepadLabels: ['Finanzierung', 'Head-up-Display', 'Sitzheizung'] },
  );
  assert.match(complete.title, /Wünsche sind angekommen/);
  assert.ok(complete.wishLabels.includes('Head-up-Display'));
  assert.ok(complete.returnActions.some((a) => /ergänzen/i.test(a.label)));
  console.log('✓ Erfolgsscreen mit Kundenwünschen');
}

{
  assert.equal(buildWishHandoffExitLabel({ notepadLabels: [] }), 'Meine Wünsche weitergeben');
  console.log('✓ CTA „Meine Wünsche weitergeben“');
}

{
  const sanitized = sanitizeSoftWishSuggestions(
    [{ id: 'x', label: 'Sitzheizung' }, { id: 'y', label: 'Head-up-Display' }],
    { notepadLabels: ['Sitzheizung'], needProfile: { selectedModelKey: 'ev9' } },
  );
  assert.ok(!sanitized.some((s) => s.label === 'Sitzheizung'));
  assert.ok(sanitized.some((s) => s.label === 'Head-up-Display'));
  console.log('✓ AI-Suggestions werden gefiltert, nicht auto-gespeichert');
}

console.log('\nAlle Soft-Wish-Enrichment-Tests bestanden.');
