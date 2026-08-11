/**
 * Clever 2.0 – Progress-Hints nur bei langen Jobs.
 * Schnelle Turns bleiben still (kein „Clever arbeitet…“-Spam).
 */

export const CLEVER_LONG_JOB = Object.freeze({
  AGENT: 'agent',
  PDF_OCR: 'pdf_ocr',
  SCREENSHOT_OCR: 'screenshot_ocr',
  SERVER_INTERPRET: 'server_interpret',
  MAGIC_PROPOSE: 'magic_propose',
});

/** Erst nach dieser Verzögerung sichtbar – schnelle Jobs bleiben still. */
export const CLEVER_PROGRESS_HINT_DELAY_MS = 1000;

const HINT_BY_KIND = Object.freeze({
  [CLEVER_LONG_JOB.AGENT]: 'Clever denkt nach …',
  [CLEVER_LONG_JOB.PDF_OCR]: 'PDF wird gelesen …',
  [CLEVER_LONG_JOB.SCREENSHOT_OCR]: 'Screenshot wird gelesen …',
  // Home-Intake: kein „Clever wertet aus“-Spam – stille Wartezeit
  [CLEVER_LONG_JOB.SERVER_INTERPRET]: null,
  [CLEVER_LONG_JOB.MAGIC_PROPOSE]: 'Nachricht wird vorbereitet …',
});

/**
 * @param {string|null|undefined} jobKind
 * @returns {string|null}
 */
export function resolveCleverProgressHint(jobKind) {
  const key = String(jobKind || '').trim();
  if (!key) return null;
  return HINT_BY_KIND[key] || null;
}

/**
 * @param {string|null|undefined} jobKind
 */
export function isCleverLongJob(jobKind) {
  return Boolean(resolveCleverProgressHint(jobKind));
}

/**
 * Delayed Progress-Hint Controller (UI-agnostisch).
 * @param {{ setHint?: (text: string|null) => void, delayMs?: number }} opts
 */
export function createProgressHintScheduler({
  setHint = null,
  delayMs = CLEVER_PROGRESS_HINT_DELAY_MS,
} = {}) {
  let timer = null;

  function clearTimer() {
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  return {
    /**
     * Startet langen Job – Hint erst nach Delay.
     * Unbekannte / kurze Jobs → still.
     * @param {string|null|undefined} jobKind
     */
    start(jobKind) {
      clearTimer();
      if (typeof setHint === 'function') setHint(null);
      const text = resolveCleverProgressHint(jobKind);
      if (!text || typeof setHint !== 'function') return;
      const wait = Math.max(0, Number(delayMs) || 0);
      timer = setTimeout(() => {
        timer = null;
        setHint(text);
      }, wait);
    },

    /** Sofort still – nach Abschluss / Fehler. */
    clear() {
      clearTimer();
      if (typeof setHint === 'function') setHint(null);
    },
  };
}
