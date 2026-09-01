import assert from 'node:assert/strict';
import {
  CONTACT_KIND,
  buildContactPayloadFromIdentity,
  composeContactDisplayName,
  deriveContactIdentity,
} from './customerContactIdentity.js';

{
  const id = deriveContactIdentity({ name: 'Herr Max Müller' });
  assert.equal(id.kind, CONTACT_KIND.PRIVATE);
  assert.equal(id.salutation, 'Herr');
  assert.equal(id.firstName, 'Max');
  assert.equal(id.lastName, 'Müller');
  console.log('✓ private split with salutation');
}

{
  const id = deriveContactIdentity({
    kind: 'business',
    companyName: 'Müller GmbH',
    firstName: 'Anna',
    lastName: 'Schmidt',
    salutation: 'Frau',
  });
  assert.equal(id.kind, CONTACT_KIND.BUSINESS);
  assert.equal(composeContactDisplayName(id), 'Müller GmbH (Anna Schmidt)');
  const payload = buildContactPayloadFromIdentity(id, { phone: '0170' });
  assert.equal(payload.companyName, 'Müller GmbH');
  assert.equal(payload.kind, CONTACT_KIND.BUSINESS);
  assert.equal(payload.phone, '0170');
  console.log('✓ business compose + payload');
}

{
  const id = deriveContactIdentity({ name: 'Autohaus Trinkle GmbH' });
  assert.equal(id.kind, CONTACT_KIND.BUSINESS);
  assert.equal(id.companyName, 'Autohaus Trinkle GmbH');
  console.log('✓ company heuristic');
}

{
  // kind:private ohne first/last darf contact.name nicht verwerfen
  const id = deriveContactIdentity(
    { kind: 'private', name: 'Cederic König' },
    'Cederic König',
  );
  assert.equal(id.kind, CONTACT_KIND.PRIVATE);
  assert.equal(id.firstName, 'Cederic');
  assert.equal(id.lastName, 'König');
  assert.equal(composeContactDisplayName(id), 'Cederic König');
  console.log('✓ kind-only contact keeps display name');
}

console.log('customerContactIdentity ok');
