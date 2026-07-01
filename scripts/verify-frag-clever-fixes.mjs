/**
 * Verifikation Frag-Clever-Fixes: direkter Code vs. Live-API
 */
import { orchestrateCustomerQuery } from '../src/services/clever/cleverCustomerQueryOrchestrator.js';
import { QUERY_TYPES, UI_COMPONENTS } from '../src/services/clever/customerQueryTypes.js';

const API = 'http://127.0.0.1:3001/api/v1/clever/customer-query';

const CASES = [
  {
    id: '1',
    query: 'Ich möchte ein Angebot',
    expect: {
      queryType: QUERY_TYPES.PURCHASE_INTENT,
      uiNot: UI_COMPONENTS.NEED_SEARCH,
      uiNot2: UI_COMPONENTS.SPECIAL_CONTACT,
      titleMatch: /Angebot|Autohaus/i,
    },
  },
  {
    id: '2',
    query: 'Wie viel Stützlast hat der EV9?',
    expect: {
      queryType: QUERY_TYPES.MODEL_EQUIPMENT_QUESTION,
      topic: 'vertical_load',
      titleNot: /Ausstattung im Überblick|größer|Größe/i,
      leadMatch: /Stützlast|Anhängelast|Anhänger/i,
    },
  },
  {
    id: '3',
    query: 'Wie viele Sitzplätze hat der EV9?',
    expect: {
      queryType: QUERY_TYPES.MODEL_EQUIPMENT_QUESTION,
      topic: 'seating',
      leadMatch: /6|7|Sitz|Reihen/i,
      titleNot: /Ausstattung im Überblick/i,
    },
  },
  {
    id: '4',
    query: 'Hat der EV3 Isofix?',
    expect: {
      queryType: QUERY_TYPES.MODEL_EQUIPMENT_QUESTION,
      topic: 'isofix',
      leadMatch: /Isofix|Familie|Rücksitz/i,
      titleNot: /Ausstattung im Überblick/i,
    },
  },
  {
    id: '5',
    query: 'Wie schnell lädt der EV6?',
    expect: {
      queryType: QUERY_TYPES.MODEL_EQUIPMENT_QUESTION,
      topic: 'charging_speed',
      leadMatch: /Lade|DC|10|80|Akku|Temperatur/i,
      titleNot: /Ausstattung im Überblick/i,
    },
  },
  {
    id: '6',
    query: 'Ich habe 2 Kinder, einen Hund, einen Wohnwagen und fahre täglich 20 km. Fahre bisher einen Kia XCeed Benziner und möchte jetzt Elektro.',
    expect: {
      queryType: QUERY_TYPES.VEHICLE_WISH,
      topic: 'advisor_profile_assessment',
      ui: UI_COMPONENTS.SMART_ANSWER,
      uiNot: UI_COMPONENTS.SPECIAL_CONTACT,
      titleMatch: /XCeed|Elektro/i,
      hasUnderstood: true,
      hasDirections: /EV5|EV9/i,
    },
  },
  {
    id: '7',
    query: 'Suche einen Elektro mit AHK für 2 Kinder mit Isofix und 400 km Reichweite. Hat der EV3 2 Isofix?',
    expect: {
      queryType: QUERY_TYPES.MIXED_INTENT,
      ui: UI_COMPONENTS.SMART_ANSWER,
      uiNot: UI_COMPONENTS.SPECIAL_CONTACT,
      titleMatch: /EV3|Isofix|Kind/i,
      hasFollowUps: true,
    },
  },
];

const REGRESSION = [
  { id: 'R1', query: 'Was bringt eine Wärmepumpe?', expectType: QUERY_TYPES.ADVICE_QUESTION, expectUi: UI_COMPONENTS.ADVICE_ANSWER },
  { id: 'R2', query: 'Mercedes GLE oder Kia EV9?', expectType: QUERY_TYPES.COMPETITOR_COMPARISON },
  { id: 'R3', query: 'Welcher Kia hat den größten Kofferraum?', expectType: QUERY_TYPES.RANKING_QUESTION, expectUi: UI_COMPONENTS.RANKING_ANSWER },
  { id: 'R4', query: 'EV4 oder EV5 größer?', expectType: QUERY_TYPES.COMPARISON_QUESTION, expectUi: UI_COMPONENTS.COMPARISON_ANSWER },
];

