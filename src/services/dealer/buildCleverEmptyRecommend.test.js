import assert from 'node:assert/strict';
import { buildCleverEmptyRecommend } from './buildCleverEmptyRecommend.js';

const withPhone = {
  name: 'Aalen',
  contact: { phone: '+491234' },
  wish: { model: 'EV3 Air' },
};

{
  const idle = buildCleverEmptyRecommend(withPhone, {
    hintLabels: ['braucht Auto sofort', 'Unfall / Ersatzfahrzeug', 'Elektro'],
  });
  assert.equal(idle.mode, 'recommend');
  assert.ok(!/wartet auf/i.test(idle.summary), 'kein generischer Idle');
  assert.equal(idle.actions.length, 1);
  assert.equal(idle.actions[0].action, 'prepare_offer');
  assert.ok(/sofort/i.test(idle.summary));
  console.log('✓ contextual offer next step');
}

{
  const noPhone = buildCleverEmptyRecommend(
    { name: 'Aalen', contact: {} },
    { hintLabels: ['Sofort'] },
  );
  assert.equal(noPhone.actions[0].action, 'open_contact');
  console.log('✓ phone missing → contact');
}

{
  const withOffer = buildCleverEmptyRecommend(withPhone, {
    workingContextItems: [{ kind: 'offer', label: 'EV3 Angebot', card: { monthlyRate: 299 } }],
  });
  assert.equal(withOffer.actions[0].action, 'check_offer');
  assert.equal(withOffer.suggestions.length, 0);
  console.log('✓ prepared offer → check');
}

{
  const bare = buildCleverEmptyRecommend(withPhone);
  assert.equal(bare.mode, 'recommend');
  assert.ok(bare.actions.length === 1);
  assert.ok(!bare.suggestions?.length);
  console.log('✓ always single recommend action');
}

console.log('buildCleverEmptyRecommend ok');
