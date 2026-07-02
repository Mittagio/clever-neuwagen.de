import { useEffect, useMemo, useState } from 'react';
import {
  assignUnknownFeatureMapping,
  buildFeatureSourceDetailFromRow,
  buildFeatureSourceDetailFromSearch,
  canShowSourceForRow,
  ensureSampleEquipmentImportsLoaded,
  getQualityBadgeLabel,
  getQualityBadgeTone,
  ignoreInspectorUnknownFeature,
  inspectFeatureSearch,
  INSPECTOR_DEMO_MODELS,
  loadInspectorModelContext,
  markProfileAsVerified,
  searchGlobalFeaturesForMapping,
  STATUS_LABELS,
} from '../../services/admin/equipmentInspectorPresenter.js';
import EquipmentFeatureSourceModal from './EquipmentFeatureSourceModal.jsx';
import './EquipmentDataInspector.css';

function QualityBadge({ qualityStatus }) {
  const label = getQualityBadgeLabel(qualityStatus);
  const tone = getQualityBadgeTone(qualityStatus);
  return (
    <span className={`eq-inspector-quality-badge eq-inspector-quality-badge--${tone}`}>
      {label}
    </span>
  );
}

function SeverityBadge({ severity }) {
  return (
    <span className={`eq-inspector-severity eq-inspector-severity--${severity}`}>
      {severity}
    </span>
  );
}

function ReviewItemRow({ item, modelKey, onChanged }) {
  const [mapOpen, setMapOpen] = useState(false);

  function handleIgnore() {
    if (item.rawLabel) {
      ignoreInspectorUnknownFeature(modelKey, item.rawLabel);
      onChanged({ message: `${item.label} wurde ignoriert.` });
      return;
    }
    console.log('[EquipmentDataInspector] mark_verified stub', item);
    onChanged({ message: `Prüfpunkt „${item.label}“ – als geprüft markieren (Stub).` });
  }

  function handleMarkVerified() {
    console.log('[EquipmentDataInspector] mark_verified stub', item);
    onChanged({ message: `Prüfpunkt „${item.label}“ – als geprüft markieren (Stub).` });
  }

  const sourceDocument = typeof item.sourceRef === 'string'
    ? item.sourceRef
    : item.sourceRef?.document;

  return (
    <li className="eq-inspector-review-item">
      <div className="eq-inspector-review-item__main">
        <strong>{item.label}</strong>
        {item.featureId && <code>{item.featureId}</code>}
        <span className="eq-inspector-muted">{item.reason}</span>
        <SeverityBadge severity={item.severity} />
        {sourceDocument && <span className="eq-inspector-muted">Quelle: {sourceDocument}</span>}
        {item.sourceRef?.rawText && (
          <span className="eq-inspector-raw">rawText: {item.sourceRef.rawText}</span>
        )}
      </div>
      <div className="eq-inspector-unknown__actions">
        {item.action === 'map' && item.rawLabel && (
          <button
            type="button"
            className="eq-inspector-btn eq-inspector-btn--ghost"
            onClick={() => setMapOpen((open) => !open)}
          >
            Feature zuordnen
          </button>
        )}
        {item.action === 'map' && item.rawLabel && (
          <button type="button" className="eq-inspector-btn eq-inspector-btn--ghost" onClick={handleIgnore}>
            Ignorieren
          </button>
        )}
        {item.action !== 'map' && (
          <button type="button" className="eq-inspector-btn eq-inspector-btn--ghost" onClick={handleMarkVerified}>
            Als geprüft markieren
          </button>
        )}
      </div>
      {mapOpen && item.rawLabel && (
        <UnknownFeatureMapPanel
          item={{ rawLabel: item.rawLabel, ...item }}
          modelKey={modelKey}
          onSaved={(result) => {
            setMapOpen(false);
            onChanged(result);
          }}
        />
      )}
    </li>
  );
}

function StatusBadge({ status }) {
  const label = STATUS_LABELS[status] ?? status;
  return (
    <span className={`eq-inspector-status eq-inspector-status--${status ?? 'unknown'}`}>
      {label}
    </span>
  );
}