function pickResult(r) {
  return {
    queryType: r.classification?.queryType,
    topic: r.classification?.topic,
    ui: r.ui?.component,
    title: r.smartAnswer?.title ?? r.answer?.title ?? '',
    lead: r.smartAnswer?.lead ?? r.answer?.body ?? '',
    understood: r.smartAnswer?.understoodWishes ?? [],
    directions: r.smartAnswer?.modelDirections ?? [],
    followUps: (r.followUpSuggestions ?? []).map((f) => f.label),
  };
}

function check(caseDef, result, label) {
  const issues = [];
  const e = caseDef.expect;
  if (e.queryType && result.queryType !== e.queryType) {
    issues.push(`${label}: queryType ${result.queryType} ≠ ${e.queryType}`);
  }
  if (e.topic && result.topic !== e.topic) {
    issues.push(`${label}: topic ${result.topic} ≠ ${e.topic}`);
  }
  if (e.ui && result.ui !== e.ui) {
    issues.push(`${label}: ui ${result.ui} ≠ ${e.ui}`);
  }
  if (e.uiNot && result.ui === e.uiNot) {
    issues.push(`${label}: ui soll nicht ${e.uiNot} sein`);
  }
  if (e.uiNot2 && result.ui === e.uiNot2) {
    issues.push(`${label}: ui soll nicht ${e.uiNot2} sein`);
  }
  if (e.titleMatch && !e.titleMatch.test(result.title)) {
    issues.push(`${label}: title "${result.title}" passt nicht`);
  }
  if (e.titleNot && e.titleNot.test(result.title)) {
    issues.push(`${label}: title "${result.title}" unerwünscht`);
  }
  if (e.leadMatch && !e.leadMatch.test(result.lead)) {
    issues.push(`${label}: lead passt nicht: "${result.lead.slice(0, 100)}"`);
  }
  if (e.hasUnderstood && result.understood.length < 3) {
    issues.push(`${label}: zu wenig understoodWishes (${result.understood.length})`);
  }
  if (e.hasDirections && !result.directions.some((d) => e.hasDirections.test(d))) {
    issues.push(`${label}: modelDirections fehlen EV5/EV9`);
  }
  if (e.hasFollowUps && result.followUps.length < 2) {
    issues.push(`${label}: zu wenig Follow-ups`);
  }
  return issues;
}

async function runDirect(q) {
  return orchestrateCustomerQuery({ query: q, useOpenAi: false, dealerId: 'autohaus-trinkle' });
}

async function runApi(q) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ query: q, dealerId: 'autohaus-trinkle', useOpenAi: false }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? 'api_failed');
  return data;
}

const report = { cases: [], regression: [], mismatches: [], allIssues: [] };

for (const c of CASES) {
  const direct = pickResult(await runDirect(c.query));
  const api = pickResult(await runApi(c.query));
  const directIssues = check(c, direct, 'code');
  const apiIssues = check(c, api, 'api');
  const parity = [];
  for (const key of ['queryType', 'topic', 'ui']) {
    if (direct[key] !== api[key]) parity.push(`${key}: code=${direct[key]} api=${api[key]}`);
  }
  report.cases.push({
    id: c.id,
    query: c.query.slice(0, 70),
    direct,
    api,
    directOk: directIssues.length === 0,
    apiOk: apiIssues.length === 0,
    parityOk: parity.length === 0,
    parity,
    issues: [...directIssues, ...apiIssues, ...parity.map((p) => `parity: ${p}`)],
  });
  report.allIssues.push(...directIssues, ...apiIssues, ...parity.map((p) => `[${c.id}] parity: ${p}`));
}

for (const r of REGRESSION) {
  const direct = pickResult(await runDirect(r.query));
  const api = pickResult(await runApi(r.query));
  const issues = [];
  if (direct.queryType !== r.expectType) issues.push(`code type ${direct.queryType}`);
  if (api.queryType !== r.expectType) issues.push(`api type ${api.queryType}`);
  if (r.expectUi && direct.ui !== r.expectUi) issues.push(`code ui ${direct.ui}`);
  if (r.expectUi && api.ui !== r.expectUi) issues.push(`api ui ${api.ui}`);
  if (direct.queryType !== api.queryType) issues.push(`parity type`);
  if (direct.ui !== api.ui) issues.push(`parity ui`);
  report.regression.push({ id: r.id, query: r.query, direct, api, ok: issues.length === 0, issues });
  report.allIssues.push(...issues.map((i) => `[${r.id}] ${i}`));
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.allIssues.length > 0 ? 1 : 0);
