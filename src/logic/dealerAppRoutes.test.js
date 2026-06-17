import assert from 'node:assert/strict';
import { getSiteFooterVariant, isDealerAppRoute } from './dealerAppRoutes.js';

assert.equal(isDealerAppRoute('/backend'), true);
assert.equal(isDealerAppRoute('/backend/neue-anfragen'), true);
assert.equal(isDealerAppRoute('/backend/kundenakte/lead-1'), true);
assert.equal(isDealerAppRoute('/verkaufsassistent'), true);
assert.equal(isDealerAppRoute('/dealer-ai'), true);
assert.equal(isDealerAppRoute('/communication'), true);
assert.equal(isDealerAppRoute('/backend/verkaufschancen'), true);

assert.equal(isDealerAppRoute('/'), false);
assert.equal(isDealerAppRoute('/haendler/autohaus-trinkle'), false);
assert.equal(isDealerAppRoute('/customer/self-disclosure/abc'), false);
assert.equal(isDealerAppRoute('/mein-bereich'), false);
assert.equal(isDealerAppRoute('/angebot/REF-1'), false);
assert.equal(isDealerAppRoute('/legal/impressum'), false);

assert.equal(getSiteFooterVariant('/verkaufsassistent'), 'minimal');
assert.equal(getSiteFooterVariant('/fahrzeuge'), 'full');

console.log('dealerAppRoutes.test.js: ok');