function MetaItem({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <div className="eq-inspector-meta__item">
      <span className="eq-inspector-meta__label">{label}</span>
      <span className="eq-inspector-meta__value">{value}</span>
    </div>
  );
}

function CreateFeatureStubModal({ item, onClose }) {
  return (
    <div className="eq-inspector-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="eq-inspector-modal"
        role="dialog"
        aria-labelledby="eq-inspector-create-feature-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="eq-inspector-create-feature-title" className="eq-inspector-modal__title">
          Neues Feature anlegen
        </h3>
        <p className="eq-inspector-muted">
          Rohbegriff: <strong>{item.rawLabel}</strong>
        </p>
        <div className="eq-inspector-form-grid">
          <label>
            id
            <input type="text" disabled placeholder="z. B. v2l" />
          </label>
          <label>
            label
            <input type="text" disabled placeholder="z. B. V2L / Vehicle-to-Load" />
          </label>
          <label>
            category
            <input type="text" disabled placeholder="z. B. Elektro & Laden" />
          </label>
          <label className="eq-inspector-form-grid__full">
            synonyms
            <input type="text" disabled placeholder="kommagetrennt" />
          </label>
          <label className="eq-inspector-form-grid__full">
            tags
            <input type="text" disabled placeholder="kommagetrennt" />
          </label>
          <label className="eq-inspector-form-grid__checkbox">
            <input type="checkbox" disabled />
            showAsChip
          </label>
          <label className="eq-inspector-form-grid__checkbox">
            <input type="checkbox" disabled defaultChecked />
            searchable
          </label>
          <label className="eq-inspector-form-grid__checkbox">
            <input type="checkbox" disabled defaultChecked />
            advisorRelevant
          </label>
        </div>
        <p className="eq-inspector-hint">
          Noch nicht aktiv – später Backend-Funktion
        </p>
        <div className="eq-inspector-modal__actions">
          <button type="button" className="eq-inspector-btn eq-inspector-btn--ghost" onClick={onClose}>
            Schließen
          </button>
          <button type="button" className="eq-inspector-btn eq-inspector-btn--primary" disabled>
            Noch nicht aktiv – später Backend-Funktion
          </button>
        </div>
      </div>
    </div>
  );
}

function UnknownFeatureMapPanel({ item, modelKey, onSaved }) {
  const [query, setQuery] = useState('');
  const [selectedFeatureId, setSelectedFeatureId] = useState('');

  const options = useMemo(
    () => searchGlobalFeaturesForMapping(query),
    [query],
  );

  function handleSave() {
    if (!selectedFeatureId) return;
    const result = assignUnknownFeatureMapping(modelKey, item.rawLabel, selectedFeatureId);
    if (result) onSaved(result);
  }

  return (
    <div className="eq-inspector-map-panel">
      <label className="eq-inspector-map-panel__label" htmlFor={`map-search-${item.rawLabel}`}>
        Globales Feature suchen
      </label>
      <input
        id={`map-search-${item.rawLabel}`}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Label, ID oder Synonym… z. B. v2l"
        className="eq-inspector-map-panel__search"
      />
      <div className="eq-inspector-map-panel__list" role="listbox" aria-label="Feature-Auswahl">
        {options.length === 0 ? (
          <p className="eq-inspector-empty">Kein Treffer.</p>
        ) : (
          options.map((feature) => (
            <button
              key={feature.id}
              type="button"
              role="option"
              aria-selected={selectedFeatureId === feature.id}
              className={`eq-inspector-map-panel__option${selectedFeatureId === feature.id ? ' is-selected' : ''}`}
              onClick={() => setSelectedFeatureId(feature.id)}
            >
              <strong>{feature.label}</strong>
              <code>{feature.id}</code>
              <span className="eq-inspector-muted">{feature.category}</span>
            </button>
          ))
        )}
      </div>
      <button
        type="button"
        className="eq-inspector-btn eq-inspector-btn--primary"
        disabled={!selectedFeatureId}
        onClick={handleSave}
      >
        Zuordnung speichern
      </button>
    </div>
  );
}

