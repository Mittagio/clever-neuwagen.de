/**
 * Golden-Conversation Live-Eval Runner.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCleverTurn, applyCleverTurnToLead } from '../../src/services/clever/openai/runCleverTurn.js';
import { getCleverAiConfig } from '../../src/services/clever/openai/cleverConversationConfig.js';
import { mergeTextIntoNeedProfile } from '../../src/services/consultation/needProfileService.js';
import { createEmptyNeedProfile } from '../../src/services/consultation/needProfileTypes.js';
import { evaluateTurnExpectations } from './cleverEvalAssertions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE = path.join(
  __dirname,
  '../../tests/fixtures/cleverGoldenConversationsEval.json',
);

function loadFixture(fixturePath = DEFAULT_FIXTURE) {
  const raw = fs.readFileSync(fixturePath, 'utf8');
  return JSON.parse(raw);
}

function advanceLeadState(lead, customerMessage, turnResult, mode) {
  if (mode === 'ai' && turnResult) {
    try {
      return applyCleverTurnToLead(lead, turnResult, customerMessage).lead;
    } catch {
      // Patch abgelehnt – nur Text-Merge
    }
  }
  const needProfile = mergeTextIntoNeedProfile(
    customerMessage,
    lead?.crm?.needProfile ?? createEmptyNeedProfile(),
  );
  return {
    ...lead,
    crm: { ...(lead?.crm ?? {}), needProfile },
  };
}

/**
 * @param {object} options
 */
export async function runGoldenConversationEval(options = {}) {
  const fixture = options.fixture ?? loadFixture(options.fixturePath ?? DEFAULT_FIXTURE);
  const config = options.config ?? getCleverAiConfig(options.env ?? process.env);
  const model = options.model ?? config.model;
  const dealerId = options.dealerId ?? 'eval-dealer';
  const brandContext = options.brandContext ?? { brand: 'Kia', dealerName: 'Eval' };

  const report = {
    generatedAt: new Date().toISOString(),
    model,
    fixtureVersion: fixture.version ?? 'unknown',
    fixturePath: options.fixturePath ?? DEFAULT_FIXTURE,
    scenarioCount: fixture.scenarios?.length ?? 0,
    turns: [],
  };

  for (const scenario of fixture.scenarios ?? []) {
    let lead = { crm: { needProfile: createEmptyNeedProfile() } };
    const history = [];

    for (const turn of scenario.turns ?? []) {
      const customerMessage = turn.customer;
      const started = Date.now();

      const result = await runCleverTurn({
        lead,
        customerMessage,
        conversationHistory: history,
        dealerId,
        brandContext,
      }, {
        config: {
          ...config,
          enabled: true,
          model,
        },
        env: options.env,
      });

      const mode = result.ok ? 'ai' : 'fallback';
      const turnResult = result.turnResult ?? null;
      const profileState = lead?.crm?.needProfile ?? {};

      let evaluation = { passed: false, issues: [{ code: 'fallback_used', reason: result.reason }] };
      if (mode === 'ai' && turnResult) {
        const afterApply = advanceLeadState(lead, customerMessage, turnResult, 'ai');
        evaluation = evaluateTurnExpectations(
          turnResult,
          turn.expect ?? {},
          afterApply?.crm?.needProfile ?? profileState,
        );
      } else if (turn.allowFallback) {
        evaluation = { passed: true, issues: [] };
      }

      const durationMs = result.metrics?.durationMs ?? (Date.now() - started);
      const usage = result.usage ?? result.metrics?.usage ?? null;

      report.turns.push({
        turnId: turn.turnId,
        scenarioId: scenario.id,
        scenarioLabel: scenario.label,
        customer: customerMessage,
        mode,
        fallbackReason: result.reason ?? null,
        intent: turnResult?.intent ?? null,
        nextActionType: turnResult?.nextAction?.type ?? null,
        nextActionQuestion: turnResult?.nextAction?.question ?? null,
        needProfilePatch: turnResult?.needProfilePatch ?? null,
        usedFactIds: turnResult?.usedFactIds ?? [],
        toolCallCount: result.metrics?.toolCallCount ?? 0,
        durationMs,
        usage,
        expect: turn.expect ?? {},
        passed: evaluation.passed,
        issues: evaluation.issues,
        replyPreview: turnResult?.reply
          ? String(turnResult.reply).slice(0, 280)
          : null,
      });

      history.push({ role: 'user', text: customerMessage });
      if (turnResult?.reply) {
        history.push({ role: 'assistant', text: turnResult.reply });
      }

      lead = advanceLeadState(lead, customerMessage, turnResult, mode);
    }
  }

  return report;
}

export function writeEvalReport(report, outPath) {
  const dir = path.dirname(outPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
}

export { DEFAULT_FIXTURE, loadFixture };
