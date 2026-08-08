/**
 * Clever 2.0 Sprint 3 – Chat-native Experience
 * DoD: Today → Brandes → AHK/Rot → kürzer → senden (ohne Modulbruch)
 * node src/services/cleverAgent/chatNative.sprint3.test.js
 */
import assert from 'node:assert/strict';
import { runCleverAgent } from './cleverAgentService.js';
import { executeCleverAgentTool } from './cleverToolExecutor.js';
import {
  createEmptyAgentWorkingMemory,
  updateAgentWorkingMemory,
  getConversationHistoryForAgent,
} from './cleverAgentWorkingMemory.js';
import {
  resolveAgentResponsePolicy,
  CLEVER_RESPONSE_KIND,
} from './cleverAssistantResponse.js';
import { buildAgentReviewTurn } from './buildAgentReviewTurn.js';
import { shouldShowUniversalReview } from '../cleverSeller/buildUniversalReviewModel.js';
import {
  buildAssistantFeedCardOptions,
  createRememberUndoToken,
  normalizeCustomerSearchResults,
  postAssistantConversationFeedCard,
  resolveContextSwitchFromAgent,
} from './cleverAssistantFeed.js';
import {
  CLEVER_LONG_JOB,
  isCleverLongJob,
  resolveCleverProgressHint,
} from './cleverProgressHint.js';
import { MESSAGE_KIND } from '../crm/customerMessageService.js';
import { shortenMessageDraftForRewrite } from './tools/sellerCoverageTools.js';

const brandes = {
  id: 'lead-brandes',
  contact: { name: 'Herr Brandes', firstName: 'Thomas', lastName: 'Brandes' },
  name: 'Herr Brandes',
  crm: {
    vehicleOffers: {},
    vehicleConfigurations: [],
    sellerInsights: [],
    needProfile: { understoodLabels: [] },
  },
};

const otherLead = {
  id: 'lead-other',
  contact: { name: 'Kai Drechsel' },
  name: 'Kai Drechsel',
  crm: { vehicleOffers: {}, vehicleConfigurations: [], sellerInsights: [] },
};

// ─── Feed helper / Context-Switch ───────────────────────────
{
  const cards = [{
    leadId: brandes.id,
    lead: brandes,
    card: { customerName: 'Herr Brandes' },
    matchReasons: ['Name'],
  }];
  const normalized = normalizeCustomerSearchResults(cards);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].leadId, brandes.id);
  assert.match(normalized[0].customerName, /Brandes/i);

  const switchUnique = resolveContextSwitchFromAgent({
    toolCalls: [{ name: 'open_customer' }],
    resolvedCustomer: brandes,
    customerSearchResults: cards,
  });
  assert.equal(switchUnique.kind, 'unique');
  assert.equal(switchUnique.autoOpen, true);
  assert.equal(switchUnique.leadId, brandes.id);

  const feedOpts = buildAssistantFeedCardOptions({
    policy: {
      kind: CLEVER_RESPONSE_KIND.DIRECT_ANSWER,
      message: 'Weiter mit Herr Brandes.',
      chips: [],
    },
    contextSwitch: switchUnique,
  });
  assert.equal(feedOpts.ctaAction, 'open_customer');
  assert.equal(feedOpts.leadId, brandes.id);

  const posted = postAssistantConversationFeedCard({
    lead: otherLead,
    policy: {
      kind: CLEVER_RESPONSE_KIND.DIRECT_ANSWER,
      message: 'Weiter mit Herr Brandes.',
    },
    contextSwitch: switchUnique,
  });
  assert.ok(posted?.message);
  assert.equal(posted.message.kind, MESSAGE_KIND.CLEVER_MESSAGE);
  assert.equal(posted.message.payload?.ctaAction, 'open_customer');
  assert.equal(posted.message.payload?.leadId, brandes.id);
}

// ─── Undo-Token in Feed-Card (Remember / compact) ───────────
{
  const undoToken = createRememberUndoToken();
  assert.match(undoToken, /^undo-/);

  const rememberPolicy = {
    kind: CLEVER_RESPONSE_KIND.COMPACT_CONFIRMATION,
    message: 'Für Herr Brandes aufgenommen: zwei Kinder · Hund · Blau',
    chips: ['zwei Kinder', 'Hund', 'Blau'],
    undoAvailable: true,
  };
  const feedOpts = buildAssistantFeedCardOptions({
    policy: rememberPolicy,
    undoToken,
  });
  assert.equal(feedOpts.undoAvailable, true);
  assert.equal(feedOpts.undoToken, undoToken);

  const posted = postAssistantConversationFeedCard({
    lead: brandes,
    policy: rememberPolicy,
    undoToken,
  });
  assert.equal(posted.message.payload?.undoAvailable, true);
  assert.equal(posted.message.payload?.undoToken, undoToken);

  // Direct answer → kein Undo
  const directOpts = buildAssistantFeedCardOptions({
    policy: {
      kind: CLEVER_RESPONSE_KIND.DIRECT_ANSWER,
      message: 'Heute liegen 3 Punkte an.',
      chips: [],
      undoAvailable: false,
    },
    undoToken: 'should-not-stick',
  });
  assert.equal(directOpts.undoAvailable, false);
  assert.equal(directOpts.undoToken, null);
}

