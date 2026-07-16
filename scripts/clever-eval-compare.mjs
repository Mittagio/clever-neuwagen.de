#!/usr/bin/env node
/**
 * Modellvergleich: gpt-5.6-luna vs gpt-4o-mini vs gpt-5.6-terra (optional).
 *
 * Usage:
 *   npm run clever:eval:compare
 *   npm run clever:eval:compare -- --models gpt-5.6-luna,gpt-4o-mini
 */
import '../server/loadEnv.js';
import fs from 'node:fs';
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
const REPORT_DIR = path.join(ROOT, 'eval-reports');

const DEFAULT_MODELS = [
  'gpt-5.6-luna',
  'gpt-4o-mini',
  'gpt-5.6-terra',
];

function parseModelsArg(argv) {
  const idx = argv.indexOf('--models');
  if (idx !== -1 && argv[idx + 1]) {
    return argv[idx + 1].split(',').map((m) => m.trim()).filter(Boolean);
  }
  if (process.env.CLEVER_EVAL_MODELS) {
    return process.env.CLEVER_EVAL_MODELS.split(',').map((m) => m.trim()).filter(Boolean);
  }
  return DEFAULT_MODELS;
}

function buildComparisonMarkdown(summaries) {
  const header = [
    '| Kriterium |',
    ...summaries.map((s) => ` ${s.model} |`),
  ].join('');
  const sep = [
    '|-----------|',
    ...summaries.map(() => '----------|'),
  ].join('');

  const row = (label, pick) => [
    `| ${label} |`,
    ...summaries.map((s) => ` ${pick(s)} |`),
  ].join('');

  return [
    '# Clever Eval – Modellvergleich',
    '',
    `Erstellt: ${new Date().toISOString()}`,
    '',
    header,
    sep,
    row('Turns bestanden', (s) => `${s.passed}/${s.turnCount}`),
    row('Pass-Rate', (s) => `${s.passRate}%`),
    row('AI-Turns', (s) => String(s.aiTurns)),
    row('Fallbacks', (s) => String(s.fallbacks)),
    row('Grounding-Fehler', (s) => String(s.groundingFails)),
    row('Unnötige Rückfragen', (s) => String(s.unnecessaryQuestions)),
    row('Ø Latenz/Turn', (s) => `${s.avgDurationMs} ms`),
    row('Tokens gesamt', (s) => String(s.totalTokens)),
    '',
  ].join('\n');
}

if (!isCleverAiConversationEnabled()) {
  console.error('CLEVER_AI_CONVERSATION_ENABLED=true und OPENAI_API_KEY erforderlich.');
  process.exit(1);
}

const models = parseModelsArg(process.argv.slice(2));
fs.mkdirSync(REPORT_DIR, { recursive: true });

const summaries = [];
const started = Date.now();

for (const model of models) {
  console.log(`\n=== Eval: ${model} ===`);
  const report = await runGoldenConversationEval({ model, fixturePath: DEFAULT_FIXTURE });
  const summary = summarizeEvalReport(report);
  summaries.push(summary);

  const safeName = model.replace(/[^a-zA-Z0-9._-]/g, '_');
  const outPath = path.join(REPORT_DIR, `${safeName}.json`);
  writeEvalReport({ summary, ...report }, outPath);
  console.log(`Report: ${outPath}`);
  console.log(JSON.stringify(summary, null, 2));
}

const comparison = {
  generatedAt: new Date().toISOString(),
  models,
  summaries,
  durationMs: Date.now() - started,
};

const compareJsonPath = path.join(REPORT_DIR, 'comparison.json');
fs.writeFileSync(compareJsonPath, JSON.stringify(comparison, null, 2), 'utf8');

const compareMdPath = path.join(REPORT_DIR, 'comparison.md');
fs.writeFileSync(compareMdPath, buildComparisonMarkdown(summaries), 'utf8');

console.log(`\nVergleich: ${compareJsonPath}`);
console.log(`Markdown:  ${compareMdPath}`);

const anyFailed = summaries.some((s) => s.failed > 0 || s.fallbacks > 0);
process.exit(anyFailed ? 1 : 0);
