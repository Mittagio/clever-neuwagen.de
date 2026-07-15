#!/usr/bin/env node
/**
 * Optionaler manueller Eval-Runner – nur mit OPENAI_API_KEY, nicht für CI.
 */
import '../server/loadEnv.js';
import { runCleverTurn } from '../src/services/clever/openai/runCleverTurn.js';
import { mergeTextIntoNeedProfile } from '../src/services/consultation/needProfileService.js';
import { ALL_GOLDEN_CONVERSATIONS } from '../tests/fixtures/cleverGoldenConversations.js';
import { isCleverAiConversationEnabled } from '../src/services/clever/openai/cleverConversationConfig.js';

if (!isCleverAiConversationEnabled()) {
  console.error('CLEVER_AI_CONVERSATION_ENABLED=true und OPENAI_API_KEY erforderlich.');
  process.exit(1);
}

const started = Date.now();
let passed = 0;
let failed = 0;

for (const scenario of ALL_GOLDEN_CONVERSATIONS) {
  console.log(`\n=== ${scenario.id} ===`);
  let lead = { crm: { needProfile: mergeTextIntoNeedProfile('') } };
  const history = [];

  for (const turn of scenario.conversation ?? []) {
    const result = await runCleverTurn({
      lead,
      customerMessage: turn.customer,
      conversationHistory: history,
      dealerId: 'eval-dealer',
      brandContext: { brand: 'Kia', dealerName: 'Eval' },
    });

    history.push({ role: 'user', text: turn.customer });
    if (result.ok) {
      history.push({ role: 'assistant', text: result.turnResult.reply });
      lead = {
        crm: {
          needProfile: mergeTextIntoNeedProfile(turn.customer, lead.crm.needProfile),
        },
      };
    }

    const ok = result.ok || result.fallback;
    if (ok) passed += 1;
    else failed += 1;

    console.log({
      customer: turn.customer,
      mode: result.ok ? 'ai' : 'fallback',
      nextAction: result.turnResult?.nextAction?.type ?? result.reason,
      durationMs: result.metrics?.durationMs,
      usage: result.metrics?.usage ?? null,
    });
  }
}

console.log('\n---');
console.log(`bestanden/fehlgeschlagen: ${passed}/${failed}`);
console.log(`Laufzeit gesamt: ${Date.now() - started} ms`);
process.exit(failed > 0 ? 1 : 0);
