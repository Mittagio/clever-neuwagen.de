/**
 * node src/services/consultation/priceListBrowsingService.test.js
 */
import assert from 'node:assert/strict';
import {
  PRICE_LIST_FOLLOW_UP_QUESTION_ID,
  PRICE_LIST_FOLLOW_UP_STATUS,
  PRICE_LIST_VIEWED_TYPE,
  appendPriceListFollowUpIfNeeded,
  buildPriceListActivityLines,
  customerMessageForPriceListFollowUpAnswer,
  markPriceListFollowUpResolved,
  recordPriceListViewed,
  resolveVerifiedPriceListDocument,
  shouldOfferPriceListFollowUp,
} from './priceListBrowsingService.js';
import { createHappyPathSession } from './consultationHappyPath.js';
import { buildBundledNotepadItems } from './notepadChipBundling.js';
import { buildVehicleModelCard } from './vehicleModelCardPresentation.js';

{
  const doc = resolveVerifiedPriceListDocument('pv5-passenger');
  assert.ok(doc, 'PV5 Preisliste muss auflösbar sein');
  assert.equal(doc.documentType, 'price_list');
  assert.equal(doc.market, 'DE');
  assert.equal(doc.verificationStatus, 'verified');
  assert.match(doc.sourceUrl, /^https:\/\/www\.kia\.com\/.*Preisliste/i);
  assert.ok(doc.standLabel, 'Dokumentstand aus Import');
  console.log('✓ PV5 verifizierte Preisliste');
}

{
  const doc = resolveVerifiedPriceListDocument('ev3');
  assert.ok(doc?.sourceUrl);
  assert.match(doc.sourceTitle, /EV3/i);
  console.log('✓ EV3 Preisliste');
}

{
  let session = createHappyPathSession('Autohaus Trinkle');
  const beforeLabels = [...(session.notepadLabels ?? [])];
  session = recordPriceListViewed(session, { modelKey: 'pv5-passenger' });

  assert.equal(session.notepadLabels?.length ?? 0, beforeLabels.length);
  assert.ok(!JSON.stringify(session.needProfile).includes('price_list'));
  const views = session.conversationSignals?.priceList?.views ?? [];
  assert.equal(views.length, 1);
  assert.equal(views[0].type, PRICE_LIST_VIEWED_TYPE);
  assert.equal(views[0].modelKey, 'pv5-passenger');
  assert.equal(
    session.conversationSignals.priceList.followUpStatus,
    PRICE_LIST_FOLLOW_UP_STATUS.PENDING,
  );

  const items = buildBundledNotepadItems(session.notepadLabels ?? []);
  assert.ok(!items.some((i) => /Preisliste/i.test(i.label ?? i.title ?? '')));
  console.log('✓ Öffnen → Activity, kein Kundenwunsch');
}

{
  let session = createHappyPathSession('Autohaus Trinkle');
  session = recordPriceListViewed(session, { modelKey: 'ev9' });
  assert.equal(shouldOfferPriceListFollowUp(session), true);

  session = appendPriceListFollowUpIfNeeded(session);
  assert.equal(
    session.conversationSignals.priceList.followUpStatus,
    PRICE_LIST_FOLLOW_UP_STATUS.SHOWN,
  );
  const turn = session.turns.find((t) => t.questionId === PRICE_LIST_FOLLOW_UP_QUESTION_ID);
  assert.ok(turn);
  assert.match(turn.text, /Preisliste/i);
  assert.ok(turn.options?.some((o) => o.id === 'nothing'));
  assert.ok((turn.nextTopics?.length ?? 0) >= 3);

  // kein zweiter Follow-up
  const again = appendPriceListFollowUpIfNeeded(session);
  assert.equal(
    again.turns.filter((t) => t.questionId === PRICE_LIST_FOLLOW_UP_QUESTION_ID).length,
    1,
  );
  console.log('✓ einmaliger Follow-up nach Rückkehr');
}

{
  let session = createHappyPathSession('Autohaus Trinkle');
  session = recordPriceListViewed(session, { modelKey: 'ev3' });
  session = appendPriceListFollowUpIfNeeded(session);
  session = markPriceListFollowUpResolved(session);
  assert.equal(
    session.conversationSignals.priceList.followUpStatus,
    PRICE_LIST_FOLLOW_UP_STATUS.RESOLVED,
  );
  assert.equal(shouldOfferPriceListFollowUp(session), false);

  // erneut öffnen erzeugt keinen neuen Zwang
  session = recordPriceListViewed(session, { modelKey: 'ev3' });
  assert.equal(
    session.conversationSignals.priceList.followUpStatus,
    PRICE_LIST_FOLLOW_UP_STATUS.RESOLVED,
  );
  assert.equal(shouldOfferPriceListFollowUp(session), false);

  const nothing = customerMessageForPriceListFollowUpAnswer('nothing');
  assert.match(nothing, /nichts Besonderes/i);
  console.log('✓ Nichts Besonderes / kein Follow-up-Loop');
}

{
  const card = buildVehicleModelCard('pv5-passenger', {});
  assert.ok(card.priceList?.sourceUrl, 'Kachel trägt Preisliste-Link');
  assert.ok(!/Preisliste angesehen/i.test(JSON.stringify(card)));
  console.log('✓ Kachel mit Preisliste-Link');
}

{
  let session = createHappyPathSession('Autohaus Trinkle');
  session = recordPriceListViewed(session, { modelKey: 'pv5-passenger' });
  session = {
    ...session,
    notepadLabels: ['PV5 interessant', 'Sitzheizung'],
  };
  const activities = buildPriceListActivityLines(session);
  assert.ok(activities.some((l) => /PV5/i.test(l) && /angesehen/i.test(l)));
  assert.ok(!activities.some((l) => /Sitzheizung/i.test(l)));
  assert.ok(session.notepadLabels.includes('Sitzheizung'));
  assert.ok(!session.notepadLabels.some((l) => /Preisliste/i.test(l)));
  console.log('✓ Activity getrennt von Wünschen');
}

console.log('\npriceListBrowsingService.test.js: ok');
