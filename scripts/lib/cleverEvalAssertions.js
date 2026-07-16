/**
 * Golden-Conversation Eval – Assertions (keine Live-API in Unit Tests).
 */

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Prüft ob `expected` partiell in `actual` enthalten ist.
 */
export function partialMatch(actual, expected, path = '') {
  const failures = [];
  if (!isPlainObject(expected)) {
    if (actual !== expected) {
      failures.push({ path: path || 'root', expected, actual });
    }
    return failures;
  }

  for (const [key, expVal] of Object.entries(expected)) {
    const nextPath = path ? `${path}.${key}` : key;
    const actVal = actual?.[key];
    if (isPlainObject(expVal)) {
      failures.push(...partialMatch(actVal ?? {}, expVal, nextPath));
    } else if (actVal !== expVal) {
      failures.push({ path: nextPath, expected: expVal, actual: actVal });
    }
  }
  return failures;
}

export function containsForbiddenPhrase(text = '', phrases = []) {
  const blob = String(text ?? '');
  const hits = [];
  for (const phrase of phrases) {
    if (phrase && blob.toLowerCase().includes(String(phrase).toLowerCase())) {
      hits.push(phrase);
    }
  }
  return hits;
}

export function vehicleDirectionKeys(vehicleDirections = [], statuses = null) {
  const list = vehicleDirections ?? [];
  return list
    .filter((d) => !statuses || statuses.includes(d.status))
    .map((d) => String(d.modelKey ?? '').toLowerCase())
    .filter(Boolean);
}

/**
 * @param {object} turnResult
 * @param {object} expect
 * @param {object} profileState – aktuelles needProfile nach Merge
 */
export function evaluateTurnExpectations(turnResult, expect = {}, profileState = {}) {
  const issues = [];
  const reply = turnResult?.reply ?? '';
  const nextQuestion = turnResult?.nextAction?.question ?? '';

  if (expect.intent && turnResult?.intent !== expect.intent) {
    issues.push({
      code: 'wrong_intent',
      expected: expect.intent,
      actual: turnResult?.intent ?? null,
    });
  }

  if (expect.nextAction?.type != null) {
    const actualType = turnResult?.nextAction?.type ?? null;
    if (actualType !== expect.nextAction.type) {
      issues.push({
        code: 'wrong_next_action_type',
        expected: expect.nextAction.type,
        actual: actualType,
      });
    }
    if (expect.nextAction.targetField != null
      && turnResult?.nextAction?.targetField !== expect.nextAction.targetField) {
      issues.push({
        code: 'wrong_next_action_field',
        expected: expect.nextAction.targetField,
        actual: turnResult?.nextAction?.targetField ?? null,
      });
    }
  }

  if (expect.needProfile) {
    const profileFailures = partialMatch(profileState, expect.needProfile);
    for (const f of profileFailures) {
      issues.push({ code: 'need_profile_mismatch', ...f });
    }
  }

  if (expect.handoff?.ready === true && turnResult?.handoff?.ready !== true) {
    issues.push({
      code: 'handoff_not_ready',
      expected: true,
      actual: turnResult?.handoff?.ready ?? false,
    });
  }

  if (expect.handoff?.requested === true && turnResult?.handoff?.requested !== true) {
    issues.push({
      code: 'handoff_not_requested',
      expected: true,
      actual: turnResult?.handoff?.requested ?? false,
    });
  }

  if (expect.requiresUsedFactIds && !(turnResult?.usedFactIds?.length > 0)) {
    issues.push({ code: 'missing_used_fact_ids' });
  }

  const directionKeys = vehicleDirectionKeys(
    turnResult?.vehicleDirections,
    ['candidate', 'interesting'],
  );
  const excludedKeys = vehicleDirectionKeys(
    turnResult?.vehicleDirections,
    ['excluded'],
  );

  for (const key of expect.vehicleDirectionsInclude ?? []) {
    if (!directionKeys.includes(String(key).toLowerCase())) {
      issues.push({
        code: 'missing_vehicle_direction',
        modelKey: key,
        actualDirections: directionKeys,
      });
    }
  }

  for (const key of expect.vehicleDirectionsExclude ?? []) {
    const lower = String(key).toLowerCase();
    if (directionKeys.includes(lower)) {
      issues.push({
        code: 'forbidden_vehicle_as_candidate',
        modelKey: key,
      });
    }
  }

  const forbiddenReply = containsForbiddenPhrase(
    `${reply}\n${nextQuestion}`,
    expect.forbiddenInReply ?? [],
  );
  for (const phrase of forbiddenReply) {
    issues.push({ code: 'forbidden_phrase', phrase });
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

/**
 * Aggregiert Eval-Ergebnisse für Modellvergleich.
 */
export function summarizeEvalReport(report = {}) {
  const turns = report.turns ?? [];
  const passed = turns.filter((t) => t.passed).length;
  const aiTurns = turns.filter((t) => t.mode === 'ai').length;
  const fallbacks = turns.filter((t) => t.mode === 'fallback').length;
  const groundingFails = turns.filter((t) => t.fallbackReason === 'grounding_failed').length;
  const unnecessaryQuestions = turns.filter(
    (t) => t.mode === 'ai'
      && t.nextActionType
      && t.nextActionType !== 'none'
      && t.expect?.nextAction?.type === 'none',
  ).length;

  const totalDurationMs = turns.reduce((sum, t) => sum + (t.durationMs ?? 0), 0);
  const totalInputTokens = turns.reduce((sum, t) => sum + (t.usage?.input_tokens ?? 0), 0);
  const totalOutputTokens = turns.reduce((sum, t) => sum + (t.usage?.output_tokens ?? 0), 0);

  return {
    model: report.model,
    scenarioCount: report.scenarioCount ?? 0,
    turnCount: turns.length,
    passed,
    failed: turns.length - passed,
    passRate: turns.length ? Math.round((passed / turns.length) * 100) : 0,
    aiTurns,
    fallbacks,
    groundingFails,
    unnecessaryQuestions,
    totalDurationMs,
    avgDurationMs: turns.length ? Math.round(totalDurationMs / turns.length) : 0,
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
  };
}
