import { useMemo, useState } from 'react';
import { searchCustomers } from '../../services/crm/customerSearchService.js';

const SEARCH_PLACEHOLDER = 'Name, Telefon, E-Mail, Fahrzeug oder CN-Nummer';

function CustomerHitCard({ result, onOpen }) {
  return (
    <button
      type="button"
      className="backend-home__search-hit"
      onClick={() => onOpen?.(result.leadId)}
    >
      <div className="backend-home__search-hit-main">
        <p className="backend-home__search-hit-name">{result.customerName}</p>
        <p className="backend-home__search-hit-vehicle">{result.vehicleLabel}</p>
        <div className="backend-home__search-hit-meta">
          <span className="backend-home__search-hit-status">{result.statusLabel}</span>
          {result.lastActivityLabel && (
            <span className="backend-home__search-hit-activity">{result.lastActivityLabel}</span>
          )}
        </div>
        {result.warningLabel && (
          <p className="backend-home__search-hit-warning">{result.warningLabel}</p>
        )}
      </div>
      <span className="backend-home__search-hit-action" aria-hidden>›</span>
    </button>
  );
}

export default function BackendCustomerSearch({
  leads = [],
  onOpenCustomerRecord,
  variant = 'hero',
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const searchResults = useMemo(
    () => searchCustomers(searchQuery, leads),
    [searchQuery, leads],
  );

  const showSearchResults = searchQuery.trim().length >= 2;
  const hasSearchResults = searchResults.length > 0;

  return (
    <div className={`backend-home__customer-search backend-home__customer-search--${variant}`}>
      <p className="backend-home__customer-search-label" id="backend-customer-search-label">
        Kundenakte finden
      </p>
      <label className="backend-home__search-field-wrap" htmlFor="backend-customer-search">
        <span className="visually-hidden">Kundenakte suchen</span>
        <input
          id="backend-customer-search"
          type="search"
          className="backend-home__search-field"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={SEARCH_PLACEHOLDER}
          autoComplete="off"
          enterKeyHint="search"
          aria-labelledby="backend-customer-search-label"
        />
      </label>

      {showSearchResults && hasSearchResults && (
        <div className="backend-home__search-results" role="listbox" aria-label="Suchergebnisse">
          {searchResults.map((result) => (
            <CustomerHitCard
              key={result.leadId}
              result={result}
              onOpen={onOpenCustomerRecord}
            />
          ))}
        </div>
      )}

      {showSearchResults && !hasSearchResults && (
        <p className="backend-home__search-empty" role="status">
          Keine Kundenakte gefunden.
        </p>
      )}
    </div>
  );
}