function UnknownFeatureActions({ item, modelKey, onChanged }) {
  const [mapOpen, setMapOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  function handleSaved(result) {
    setMapOpen(false);
    onChanged(result);
  }

  function handleIgnore() {
    ignoreInspectorUnknownFeature(modelKey, item.rawLabel);
    onChanged({ message: `${item.rawLabel} wurde ignoriert.` });
  }

  return (
    <div className="eq-inspector-unknown__actions-wrap">
      <div className="eq-inspector-unknown__actions">
        <button
          type="button"
          className="eq-inspector-btn eq-inspector-btn--ghost"
          onClick={() => {
            setMapOpen((open) => !open);
            setCreateOpen(false);
          }}
        >
          Feature zuordnen
        </button>
        <button
          type="button"
          className="eq-inspector-btn eq-inspector-btn--ghost"
          onClick={() => {
            setCreateOpen(true);
            setMapOpen(false);
          }}
        >
          Als neues Feature anlegen
        </button>
        <button type="button" className="eq-inspector-btn eq-inspector-btn--ghost" onClick={handleIgnore}>
          Ignorieren
        </button>
      </div>
      {mapOpen && (
        <UnknownFeatureMapPanel item={item} modelKey={modelKey} onSaved={handleSaved} />
      )}
      {createOpen && (
        <CreateFeatureStubModal item={item} onClose={() => setCreateOpen(false)} />
      )}
    </div>
  );
}

export default function EquipmentDataInspector() {
  const [modelKey, setModelKey] = useState(INSPECTOR_DEMO_MODELS[0].modelKey);
  const [featureQuery, setFeatureQuery] = useState('');
  const [searchTick, setSearchTick] = useState(0);
  const [aliasRefreshTick, setAliasRefreshTick] = useState(0);
  const [aliasMessage, setAliasMessage] = useState('');
  const [sourceDetail, setSourceDetail] = useState(null);

  useEffect(() => {
    ensureSampleEquipmentImportsLoaded();
  }, []);

  const ctx = useMemo(
    () => loadInspectorModelContext(modelKey),
    [modelKey, aliasRefreshTick],
  );

  const searchResult = useMemo(() => {
    if (!featureQuery.trim()) return null;
    return inspectFeatureSearch(featureQuery, ctx.brand, ctx.model, ctx.modelKey);
  }, [featureQuery, ctx.brand, ctx.model, ctx.modelKey, searchTick]);

  function handleSearchSubmit(event) {
    event.preventDefault();
    setSearchTick((n) => n + 1);
  }

  function handleAliasChanged(result) {
    setAliasMessage(result?.message ?? '');
    setAliasRefreshTick((n) => n + 1);
  }

  function handleMarkProfileVerified() {
    markProfileAsVerified(ctx.modelKey, ctx.modelYear);
    setAliasMessage('Modell manuell als geprüft markiert.');
    setAliasRefreshTick((n) => n + 1);
  }

  function openSourceForRow(row) {
    setSourceDetail(buildFeatureSourceDetailFromRow({
      row,
      context: ctx,
      reviewItems: ctx.openReviewItems,
    }));
  }

  function openSourceForSearch() {
    if (!searchResult || searchResult.type !== 'match') return;
    setSourceDetail(buildFeatureSourceDetailFromSearch(searchResult, ctx));
  }

  return (
    <div className="eq-inspector backend-sections" data-internal-view="equipment-data-inspector">
      <header className="eq-inspector__header">
        <div>
          <p className="eq-inspector__kicker">Intern · Debug</p>
          <h1 className="eq-inspector__title">Ausstattungsdaten prüfen</h1>
          <p className="eq-inspector__lead">
            Import-Profile, Quellen und Feature-Verfügbarkeiten – nur für Händler/Admin, nicht für Kunden.
          </p>
        </div>
        <div className="eq-inspector__model-select">
          <label htmlFor="eq-inspector-model">Modell</label>
          <select
            id="eq-inspector-model"
            value={modelKey}
            onChange={(e) => setModelKey(e.target.value)}
          >
            {INSPECTOR_DEMO_MODELS.map((m) => (
              <option key={m.modelKey} value={m.modelKey}>
                {m.brand} {m.model}
              </option>
            ))}
          </select>
        </div>
      </header>

      {aliasMessage && (
        <p className="eq-inspector-success" role="status">{aliasMessage}</p>
      )}

      {sourceDetail && (
        <EquipmentFeatureSourceModal
          detail={sourceDetail}
          onClose={() => setSourceDetail(null)}
        />
      )}

      <section className="eq-inspector-card" aria-label="Import-Profil">
        <div className="eq-inspector-card__head">
          <h2 className="eq-inspector-card__title">Import-Profil</h2>
          <button
            type="button"
            className="eq-inspector-btn eq-inspector-btn--ghost"
            onClick={handleMarkProfileVerified}
          >
            Modell als geprüft markieren
          </button>
        </div>

        <div className="eq-inspector-quality-summary">
          <div className="eq-inspector-quality-summary__badge">
            <span className="eq-inspector-meta__label">Qualität</span>
            <QualityBadge qualityStatus={ctx.quality?.qualityStatus} />
            <span className="eq-inspector-muted">
              {ctx.quality?.openReviewCount ?? 0} offene Punkte
            </span>
            {ctx.quality?.overrideNote && (
              <span className="eq-inspector-hint">{ctx.quality.overrideNote}</span>
            )}
          </div>
          <div className="eq-inspector-quality-stats">
            <MetaItem label="Bestätigte Features" value={ctx.quality?.confirmedFeatureCount} />
            <MetaItem label="Unbekannte (offen)" value={ctx.quality?.unknownFeatureCount} />
            <MetaItem label="Ignoriert" value={ctx.quality?.ignoredFeatureCount} />
            <MetaItem label="manual_verified Mappings" value={ctx.quality?.manualVerifiedMappingCount} />
          </div>
        </div>

        <div className="eq-inspector-meta">
          <MetaItem label="Marke" value={ctx.brand} />
          <MetaItem label="Modell" value={ctx.model} />
          <MetaItem label="modelKey" value={ctx.modelKey} />
          <MetaItem label="Modelljahr" value={ctx.modelYear} />
          <MetaItem label="Datenherkunft" value={ctx.profileOrigin?.label ?? ctx.dataOrigin} />
          <MetaItem label="Import-Datei" value={ctx.profileOrigin?.importFile} />
          <MetaItem label="Quelle (type)" value={ctx.profileOrigin?.sourceType ?? ctx.source?.type} />
          <MetaItem label="Dokument" value={ctx.source?.documentName} />
          <MetaItem label="Gültig ab" value={ctx.source?.validFrom} />
          <MetaItem label="Confidence" value={ctx.source?.confidence} />
        </div>
      </section>

      <section className="eq-inspector-card" aria-label="Offene Prüfpunkte">
        <h2 className="eq-inspector-card__title">Offene Prüfpunkte</h2>
        {ctx.openReviewItems.length === 0 ? (
          <p className="eq-inspector-empty">Keine offenen Prüfpunkte – Profil wirkt vollständig geprüft.</p>
        ) : (
          <ul className="eq-inspector-review-list">
            {ctx.openReviewItems.map((item) => (
              <ReviewItemRow
                key={item.id}
                item={item}
                modelKey={ctx.modelKey}
                onChanged={handleAliasChanged}
              />
            ))}
          </ul>
        )}
      </section>

      {ctx.technicalDataGaps?.length > 0 && (
        <section className="eq-inspector-card" aria-label="Technische Daten">
          <h2 className="eq-inspector-card__title">Technische Daten (Preisliste)</h2>
          <ul className="eq-inspector-review-list">
            {ctx.technicalDataGaps.map((gap) => (
              <li key={`${gap.attribute}-${gap.status}`} className="eq-inspector-review-item">
                <strong>{gap.attribute}</strong>
                <span className="eq-inspector-muted">
                  {gap.status === 'verified' ? 'geprüft' : 'Prüfung nötig'}
                  {gap.value ? ` · ${gap.value}` : ''}
                  {gap.noseWeight ? ` · Stützlast ${gap.noseWeight} kg` : ''}
                </span>
                {gap.source && gap.source !== 'keine' && (
                  <span className="eq-inspector-hint">Quelle: {gap.source}</span>
                )}
                {gap.note && <span className="eq-inspector-hint">{gap.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="eq-inspector-grid">
        <section className="eq-inspector-card" aria-label="Ausstattungslinien">
          <h2 className="eq-inspector-card__title">Ausstattungslinien</h2>
          {ctx.trims.length === 0 ? (
            <p className="eq-inspector-empty">Keine Trims hinterlegt.</p>
          ) : (
            <ul className="eq-inspector-list">
              {ctx.trims.map((trim) => (
                <li key={trim.id}>
                  <strong>{trim.name}</strong>
                  <span className="eq-inspector-muted">{trim.id}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="eq-inspector-card" aria-label="Pakete">
          <h2 className="eq-inspector-card__title">Pakete</h2>
          {ctx.packages.length === 0 ? (
            <p className="eq-inspector-empty">Keine Pakete hinterlegt.</p>
          ) : (
            <ul className="eq-inspector-list">
              {ctx.packages.map((pkg) => (
                <li key={pkg.id}>
                  <strong>{pkg.name}</strong>
                  <span className="eq-inspector-muted">{pkg.id}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="eq-inspector-card" aria-label="Feature-Verfügbarkeiten">
        <h2 className="eq-inspector-card__title">Feature-Verfügbarkeiten</h2>
        {ctx.featureRows.length === 0 ? (
          <p className="eq-inspector-empty">Keine importierten Feature-Verfügbarkeiten für dieses Modell.</p>
        ) : (
          <div className="eq-inspector-table-wrap">
            <table className="eq-inspector-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>featureId</th>
                  <th>Trim</th>
                  <th>Status</th>
                  <th>Paket</th>
                  <th>Conf.</th>
                  <th>Quelle</th>
                  <th>Abschnitt</th>
                  <th>Seite</th>
                  <th>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {ctx.featureRows.map((row) => (
                  <tr key={`${row.featureId}-${row.trimId}-${row.status}`}>
                    <td>{row.featureLabel}</td>
                    <td><code>{row.featureId}</code></td>
                    <td>{row.trimName}</td>
                    <td><StatusBadge status={row.status} /></td>
                    <td>{row.packageName ?? '—'}</td>
                    <td>{row.confidence}</td>
                    <td>{row.sourceDocument ?? '—'}</td>
                    <td>{row.sourceSection ?? '—'}</td>
                    <td>{row.sourcePage ?? '—'}</td>
                    <td>
                      {canShowSourceForRow(row, ctx) ? (
                        <button
                          type="button"
                          className="eq-inspector-btn eq-inspector-btn--ghost eq-inspector-btn--compact"
                          onClick={() => openSourceForRow(row)}
                        >
                          Quelle anzeigen
                        </button>
                      ) : (
                        <span className="eq-inspector-muted">Keine Quelle hinterlegt</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="eq-inspector-card" aria-label="Feature prüfen">
        <h2 className="eq-inspector-card__title">Feature prüfen</h2>
        <form className="eq-inspector-search" onSubmit={handleSearchSubmit}>
          <input
            type="search"
            value={featureQuery}
            onChange={(e) => setFeatureQuery(e.target.value)}
            placeholder="Feature prüfen… z. B. Head-up, Wärmepumpe, V2L"
            aria-label="Feature prüfen"
          />
          <button type="submit" className="eq-inspector-btn eq-inspector-btn--primary">
            Prüfen
          </button>
        </form>

        {searchResult?.type === 'not_recognized' && (
          <p className="eq-inspector-hint">Kein Treffer im globalen Feature-Katalog.</p>
        )}

        {searchResult?.type === 'ambiguous' && (
          <div className="eq-inspector-search-result">
            <p className="eq-inspector-hint">Mehrdeutig – mehrere Features möglich:</p>
            <ul className="eq-inspector-list">
              {searchResult.options.map(({ feature, availability }) => (
                <li key={feature.id}>
                  <strong>{feature.label}</strong>
                  <code>{feature.id}</code>
                  {availability && (
                    <span className="eq-inspector-muted">
                      {STATUS_LABELS[availability.modelStatus] ?? availability.modelStatus}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {searchResult?.type === 'match' && (
          <div className="eq-inspector-search-result">
            <div className="eq-inspector-search-result__head">
              <div>
                <p className="eq-inspector-search-result__feature">{searchResult.feature.label}</p>
                <code>{searchResult.feature.id}</code>
              </div>
              {searchResult.availability && (
                <StatusBadge status={searchResult.availability.modelStatus} />
              )}
            </div>

            {searchResult.customerCopy && (
              <div className="eq-inspector-customer-preview">
                <p className="eq-inspector-customer-preview__label">Kundenseite (Vorschau)</p>
                <p><strong>{searchResult.customerCopy.statusLine}</strong></p>
                {searchResult.customerCopy.hint && <p>{searchResult.customerCopy.hint}</p>}
              </div>
            )}

            <div className="eq-inspector-debug">
              <p className="eq-inspector-debug__label">Intern</p>
              <MetaItem label="sourceRefs" value={searchResult.debugSourceRefs?.join(', ')} />
              <MetaItem label="confidence" value={searchResult.availability?.confidence} />
              {searchResult.hasInspectableSource ? (
                <button
                  type="button"
                  className="eq-inspector-btn eq-inspector-btn--ghost"
                  onClick={openSourceForSearch}
                >
                  Quelle anzeigen
                </button>
              ) : (
                <span className="eq-inspector-muted">Keine Quelle hinterlegt</span>
              )}
              {searchResult.internalEntries?.map((entry) => (
                <div key={`${entry.trimId}-${entry.status}`} className="eq-inspector-debug-entry">
                  <p>
                    <strong>{entry.trimName ?? entry.trimId}</strong>
                    {' · '}
                    <StatusBadge status={entry.status} />
                    {entry.packageName && ` · Paket: ${entry.packageName}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="eq-inspector-card" aria-label="Unbekannte Features aus Import">
        <h2 className="eq-inspector-card__title">Unbekannte Features aus Import</h2>
        {ctx.unknownFeatures.length === 0 && ctx.ignoredUnknownFeatures.length === 0 ? (
          <p className="eq-inspector-empty">Keine unbekannten Import-Features für dieses Modell.</p>
        ) : (
          <>
            {ctx.unknownFeatures.length === 0 ? (
              <p className="eq-inspector-empty">Keine offenen unbekannten Features.</p>
            ) : (
              <ul className="eq-inspector-unknown-list">
                {ctx.unknownFeatures.map((item, index) => (
                  <li key={`${item.rawLabel}-${index}`} className="eq-inspector-unknown">
                    <div className="eq-inspector-unknown__main">
                      <strong>{item.rawLabel}</strong>
                      {item.suggestedFeatureId && (
                        <span className="eq-inspector-muted">Vorschlag: {item.suggestedFeatureId}</span>
                      )}
                      <span className="eq-inspector-muted">
                        {item.sourceRef?.document ?? '—'}
                        {item.sourceRef?.section ? ` · ${item.sourceRef.section}` : ''}
                        {' · '}
                        {item.confidence}
                      </span>
                    </div>
                    <UnknownFeatureActions
                      item={item}
                      modelKey={ctx.modelKey}
                      onChanged={handleAliasChanged}
                    />
                  </li>
                ))}
              </ul>
            )}

            {ctx.ignoredUnknownFeatures.length > 0 && (
              <div className="eq-inspector-ignored">
                <h3 className="eq-inspector-ignored__title">Ignoriert</h3>
                <ul className="eq-inspector-unknown-list">
                  {ctx.ignoredUnknownFeatures.map((item, index) => (
                    <li key={`ignored-${item.rawLabel}-${index}`} className="eq-inspector-unknown is-ignored">
                      <div className="eq-inspector-unknown__main">
                        <strong>{item.rawLabel}</strong>
                        <span className="eq-inspector-muted">ignoriert</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
