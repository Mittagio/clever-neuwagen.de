import {
  CONTACT_KIND,
  CONTACT_SALUTATION_OPTIONS,
} from '../../services/dealer/customerContactIdentity.js';
import './CustomerAkteIdentityFields.css';

/**
 * Apple-style Kundendaten: Privat (Anrede/Vor/Nach) oder Firma + Ansprechpartner.
 */
export default function CustomerAkteIdentityFields({
  identity,
  onChange,
}) {
  const kind = identity?.kind === CONTACT_KIND.BUSINESS
    ? CONTACT_KIND.BUSINESS
    : CONTACT_KIND.PRIVATE;
  const isBusiness = kind === CONTACT_KIND.BUSINESS;

  function patch(partial) {
    onChange?.({ ...identity, ...partial });
  }

  return (
    <div className="cust-identity">
      <div className="cust-identity__kind" role="group" aria-label="Kundenart">
        <button
          type="button"
          className={`cust-identity__kind-btn${kind === CONTACT_KIND.PRIVATE ? ' is-active' : ''}`}
          onClick={() => patch({ kind: CONTACT_KIND.PRIVATE })}
        >
          Privat
        </button>
        <button
          type="button"
          className={`cust-identity__kind-btn${isBusiness ? ' is-active' : ''}`}
          onClick={() => patch({ kind: CONTACT_KIND.BUSINESS })}
        >
          Gewerblich
        </button>
      </div>

      <div className={`cust-identity__stage${isBusiness ? ' is-business' : ' is-private'}`}>
        {isBusiness ? (
          <label className="cust-identity__field cust-identity__field--solo" htmlFor="cust-id-company">
            <span className="cust-identity__label">Firma</span>
            <input
              id="cust-id-company"
              className="cust-identity__input"
              value={identity?.companyName || ''}
              onChange={(e) => patch({ companyName: e.target.value })}
              placeholder="z. B. Müller GmbH"
              autoComplete="organization"
            />
          </label>
        ) : null}

        <div className="cust-identity__person">
          {isBusiness ? (
            <p className="cust-identity__person-label">Ansprechpartner</p>
          ) : null}

          <div className="cust-identity__salutation" role="group" aria-label="Anrede">
            {CONTACT_SALUTATION_OPTIONS.map((opt) => (
              <button
                key={opt.id || 'none'}
                type="button"
                className={`cust-identity__salutation-btn${(identity?.salutation || '') === opt.id ? ' is-active' : ''}`}
                onClick={() => patch({ salutation: opt.id })}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="cust-identity__name-row">
            <label className="cust-identity__field" htmlFor="cust-id-first">
              <span className="cust-identity__label">Vorname</span>
              <input
                id="cust-id-first"
                className="cust-identity__input"
                value={identity?.firstName || ''}
                onChange={(e) => patch({ firstName: e.target.value })}
                placeholder="Max"
                autoComplete="given-name"
              />
            </label>
            <label className="cust-identity__field" htmlFor="cust-id-last">
              <span className="cust-identity__label">Nachname</span>
              <input
                id="cust-id-last"
                className="cust-identity__input"
                value={identity?.lastName || ''}
                onChange={(e) => patch({ lastName: e.target.value })}
                placeholder="Müller"
                autoComplete="family-name"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
