import { useCallback, useEffect, useState } from 'react';
import {
  isCleverSellerCopilotClientEnabled,
  requestCleverSellerCopilot,
} from '../../services/clever/intelligence/cleverSharedIntelligenceClient.js';
import CleverTurnFeedback from './CleverTurnFeedback.jsx';
import './CustomerAkteCleverCopilot.css';

const QUICK_PROMPTS = [
  'Was sucht der Kunde genau?',
  'Was fehlt noch für ein Angebot?',
  'Welche Variante passt?',
  'Schreibe eine kurze WhatsApp zum Angebot.',
  'Fasse den Kunden zusammen',
];

/**
 * Kompakte Clever-Karte in der Kundenakte (Seller Copilot).
 */
export default function CustomerAkteCleverCopilot({
  lead,
  dealerId = null,
  sellerId = null,
  onOpenOffer = null,
  onUseDraft = null,
}) {
  const enabled = isCleverSellerCopilotClientEnabled();
  const [askOpen, setAskOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState(null);

  const loadSummary = useCallback(async (forceRefresh = false) => {
    if (!enabled || !lead) return;
    setBusy(true);
    setError(null);
    try {
      const data = await requestCleverSellerCopilot({
        lead,
        leadId: lead.id,
        dealerId,
        sellerId,
        forceRefresh,
        needProfile: lead?.crm?.needProfile ?? null,
        sellerInsights: lead?.crm?.sellerInsights ?? [],
      });
      if (!data.ok) throw new Error(data.error ?? 'copilot_failed');
      setPayload(data);
    } catch (err) {
      setError(err?.message ?? 'Clever nicht erreichbar');
    } finally {
      setBusy(false);
    }
  }, [enabled, lead, dealerId, sellerId]);

  useEffect(() => {
    loadSummary(false);
  }, [loadSummary]);

  async function askClever(message) {
    const text = String(message ?? query).trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const data = await requestCleverSellerCopilot({
        lead,
        leadId: lead?.id,
        dealerId,
        sellerId,
        userMessage: text,
        forceRefresh: true,
      });
      if (!data.ok) throw new Error(data.error ?? 'copilot_failed');
      setPayload(data);
      setAskOpen(false);
      setQuery('');
    } catch (err) {
      setError(err?.message ?? 'Frage fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) return null;

  const result = payload?.copilotResult;
  const hint = payload?.nextStepHint;
  const summary = result?.customerSummary
    || result?.answer
    || hint?.text
    || (busy ? 'Clever lädt …' : 'Noch keine Zusammenfassung.');

  return (
    <section className="cust-clever-copilot" aria-labelledby="cust-clever-copilot-title">
      <header className="cust-clever-copilot__head">
        <h2 id="cust-clever-copilot-title">Clever</h2>
        {payload?.fromCache && <span className="cust-clever-copilot__badge">Cache</span>}
        {payload?.fallback && <span className="cust-clever-copilot__badge">Fallback</span>}
      </header>

      <p className="cust-clever-copilot__summary">{summary}</p>

      {(result?.openPoints ?? []).length > 0 && (
        <ul className="cust-clever-copilot__open">
          {result.openPoints.map((point) => (
            <li key={`${point.field}-${point.label}`}>
              <strong>{point.label}</strong>
              <span>{point.reason}</span>
            </li>
          ))}
        </ul>
      )}

      {hint?.title && (
        <div className="cust-clever-copilot__nbs">
          <p className="cust-clever-copilot__nbs-label">Nächster guter Schritt</p>
          <p className="cust-clever-copilot__nbs-title">{hint.title}</p>
          {hint.reason && <p className="cust-clever-copilot__nbs-reason">{hint.reason}</p>}
        </div>
      )}

      <div className="cust-clever-copilot__actions">
        {hint?.handlerType === 'offer' && (
          <button type="button" onClick={() => onOpenOffer?.(result)}>
            Angebot öffnen
          </button>
        )}
        {result?.draft?.body && (
          <button
            type="button"
            onClick={() => onUseDraft?.(result.draft)}
            disabled={result.requiresSellerConfirmation !== true}
          >
            Antwort erstellen
          </button>
        )}
        <button type="button" onClick={() => setAskOpen((v) => !v)}>
          Clever fragen
        </button>
        <button type="button" className="cust-clever-copilot__ghost" onClick={() => loadSummary(true)} disabled={busy}>
          Aktualisieren
        </button>
      </div>

      {result?.draft?.body && (
        <div className="cust-clever-copilot__draft">
          <p className="cust-clever-copilot__draft-label">
            Entwurf ({result.draft.channel ?? 'Nachricht'}) – nicht gesendet
          </p>
          {result.draft.subject && <p><strong>{result.draft.subject}</strong></p>}
          <pre>{result.draft.body}</pre>
          <div className="cust-clever-copilot__draft-actions">
            <button type="button" onClick={() => onUseDraft?.(result.draft, 'accept')}>
              Entwurf übernehmen
            </button>
            <button type="button" onClick={() => onUseDraft?.(result.draft, 'edit')}>
              Bearbeiten
            </button>
            <button type="button" onClick={() => onUseDraft?.(null, 'discard')}>
              Verwerfen
            </button>
          </div>
        </div>
      )}

      {askOpen && (
        <div className="cust-clever-copilot__ask">
          <div className="cust-clever-copilot__prompts">
            {QUICK_PROMPTS.map((prompt) => (
              <button key={prompt} type="button" onClick={() => askClever(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              askClever(query);
            }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Clever fragen …"
              aria-label="Clever fragen"
            />
            <button type="submit" disabled={busy}>Senden</button>
          </form>
        </div>
      )}

      {error && <p className="cust-clever-copilot__error">{error}</p>}

      {result?.answer && (
        <CleverTurnFeedback
          conversationId={lead?.id ?? null}
          turnId={`seller-copilot-${payload?.snapshotId ?? 'x'}`}
          originalCustomerMessage={query || 'Seller copilot'}
          originalCleverReply={result.answer}
        />
      )}
    </section>
  );
}