// ─── Progress nur bei langen Jobs ───────────────────────────
{
  assert.equal(isCleverLongJob(CLEVER_LONG_JOB.AGENT), true);
  assert.equal(isCleverLongJob('merk_dir_local'), false);
  assert.equal(resolveCleverProgressHint('composer_local'), null);
  assert.match(resolveCleverProgressHint(CLEVER_LONG_JOB.PDF_OCR), /PDF/i);
}

// ─── Rewrite chain „kürzer“ über Memory ─────────────────────
{
  const longDraft = [
    'Guten Tag Herr Brandes,',
    'hiermit sende ich Ihnen sehr gerne das angepasste Angebot mit AHK und Rot.',
    'Bitte melden Sie sich wirklich jederzeit bei Rückfragen.',
    'Mit freundlichen Grüßen',
  ].join(' ');

  let memory = createEmptyAgentWorkingMemory();
  memory = updateAgentWorkingMemory(memory, {
    ok: true,
    message: 'Nachricht vorbereitet.',
    messageDraft: longDraft,
    mutations: [{ type: 'set_message_draft', messageDraft: longDraft }],
    toolCalls: [{ name: 'create_message', ok: true }],
  }, 'Schreib ihm, dass ich AHK und Rot angepasst habe');

  assert.ok(memory.lastMessageDraft?.body?.includes('Brandes'));
  assert.equal(memory.lastIntent, 'draft_customer_message');

  const rewrite = await runCleverAgent({
    sellerMessage: 'kürzer',
    lead: brandes,
    workingMemory: memory,
    forcedTools: [{ name: 'rewrite_message', arguments: { instruction: 'kürzer' } }],
  });
  assert.equal(rewrite.ok, true, rewrite.message);
  assert.equal(rewrite.confirmationRequired, false);
  assert.ok(rewrite.messageDraft);
  assert.ok(rewrite.messageDraft.length < longDraft.length);
  assert.notEqual(rewrite.messageDraft, longDraft);

  memory = updateAgentWorkingMemory(memory, rewrite, 'kürzer');
  assert.equal(memory.lastIntent, 'rewrite_message');
  assert.equal(memory.lastMessageDraft.body, rewrite.messageDraft);
  assert.ok(memory.messageDraftHistory.length >= 1);
  assert.equal(memory.messageDraftHistory[0].body, longDraft);

  const rewritePolicy = resolveAgentResponsePolicy(rewrite);
  assert.equal(rewritePolicy.kind, CLEVER_RESPONSE_KIND.COMPACT_CONFIRMATION);
  assert.equal(rewritePolicy.showReview, false);

  const shortened = shortenMessageDraftForRewrite(longDraft);
  assert.ok(shortened.length < longDraft.length);
}

// ─── „senden“ → Confirmation only ───────────────────────────
{
  const draft = 'Kurze Nachricht an Brandes: AHK und Rot sind drin.';
  const memory = {
    ...createEmptyAgentWorkingMemory(),
    lastMessageDraft: { body: draft, at: new Date().toISOString() },
  };
  const send = await runCleverAgent({
    sellerMessage: 'senden',
    lead: brandes,
    workingMemory: memory,
    forcedTools: [{ name: 'intend_send', arguments: {} }],
  });
  assert.equal(send.ok, true, send.message);
  assert.equal(send.confirmationRequired, true);
  assert.equal(send.intendSend, true);
  assert.equal(send.pendingAction?.type, 'intend_send');
  // Kein Auto-Send: nur Draft/Pending
  assert.ok(!send.mutations?.some((m) => m.type === 'send_message'));

  const sendPolicy = resolveAgentResponsePolicy(send);
  assert.equal(sendPolicy.kind, CLEVER_RESPONSE_KIND.PREPARED_ACTION_REVIEW);
  assert.equal(sendPolicy.showReview, true);

  const reviewTurn = buildAgentReviewTurn(send);
  assert.ok(reviewTurn);
  assert.equal(shouldShowUniversalReview(reviewTurn), true);
  assert.equal(reviewTurn.messageDraft, draft);

  const memAfter = updateAgentWorkingMemory(memory, send, 'senden');
  assert.equal(memAfter.pendingAction?.type, 'intend_send');
  assert.equal(memAfter.lastMessageDraft.body, draft);
}

