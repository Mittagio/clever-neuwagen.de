#!/usr/bin/env node
/**
 * Clever Golden-Conversation Eval – Live-API (nur lokal/Staging, nicht CI).
 *
 * Usage:
 *   npm run clever:eval
 *   npm run clever:eval -- --model gpt-5.6-luna --out eval-reports/luna.json
 */
import '../server/loadEnv.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isCleverAiConversationEnabled } from '../src/services/clever/openai/cleverConversationConfig.js';
import { summarizeEvalReport } from './lib/cleverEvalAssertions.js';
import {
  DEFAULT_FIXTURE,
  runGoldenConversationEval,
  writeEvalReport,
} from './lib/cleverEvalRunner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function parseArgs(argv = []) {
  const opts = {
    model: process.env.OPENAI_CLEVER_MODEL ?? null,
    out: null,
    fixture: DEFAULT_FIXTURE,
    quiet: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--model' && argv[i + 1]) {
      opts.model = argv[++i];
    } else if (arg === '--out' && argv[i + 1]) {
      opts.out = argv[++i];
    } else if (arg === '--fixture' && argv[i + 1]) {
      opts.fixture = path.resolve(argv[++i]);
    } else if (arg === '--quiet') {
      opts.quiet = true;
    }
  }

  if (!opts.out && opts.model) {
    const safeName = String(opts.model).replace(/[^a-zA-Z0-9._-]/g, '_');
    opts.out = path.join(ROOT, 'eval-reports', `${safeName}.json`);
  }

  return opts;
}

if (!isCleverAiConversationEnabled()) {
  console.error('CLEVER_AI_CONVERSATION_ENABLED=true und OPENAI_API_KEY erforderlich.');
  process.exit(1);
}

const opts = parseArgs(process.argv.slice(2));
const started = Date.now();

console.log(`Clever Eval – Modell: ${opts.model ?? '(env)'}`);
console.log(`Fixture: ${opts.fixture}`);

const report = await runGoldenConversationEval({
  model: opts.model ?? undefined,
  fixturePath: opts.fixture,
});

const summary = summarizeEvalReport(report);
const fullReport = { summary, ...report };

if (opts.out) {
  writeEvalReport(fullReport, path.resolve(opts.out));
  console.log(`Report: ${path.resolve(opts.out)}`);
}

if (!opts.quiet) {
  for (const turn of report.turns) {
    const status = turn.passed ? 'PASS' : 'FAIL';
    console.log(
      `[${status}] ${turn.turnId} ${turn.scenarioId} | ${turn.mode} | `
      + `${turn.durationMs}ms | next=${turn.nextActionType ?? turn.fallbackReason}`,
    );
    if (!turn.passed && turn.issues?.length) {
      for (const issue of turn.issues) {
        console.log(`       - ${issue.code}: ${JSON.stringify(issue)}`);
      }
    }
  }
}

console.log('\n--- Zusammenfassung ---');
console.log(JSON.stringify(summary, null, 2));
console.log(`Laufzeit gesamt: ${Date.now() - started} ms`);

process.exit(summary.failed > 0 || summary.fallbacks > 0 ? 1 : 0);
