import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import EquipmentFeatureSourceModal from './EquipmentFeatureSourceModal.jsx';
import { useLeads } from '../../context/LeadsContext.jsx';
import { ensureSampleEquipmentImportsLoaded } from '../../services/admin/equipmentInspectorPresenter.js';
import {
  markSalesEquipmentReviewCase,
  searchSalesEquipment,
} from '../../services/admin/equipmentSalesSearchService.js';
import { getActiveSalesChanceId } from '../../services/sales/activeSalesChanceStore.js';
import { buildKundenaktePath } from '../../services/leadAkteEntry.js';
import {
  buildNewSalesChanceStarterPayload,
} from '../../services/sales/equipmentOfferTransferService.js';
import './EquipmentSalesSearch.css';

function ModelSuggestionList({ title, models, onSelect }) {
  if (!models?.length) return null;
  return (
    <div className="eq-sales-suggestions" role="region" aria-label={title}>
      <p className="eq-sales-suggestions__title">{title}</p>
      <ul className="eq-sales-suggestions__list">
        {models.map((model) => (
          <li key={model.modelKey}>
            <button
              type="button"
              className="eq-sales-suggestions__btn"
              onClick={() => onSelect(model.modelKey)}
            >
              {model.brand} {model.model}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SalesResultCard({
  result,
  activeLeadId,
  activeLeadName,
  onShowSource,
  onTransferFeedback,
  onTransfer,
}) {
  const [copyMessage, setCopyMessage] = useState('');
  const [transferState, setTransferState] = useState(null);

  async function handleCopyCustomerText() {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(result.customerText);
      } else {
        console.log('[EquipmentSalesSearch] Kundentext', result.customerText);
      }
      setCopyMessage('Kundentext kopiert.');
    } catch {
      setCopyMessage('Kopieren fehlgeschlagen.');
    }
  }

  function handleTransfer(forceUpdate = false) {
    const transferResult = onTransfer(result, { forceUpdate });
    setTransferState(transferResult);
    onTransferFeedback?.(transferResult);
  }

  function handleStartNewChance() {
    const payload = buildNewSalesChanceStarterPayload(result);
    console.log('[equipmentSalesSearch] Neue Verkaufschance mit Wunsch starten', payload);
    setTransferState({
      ok: false,
      code: 'new_chance_stub',
      message: 'Neue Verkaufschance – Stub protokolliert (Payload in Konsole).',
      payload,
    });
  }

  function handleMarkReview() {
    markSalesEquipmentReviewCase({
      query: result.featureQuery,
      modelKey: result.modelEntry.modelKey,
      featureId: result.feature.id,
      featureLabel: result.feature.label,
    });
  }

  const isPending = result.type === 'pending';
  const vehicleLine = `${result.modelEntry.brand} ${result.modelEntry.model}${result.modelYear ? ` · ${result.modelYear}` : ''}`;
  const transferLabel = activeLeadId ? 'Zur Verkaufschance hinzufügen' : 'In Kundenangebot übernehmen';

  return (
    <article className="eq-sales-result" aria-live="polite">
      <header className="eq-sales-result__head">
        <div>
          <h2 className="eq-sales-result__feature">{result.feature.label}</h2>
          <p className="eq-sales-result__model">{vehicleLine}</p>
        </div>
        <span className={`eq-sales-result__status eq-sales-result__status--${isPending ? 'pending' : 'ready'}`}>
          {isPending ? 'Verfügbarkeit wird geprüft' : result.statusHeadline}
        </span>
      </header>

      {activeLeadId && (
        <p className="eq-sales-active-lead">
          Aktive Verkaufschance: <strong>{activeLeadName}</strong>
        </p>
      )}

      {isPending && result.pendingNote && (
        <p className="eq-sales-result__note">{result.pendingNote}</p>
      )}

      {result.trimLines?.length > 0 && (
        <section className="eq-sales-result__availability" aria-label="Verfügbarkeit je Ausstattungslinie">
          <h3 className="eq-sales-result__section-title">Verfügbarkeit</h3>
          <ul className="eq-sales-result__trim-list">
            {result.trimLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="eq-sales-result__actions">
        {result.hasSource ? (
          <button
            type="button"
            className="eq-sales-btn eq-sales-btn--ghost"
            onClick={() => onShowSource(result.sourceDetail)}
          >
            Quelle anzeigen
          </button>
        ) : (
          <span className="eq-sales-muted">Keine Quelle hinterlegt</span>
        )}

        <button
          type="button"
          className="eq-sales-btn eq-sales-btn--primary"
          onClick={handleCopyCustomerText}
        >
          Kundentext kopieren
        </button>

        <button
          type="button"
          className="eq-sales-btn eq-sales-btn--secondary"
          onClick={() => handleTransfer(false)}
        >
          {transferLabel}
        </button>

        {isPending && (
          <button
            type="button"
            className="eq-sales-btn eq-sales-btn--ghost"
            onClick={handleMarkReview}
          >
            Als Prüffall markieren
          </button>
        )}
      </div>

      {!activeLeadId && (
        <div className="eq-sales-no-lead">
          <p className="eq-sales-no-lead__message">Keine Verkaufschance ausgewählt.</p>
          <button
            type="button"
            className="eq-sales-btn eq-sales-btn--ghost"
            onClick={handleStartNewChance}
          >
            Neue Verkaufschance mit diesem Wunsch starten
          </button>
        </div>
      )}

      {transferState?.ok && (
        <p className="eq-sales-success" role="status">
          {transferState.message}
          {activeLeadId && (
            <>
              {' '}
              <Link to={buildKundenaktePath(activeLeadId)} className="eq-sales-link">
                Kundenakte öffnen
              </Link>
            </>
          )}
        </p>
      )}

      {transferState && !transferState.ok && transferState.code === 'duplicate' && (
        <p className="eq-sales-warning" role="status">{transferState.message}</p>
      )}

      {transferState && !transferState.ok && transferState.code === 'variant_conflict' && (
        <div className="eq-sales-warning-panel" role="status">
          <p>{transferState.message}</p>
          <button
            type="button"
            className="eq-sales-btn eq-sales-btn--ghost"
            onClick={() => handleTransfer(true)}
          >
            Aktualisieren
          </button>
        </div>
      )}

      {transferState && !transferState.ok && transferState.code === 'new_chance_stub' && (
        <p className="eq-sales-muted" role="status">{transferState.message}</p>
      )}

      {copyMessage && <p className="eq-sales-hint" role="status">{copyMessage}</p>}
    </article>
  );
}

export default function EquipmentSalesSearch() {
  const { leads, transferEquipmentWish, getLead } = useLeads();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [sourceDetail, setSourceDetail] = useState(null);
  const [selectedModelKey, setSelectedModelKey] = useState(null);
  const [activeLeadId, setActiveLeadId] = useState(() => getActiveSalesChanceId());
  const [toast, setToast] = useState('');

  const activeLead = useMemo(
    () => (activeLeadId ? getLead(activeLeadId) : null),
    [activeLeadId, getLead, leads],
  );

  useEffect(() => {
    ensureSampleEquipmentImportsLoaded();
    setActiveLeadId(getActiveSalesChanceId());
  }, []);

  function runSearch(searchQuery, modelKey = selectedModelKey) {
    const next = searchSalesEquipment(searchQuery, modelKey ? { modelKey } : {});
    setResult(next);
    setSourceDetail(null);
  }

  function handleSubmit(event) {
    event.preventDefault();
    runSearch(query.trim());
  }

  function handleModelPick(modelKey) {
    setSelectedModelKey(modelKey);
    runSearch(query.trim(), modelKey);
  }

  function handleTransfer(salesResult, options = {}) {
    const leadId = getActiveSalesChanceId() ?? activeLeadId;
    if (!leadId) {
      return {
        ok: false,
        code: 'no_lead',
        message: 'Keine Verkaufschance ausgewählt.',
      };
    }
    const transferResult = transferEquipmentWish(leadId, salesResult, options);
    if (transferResult.ok) {
      setToast(transferResult.message);
    }
    return transferResult;
  }

  return (
    <div className="eq-sales">
      <header className="eq-sales__header">
        <p className="eq-sales__kicker">Fahrzeuge</p>
        <h1 className="eq-sales__title">Ausstattung prüfen</h1>
        <p className="eq-sales__lead">
          Suchen Sie Modell und Ausstattung – Clever zeigt Variante, Paket und Quelle.
        </p>
      </header>

      {toast && <p className="eq-sales-success eq-sales-success--global" role="status">{toast}</p>}

      <form className="eq-sales-search" onSubmit={handleSubmit}>
        <label className="eq-sales-search__label" htmlFor="eq-sales-query">
          Suche
        </label>
        <div className="eq-sales-search__row">
          <input
            id="eq-sales-query"
            type="search"
            className="eq-sales-search__input"
            placeholder="z. B. EV3 Head-up, BYD Seal U Beifahrersitz elektrisch, Sportage Anhängelast…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedModelKey(null);
            }}
            autoComplete="off"
          />
          <button type="submit" className="eq-sales-btn eq-sales-btn--primary">
            Prüfen
          </button>
        </div>
      </form>

      {result?.type === 'empty' && (
        <p className="eq-sales-muted">Bitte Modell und Ausstattung eingeben.</p>
      )}

      {result?.type === 'not_recognized' && (
        <p className="eq-sales-empty" role="status">
          Keine passende Ausstattung erkannt. Bitte Begriff anpassen oder Modell ergänzen.
        </p>
      )}

      {result?.type === 'needs_model' && (
        <div className="eq-sales-panel">
          <p className="eq-sales-panel__message">{result.message}</p>
          {result.feature && (
            <p className="eq-sales-muted">
              Erkanntes Feature: <strong>{result.feature.label}</strong>
            </p>
          )}
          <ModelSuggestionList
            title="Modell wählen"
            models={result.modelSuggestions}
            onSelect={handleModelPick}
          />
        </div>
      )}

      {result?.type === 'ambiguous_model' && (
        <div className="eq-sales-panel">
          {result.feature && (
            <p className="eq-sales-muted">
              Feature: <strong>{result.feature.label}</strong>
            </p>
          )}
          <ModelSuggestionList
            title={result.message}
            models={result.modelSuggestions}
            onSelect={handleModelPick}
          />
        </div>
      )}

      {result?.type === 'ambiguous_feature' && (
        <div className="eq-sales-panel">
          <p className="eq-sales-panel__message">Mehrere Ausstattungen passen – bitte genauer formulieren.</p>
          <ul className="eq-sales-suggestions__list">
            {result.suggestions?.map((feature) => (
              <li key={feature.id}>
                <span className="eq-sales-muted">{feature.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(result?.type === 'match' || result?.type === 'pending') && (
        <SalesResultCard
          result={result}
          activeLeadId={activeLeadId}
          activeLeadName={activeLead?.contact?.name ?? 'Kunde'}
          onShowSource={setSourceDetail}
          onTransfer={handleTransfer}
        />
      )}

      {sourceDetail && (
        <EquipmentFeatureSourceModal
          detail={sourceDetail}
          onClose={() => setSourceDetail(null)}
        />
      )}
    </div>
  );
}