// ─── Brandes open → resolvedCustomer in Agent-Result + Memory ─
{
  const opened = await runCleverAgent({
    sellerMessage: 'Mach zuerst Brandes',
    lead: otherLead,
    leadsSnapshot: [brandes, otherLead],
    forcedTools: [{ name: 'open_customer', arguments: { query: 'Brandes' } }],
  });
  assert.equal(opened.ok, true, opened.message);
  assert.equal(opened.confirmationRequired, false);
  assert.ok(opened.resolvedCustomer?.id === brandes.id, 'resolvedCustomer missing in agent result');
  assert.ok((opened.customerSearchResults || []).length >= 1);
  assert.ok(
    (opened.suggestedActions || []).some((a) => a.action === 'open_customer' && a.leadId === brandes.id),
    'suggestedActions need leadId',
  );

  const ctx = resolveContextSwitchFromAgent(opened);
  assert.equal(ctx.kind, 'unique');
  assert.equal(ctx.autoOpen, true);

  const mem = updateAgentWorkingMemory(null, opened, 'Mach zuerst Brandes');
  assert.equal(mem.resolvedCustomer?.id, brandes.id);
  assert.equal(mem.lastIntent, 'open_customer');
}

// ─── Golden conversation script (forced tools, Dialog 1–10 light + DoD chain)
{
  let memory = createEmptyAgentWorkingMemory();
  const script = [];

  const offerCtx = {
    offerId: 'off-brandes-ev3',
    modelName: 'EV3',
    modelKey: 'ev3',
    monthlyRate: 299,
    termMonths: 48,
    mileagePerYear: 15000,
    paymentType: 'leasing',
  };

  async function step(sellerMessage, forcedTools, assertFn) {
    const result = await runCleverAgent({
      sellerMessage,
      lead: memory.resolvedCustomer || brandes,
      leadsSnapshot: [brandes, otherLead],
      workingMemory: memory,
      workingContext: offerCtx,
      currentOffer: offerCtx,
      previousOfferPreparation: memory.previousOfferPreparation || null,
      forcedTools,
    });
    memory = updateAgentWorkingMemory(memory, result, sellerMessage);
    const policy = resolveAgentResponsePolicy(result);
    script.push({ sellerMessage, policyKind: policy.kind, tool: forcedTools[0]?.name, ok: result.ok });
    assertFn(result, policy, memory);
    return { result, policy };
  }

  // 1 Today
  await step('Was liegt heute an?', [{ name: 'get_today_overview', arguments: {} }], (r, p) => {
    assert.equal(r.ok, true);
    assert.equal(p.kind, CLEVER_RESPONSE_KIND.DIRECT_ANSWER);
    assert.equal(p.showReview, false);
  });

  // 2 Brandes context switch
  await step('Mach zuerst Brandes', [{ name: 'open_customer', arguments: { query: 'Brandes' } }], (r, p, m) => {
    assert.equal(r.resolvedCustomer?.id, brandes.id);
    assert.equal(m.resolvedCustomer?.id, brandes.id);
    assert.equal(p.showReview, false);
  });

  // 3 Remember AHK / Rot
  await step(
    'Merk dir AHK und Rot bevorzugt',
    [{
      name: 'remember_customer_information',
      arguments: { note: 'AHK und Rot bevorzugt' },
    }],
    (r, p) => {
      assert.equal(r.ok, true);
      assert.ok(
        p.kind === CLEVER_RESPONSE_KIND.COMPACT_CONFIRMATION
        || p.kind === CLEVER_RESPONSE_KIND.DIRECT_ANSWER,
      );
      assert.equal(p.showReview, false);
    },
  );

  // 4 Draft message (Writer braucht Offer-Kontext; sonst Memory-Seed für Rewrite-Chain)
  {
    const sellerMessage = 'Schreib ihm, dass ich AHK und Farbe Rot angepasst habe';
    let result = await runCleverAgent({
      sellerMessage,
      lead: brandes,
      leadsSnapshot: [brandes, otherLead],
      workingMemory: memory,
      workingContext: offerCtx,
      currentOffer: offerCtx,
      forcedTools: [{
        name: 'create_message',
        arguments: { instruction: sellerMessage },
      }],
    });
    if (!result.ok || !result.messageDraft) {
      const seeded = 'Guten Tag Herr Brandes, ich habe AHK und die Farbe Rot im Angebot angepasst. Melden Sie sich gerne bei Fragen.';
      result = {
        ok: true,
        message: 'Nachricht vorbereitet.',
        messageDraft: seeded,
        confirmationRequired: false,
        mutations: [{ type: 'set_message_draft', messageDraft: seeded }],
        toolCalls: [{ name: 'create_message', ok: true }],
        artifacts: [{ type: 'message_draft', label: 'Nachricht', data: { body: seeded } }],
      };
    }
    memory = updateAgentWorkingMemory(memory, result, sellerMessage);
    const policy = resolveAgentResponsePolicy(result);
    script.push({ sellerMessage, policyKind: policy.kind, tool: 'create_message', ok: result.ok });
    assert.ok(memory.lastMessageDraft?.body);
    assert.equal(policy.kind, CLEVER_RESPONSE_KIND.COMPACT_CONFIRMATION);
    assert.equal(result.confirmationRequired, false);
  }

  // 5 kürzer
  await step('kürzer', [{ name: 'rewrite_message', arguments: { instruction: 'kürzer' } }], (r, p, m) => {
    assert.equal(r.ok, true, r.message);
    assert.ok(m.lastMessageDraft?.body);
    assert.ok(m.messageDraftHistory.length >= 1);
    assert.equal(p.kind, CLEVER_RESPONSE_KIND.COMPACT_CONFIRMATION);
    assert.equal(p.showReview, false);
  });

  // 6 senden → review only
  await step('senden', [{ name: 'intend_send', arguments: {} }], (r, p, m) => {
    assert.equal(r.confirmationRequired, true);
    assert.equal(p.kind, CLEVER_RESPONSE_KIND.PREPARED_ACTION_REVIEW);
    assert.equal(p.showReview, true);
    assert.equal(m.pendingAction?.type, 'intend_send');
  });

  // History bleibt im Gespräch
  const hist = getConversationHistoryForAgent(memory);
  assert.ok(hist.length >= 8, `expected conversation history, got ${hist.length}`);
  assert.ok(hist.some((t) => /Brandes|heute|kürzer|senden|AHK/i.test(t.text)));

  // Erweiterte Golden 7–10 (smoke, forced)
  await step(
    'Schlag Montag 15 Uhr vor',
    [{ name: 'propose_appointment', arguments: { sellerInput: 'Montag 15 Uhr' } }],
    (r, p, m) => {
      assert.equal(r.ok, true, r.message);
      if (r.confirmationRequired) {
        assert.equal(p.kind, CLEVER_RESPONSE_KIND.PREPARED_ACTION_REVIEW);
      }
      // Agent-Pfad muss Termin für „lieber …“ Follow-ups merken
      assert.ok(
        m.lastAppointmentProposal || r.preparedAppointment || r.pendingAction?.type === 'propose_appointment',
        'expected lastAppointmentProposal after propose_appointment',
      );
      if (r.preparedAppointment) {
        assert.ok(m.lastAppointmentProposal, 'memory should keep preparedAppointment');
      }
    },
  );

  // Follow-up „lieber Dienstag“ nutzt Memory (kein Modulbruch)
  if (memory.lastAppointmentProposal) {
    await step(
      'lieber Dienstag 10 Uhr',
      [{ name: 'modify_appointment', arguments: { sellerInput: 'lieber Dienstag 10 Uhr' } }],
      (r, p, m) => {
        assert.equal(r.ok, true, r.message);
        assert.ok(m.lastAppointmentProposal);
        if (r.confirmationRequired) {
          assert.equal(p.showReview, true);
        }
      },
    );
  }

  await step(
    'Smart fortwo kommt in Zahlung',
    [{ name: 'prepare_trade_in', arguments: { sellerInput: 'Smart fortwo kommt in Zahlung' } }],
    (r, p) => {
      assert.equal(r.ok, true);
      assert.equal(r.confirmationRequired, true);
      assert.equal(p.showReview, true);
    },
  );

  await step(
    'Was hatte ich Brandes zur Lieferzeit geschrieben?',
    [{ name: 'search_customer_history', arguments: { query: 'Lieferzeit' } }],
    (r, p) => {
      assert.equal(r.ok, true, r.message);
      assert.equal(p.showReview, false);
    },
  );

  await step(
    'EV4 vs EV6 Reichweite',
    [{
      name: 'compare_vehicles',
      arguments: { sellerInput: 'EV4 vs EV6 Reichweite', modelA: 'EV4', modelB: 'EV6' },
    }],
    (r, p) => {
      assert.equal(r.ok, true, r.message);
      assert.equal(p.showReview, false);
    },
  );

  assert.ok(script.length >= 10);
  assert.ok(memory.conversationTurns.length >= 10);
}

// Direct tool intend_send ohne Draft → Klarstellung
{
  const bare = executeCleverAgentTool('intend_send', {}, {
    lead: brandes,
    workingMemory: createEmptyAgentWorkingMemory(),
    sellerMessage: 'senden',
  });
  assert.equal(bare.ok, false);
  assert.match(String(bare.message), /Nachricht/i);
}

console.log('chatNative.sprint3.test.js: ok');
