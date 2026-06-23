import { useEffect, useMemo, useState } from 'react';
import {
  isAutocompleteEnabled,
  searchAddressSuggestions,
} from '../../services/location/addressAutocompleteService.js';
import { DEFAULT_COUNTRY, normalizeAddressResult } from '../../services/location/customerAddressModel.js';

function Field({ label, id, value, onChange, placeholder, disabled = false }) {
  return (
    <label className="dai-lead-field" htmlFor={id}>
      <span className="dai-lead-field__label">{label}</span>
      <input
        id={id}
        className="dai-lead-field__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </label>
  );
}

export default function CustomerAddressSheet({
  address,
  onChange,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const autocompleteOn = isAutocompleteEnabled();

  const normalized = useMemo(() => normalizeAddressResult(address), [address]);

  useEffect(() => {
    if (!autocompleteOn || searchQuery.trim().length < 3) {
      setSuggestions([]);
      return undefined;
    }

    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      searchAddressSuggestions(searchQuery)
        .then((items) => {
          if (!cancelled) setSuggestions(items);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery, autocompleteOn]);

  function patchAddress(patch) {
    onChange?.(normalizeAddressResult({ ...normalized, ...patch }));
  }

  async function handleSelectSuggestion(suggestionId) {
    const selected = await selectAddressSuggestion(suggestionId);
    if (!selected) return;
    onChange?.(selected);
    setSearchQuery('');
    setSuggestions([]);
  }

  return (
    <div className="dai-lead-form cust-akte-address-sheet">
      <label className="dai-lead-field" htmlFor="cust-address-search">
        <span className="dai-lead-field__label">Adresse suchen</span>
        <input
          id="cust-address-search"
          className="dai-lead-field__input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Adresse suchen …"
          disabled={!autocompleteOn}
          autoComplete="off"
        />
      </label>
      {!isAutocompleteEnabled() && (
        <p className="cust-akte-address-sheet__hint">
          Autocomplete deaktiviert – Adresse manuell eingeben.
        </p>
      )}
      {searching && <p className="cust-akte-address-sheet__hint">Suche …</p>}
      {suggestions.length > 0 && (
        <ul className="cust-akte-address-sheet__suggestions" role="listbox" aria-label="Adressvorschläge">
          {suggestions.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="cust-akte-address-sheet__suggestion"
                onClick={() => handleSelectSuggestion(item.id)}
              >
                <span>{item.label}</span>
                {item.description && (
                  <small>{item.description}</small>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <Field
        label="Straße"
        id="cust-address-street"
        value={normalized.street}
        onChange={(value) => patchAddress({ street: value })}
        placeholder="Buchsweg"
      />
      <Field
        label="Hausnummer"
        id="cust-address-house"
        value={normalized.houseNumber}
        onChange={(value) => patchAddress({ houseNumber: value })}
        placeholder="38"
      />
      <Field
        label="PLZ"
        id="cust-address-plz"
        value={normalized.postalCode}
        onChange={(value) => patchAddress({ postalCode: value })}
        placeholder="73547"
      />
      <Field
        label="Ort"
        id="cust-address-city"
        value={normalized.city}
        onChange={(value) => patchAddress({ city: value })}
        placeholder="Aalen"
      />
      <Field
        label="Land"
        id="cust-address-country"
        value={normalized.country || DEFAULT_COUNTRY}
        onChange={(value) => patchAddress({ country: value })}
        placeholder={DEFAULT_COUNTRY}
      />
    </div>
  );
}
