/**
 * Browser-Client für Shared Clever Intelligence.
 */

const API_BASE = '/api/v1';

export function isCleverLexiconAiClientEnabled() {
  return import.meta.env.VITE_CLEVER_LEXICON_AI_ENABLED === 'true';
}

export function isCleverSellerCopilotClientEnabled() {
  return import.meta.env.VITE_CLEVER_SELLER_COPILOT_ENABLED === 'true';
}

export function isCleverSellerOpenAiInterpretClientEnabled() {
  return import.meta.env.VITE_CLEVER_SELLER_OPENAI_INTERPRET_ENABLED === 'true';
}

/**
 * Lead für Seller-Turn API verkleinern (kein Full-History / Kontakt-Dump).
 * Server slimt zusätzlich – Client vermeidet 413 / stringify-Hänger.
 */
export function slimLeadForSellerTurnClient(lead = null) {
  if (!lead || typeof lead !== 'object') return {};
  const working = lead.crm?.cleverWorkingState || null;
  return {
    id: lead.id ?? null,
    paymentType: lead.paymentType ?? null,
    crm: {
      needProfile: lead.crm?.needProfile ?? null,
      sellerInsights: (lead.crm?.sellerInsights ?? []).slice(-8).map((insight) => ({
        text: String(insight?.text ?? '').slice(0, 400),
        labels: (insight?.understoodLabels ?? insight?.labels ?? []).slice(0, 8),
        context: insight?.context ?? null,
      })),
      ...(working ? {
        cleverWorkingState: {
          currentOfferDraftId: working.currentOfferDraftId ?? null,
          currentOfferDraft: working.currentOfferDraft ?? null,
          recentVehicleTrackIds: Array.isArray(working.recentVehicleTrackIds)
            ? working.recentVehicleTrackIds.slice(0, 8)
            : [],
          recentVehicleModelKeys: Array.isArray(working.recentVehicleModelKeys)
            ? working.recentVehicleModelKeys.slice(0, 8)
            : [],
        },
      } : {}),
    },
  };
}

/**
 * UI-Routing: freier Clever-Input → Server-Interpret (Semantic-First).
 * Browser hat keinen API-Key; komplexer Multi-Source bleibt eingeschlossen.
 */
export async function shouldRequestServerSellerTurn({
  sellerInput = '',
  attachments = [],
  facts = [],
  appContext = null,
  workingContext = null,
  forceSemanticFirst = true,
} = {}) {
  if (!isCleverSellerOpenAiInterpretClientEnabled()) return false;
  const text = String(sellerInput || '').trim();
  if (text.length < 3) return false;

  // Produkt: freier Clever-Composer nutzt Server-LLM als Primärpfad
  if (forceSemanticFirst) return true;

  const { shouldUseSemanticInterpreter } = await import(
    '../../cleverSeller/multiSource/evaluateComplexSellerTurn.js'
  );
  return shouldUseSemanticInterpreter({
    sellerInput,
    attachments,
    facts,
    appContext,
    workingContext,
  }).use;
}

export function isCleverMagicMessageClientEnabled() {
  return import.meta.env.VITE_CLEVER_MAGIC_MESSAGE_ENABLED === 'true'
    || import.meta.env.VITE_CLEVER_SELLER_COPILOT_ENABLED === 'true';
}

/**
 * Grounded Magic Message (Server).
 * @param {object} payload
 */
export async function requestCleverMagicMessage(payload = {}) {
  const response = await fetch(`${API_BASE}/clever/magic-message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(payload.sellerId ? { 'X-Seller-Id': String(payload.sellerId) } : {}),
      ...(payload.dealerId ? { 'X-Dealer-Id': String(payload.dealerId) } : {}),
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, error: data.error ?? 'request_failed' };
  }
  return data;
}

/**
 * @param {object} payload
 */
export async function requestCleverLexiconQuery(payload = {}) {
  const response = await fetch(`${API_BASE}/clever/lexicon-query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok && !data.searchState) {
    return { ok: false, error: data.error ?? 'request_failed' };
  }
  return data;
}

/**
 * @param {object} payload
 */
export async function requestCleverSellerCopilot(payload = {}) {
  const response = await fetch(`${API_BASE}/clever/seller-copilot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(payload.sellerId ? { 'X-Seller-Id': String(payload.sellerId) } : {}),
      ...(payload.dealerId ? { 'X-Dealer-Id': String(payload.dealerId) } : {}),
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, error: data.error ?? 'request_failed' };
  }
  return data;
}

/**
 * Screenshot/WhatsApp Vision-Interpret (Server – kein Browser-API-Key).
 * @param {{ imageBase64?: string, mimeType?: string, fileName?: string, sellerId?: string, dealerId?: string }} payload
 */
export async function requestCleverScreenshotInterpret(payload = {}) {
  const response = await fetch(`${API_BASE}/clever/screenshot-interpret`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(payload.sellerId ? { 'X-Seller-Id': String(payload.sellerId) } : {}),
      ...(payload.dealerId ? { 'X-Dealer-Id': String(payload.dealerId) } : {}),
    },
    body: JSON.stringify({
      imageBase64: payload.imageBase64,
      mimeType: payload.mimeType || 'image/jpeg',
      fileName: payload.fileName || 'screenshot.jpg',
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, error: data.error ?? 'request_failed', softAttach: true };
  }
  return data;
}

/**
 * Universal Seller Turn inkl. optionaler OpenAI-Eskalation (Server).
 * @param {object} payload
 * @param {{ timeoutMs?: number }} [opts]
 */
export async function requestCleverSellerTurn(payload = {}, opts = {}) {
  const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : 45000;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;
  let response;
  try {
    response = await fetch(`${API_BASE}/clever/seller-turn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(payload.sellerId ? { 'X-Seller-Id': String(payload.sellerId) } : {}),
        ...(payload.dealerId ? { 'X-Dealer-Id': String(payload.dealerId) } : {}),
      },
      body: JSON.stringify({
        ...payload,
        lead: slimLeadForSellerTurnClient(payload.lead),
      }),
      ...(controller ? { signal: controller.signal } : {}),
    });
  } catch (err) {
    const aborted = err?.name === 'AbortError';
    return {
      ok: false,
      error: aborted ? 'timeout' : 'network_error',
      message: aborted
        ? 'Semantische Interpretation dauert zu lange.'
        : 'Seller-Turn nicht erreichbar.',
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, error: data.error ?? 'request_failed', message: data.message || null };
  }
  return data;
}

/**
 * @param {object} payload
 */
export async function requestLexiconTransfer(payload = {}) {
  const response = await fetch(`${API_BASE}/clever/lexicon-transfer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(payload.sellerId ? { 'X-Seller-Id': String(payload.sellerId) } : {}),
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, error: data.error ?? 'request_failed' };
  }
  return data;
}
