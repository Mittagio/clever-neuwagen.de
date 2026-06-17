import { useEffect, useMemo, useState } from 'react';
import {
  buildCompactWishSummary,
  formatCustomerDisplayName,
} from '../../services/dealerAiParser.js';
import {
  computeCaptureCleverStaerke,
  getCaptureFlowMotivation,
} from '../../services/cleverStaerke.js';
import { createCustomerId } from '../../services/dealerAiCustomer.js';
import {
  buildCustomerHintLines,
  getCustomerProfile,
  searchCustomers,
} from '../../services/customerRegistry.js';
import CustomerMatchSuggestions from './CustomerMatchSuggestions.jsx';
import './DealerAiCustomerCapture.css';

const FIELDS = ['name', 'email', 'phone', 'note'];

const CUSTOMER_TYPE_CHIPS = [
  { id: 'herr', label: 'Herr', placeholder: 'z. B. Max Müller' },
  { id: 'frau', label: 'Frau', placeholder: 'z. B. Maria Müller' },
  { id: 'firma', label: 'Firma', placeholder: 'z. B. Müller GmbH' },
  { id: 'familie', label: 'Familie', placeholder: 'z. B. Familie Müller' },
  { id: 'unbekannt', label: 'Unbekannt' },
];

const EMAIL_DOMAINS = [
  '@gmail.com',
  '@googlemail.com',
  '@web.de',
  '@gmx.de',
  '@t-online.de',
  '@icloud.com',
  '@outlook.de',
  '@hotmail.de',
  '@yahoo.de',
];

const PHONE_PREFIXES = [
  '0170', '0171', '0172', '0173', '0174', '0175', '0176', '0177', '0178', '0179',
  '0151', '0152', '0157', '0160', '0162', '0163',
];

const NOTE_CHIPS = [
  'Kunde eilt',
  'Auto sofort benötigt',
  'Unfall / Ersatzfahrzeug',
  'Leasing läuft aus',
  'Will vergleichen',
  'Preis sehr wichtig',
  'Rückruf gewünscht',
  'Probefahrt interessant',
  'Entscheidet mit Partner',
  'Gewerbekunde',
  'Finanzierung offen',
  'Inzahlungnahme vorhanden',
];

const FIELD_COPY = {
  name: {
    title: 'Wer ist der Kunde?',
    subline: 'Ein Name reicht erstmal.',
    label: 'Name',
    placeholder: 'z. B. Max Müller',
  },
  email: {
    title: 'E-Mail ergänzen',
    subline: 'Damit das Angebot später direkt raus kann.',
    label: 'E-Mail',
    placeholder: 'kunde@...',
  },
  phone: {
    title: 'Telefonnummer',
    subline: 'Für den schnellen Rückruf.',
    label: 'Telefon',
    placeholder: '0170 …',
  },
  note: {
    title: 'Kurze Notiz',
    subline: 'Was sollte man sich merken?',
    label: 'Bemerkung',
    placeholder: 'z. B. Kunde braucht Auto schnell',
  },
};

function applyEmailDomain(value, domain) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const local = trimmed.includes('@') ? trimmed.split('@')[0].trim() : trimmed;
  if (!local) return '';
  return `${local}${domain}`;
}

function CleverStaerkeHeader({ score, wishSummary, fieldId }) {
  const motivation = getCaptureFlowMotivation(score, fieldId);
  const carLeft = `clamp(0px, calc(${score}% - 11px), calc(100% - 22px))`;
  const isLaunchReady = score >= 100;

  return (
    <header className="dai-capture-staerke">
      {wishSummary && (
        <p className="dai-capture-staerke__wish">{wishSummary}</p>
      )}
      <p className="dai-capture-staerke__label">Clever-Stärke</p>
      <p className="dai-capture-staerke__pct">{score} %</p>
      <div className="dai-capture-staerke__race" aria-hidden>
        <span className="dai-capture-staerke__pin dai-capture-staerke__pin--start">🚗</span>
        <div
          className="dai-capture-staerke__bar"
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Clever-Stärke ${score} Prozent`}
        >
          <span
            className="dai-capture-staerke__fill"
            style={{ width: `${score}%` }}
          />
          <span
            className={`dai-capture-staerke__car${isLaunchReady ? ' is-launch-ready' : ''}`}
            style={{ left: carLeft }}
          >
            🚗
          </span>
        </div>
        <span className={`dai-capture-staerke__pin dai-capture-staerke__pin--goal${score >= 70 ? ' is-near' : ''}${isLaunchReady ? ' is-reached' : ''}`}>
          🚀
        </span>
      </div>
      <p className="dai-capture-staerke__tier">{motivation.label}</p>
      <p className="dai-capture-staerke__text">{motivation.text}</p>
    </header>
  );
}

function RewardMoment() {
  return (
    <section className="dai-capture-reward" aria-live="polite" aria-label="Abgehoben">
      <div className="dai-capture-reward__glow" aria-hidden />
      <div className="dai-capture-reward__track" aria-hidden>
        <span className="dai-capture-reward__spark dai-capture-reward__spark--1">✦</span>
        <span className="dai-capture-reward__spark dai-capture-reward__spark--2">✦</span>
        <span className="dai-capture-reward__spark dai-capture-reward__spark--3">✦</span>
      </div>
      <div className="dai-capture-reward__car" aria-hidden>🚗</div>
      <h2 className="dai-capture-reward__title">Abgehoben</h2>
      <p className="dai-capture-reward__sub">Die Verkaufschance ist angelegt.</p>
    </section>
  );
}

function KnownCustomerStep({ name, phone, email, hints = [], onAccept, onEdit, onSearchOther }) {
  return (
    <section className="dai-capture-card" aria-label="Bekannter Kunde">
      <h2 className="dai-capture-card__title">Kunde ist schon da</h2>
      <p className="dai-capture-card__subline">Bestehenden Kunden nutzen?</p>
      <div className="dai-known-customer">
        <p className="dai-known-customer__name">{name}</p>
        {phone?.trim() && <p className="dai-known-customer__line">{phone.trim()}</p>}
        {email?.trim() && <p className="dai-known-customer__line">{email.trim()}</p>}
        {hints.length > 0 && (
          <p className="dai-known-customer__hints">{hints.join(' · ')}</p>
        )}
      </div>
      <div className="dai-capture-actions">
        <button type="button" className="dai-cta dai-cta--primary dai-cta--block" onClick={onAccept}>
          Übernehmen
        </button>
        <button type="button" className="dai-btn dai-btn--secondary dai-btn--block" onClick={onEdit}>
          Bearbeiten
        </button>
        <button type="button" className="dai-capture-skip" onClick={onSearchOther}>
          Anderen Kunden suchen
        </button>
      </div>
    </section>
  );
}

export default function DealerAiCustomerCapture({
  parsed,
  lead,
  leads = [],
  knownCustomer = false,
  onSave,
  onComplete,
  onAdoptCustomer,
  onOpenLead,
}) {
  const fields = parsed?.fields ?? {};

  const [fieldIndex, setFieldIndex] = useState(0);
  const [showReward, setShowReward] = useState(false);
  const [showKnownPrompt, setShowKnownPrompt] = useState(knownCustomer);
  const [dismissedMatches, setDismissedMatches] = useState(false);
  const [adoptedCustomerId, setAdoptedCustomerId] = useState(lead?.customerId ?? null);
  const [forceNewCustomerId, setForceNewCustomerId] = useState(null);

  const [name, setName] = useState(
    lead?.contact?.name?.replace('Kunde (offen)', '') ?? fields.customerName ?? '',
  );
  const [email, setEmail] = useState(lead?.contact?.email ?? '');
  const [phone, setPhone] = useState(lead?.contact?.phone ?? '');
  const [note, setNote] = useState(lead?.notes ?? parsed?.shortForm ?? '');
  const [customerType, setCustomerType] = useState(null);

  const fieldId = FIELDS[fieldIndex];
  const copy = FIELD_COPY[fieldId];
  const isLastField = fieldIndex >= FIELDS.length - 1;

  const knownProfile = useMemo(() => {
    const cid = adoptedCustomerId ?? lead?.customerId;
    if (!cid || !leads.length) return null;
    return getCustomerProfile(leads, cid);
  }, [adoptedCustomerId, lead?.customerId, leads]);

  const knownHints = useMemo(
    () => buildCustomerHintLines(knownProfile),
    [knownProfile],
  );

  const searchResult = useMemo(() => {
    if (dismissedMatches || showKnownPrompt) {
      return { matches: [], strongMatch: null, title: '' };
    }
    if (fieldId !== 'name' && fieldId !== 'email' && fieldId !== 'phone') {
      return { matches: [], strongMatch: null, title: '' };
    }
    return searchCustomers(leads, { name, email, phone }, {
      excludeLeadId: lead?.id ?? null,
      excludeCustomerId: adoptedCustomerId ?? null,
    });
  }, [
    dismissedMatches,
    showKnownPrompt,
    fieldId,
    leads,
    name,
    email,
    phone,
    lead?.id,
    adoptedCustomerId,
  ]);

  const score = useMemo(() => computeCaptureCleverStaerke({
    hasWish: true,
    name,
    email,
    phone,
    note,
  }), [name, email, phone, note]);

  function persistCustomer(silent = true) {
    const customerId = forceNewCustomerId ?? adoptedCustomerId ?? undefined;
    onSave?.({
      contact: {
        name: name.trim() || 'Kunde (offen)',
        email: email.trim(),
        phone: phone.trim(),
      },
      notes: note.trim(),
      ...(customerId ? { customerId } : {}),
    }, { silent, historyText: silent ? undefined : 'Kundendaten ergänzt' });
  }

  function finishCapture(finalScore) {
    persistCustomer(false);
    if (finalScore >= 100) {
      setShowReward(true);
      return;
    }
    onComplete?.();
  }

  useEffect(() => {
    if (!showReward) return undefined;
    const timer = setTimeout(() => {
      setShowReward(false);
      onComplete?.();
    }, 2400);
    return () => clearTimeout(timer);
  }, [showReward, onComplete]);

  function adoptMatch(match) {
    const { profile } = match;
    setName(profile.contact.name);
    setPhone(profile.contact.phone ?? '');
    setEmail(profile.contact.email ?? '');
    setAdoptedCustomerId(profile.customerId);
    setForceNewCustomerId(null);
    setDismissedMatches(true);
    onAdoptCustomer?.({ profile });
  }

  function handleCreateNewAnyway() {
    const newId = createCustomerId();
    setForceNewCustomerId(newId);
    setAdoptedCustomerId(null);
    setDismissedMatches(true);
    onAdoptCustomer?.({ forceNew: true, customerId: newId });
  }

  function acceptKnownCustomer() {
    persistCustomer(false);
    onComplete?.();
  }

  function searchOtherCustomer() {
    setShowKnownPrompt(false);
    setDismissedMatches(false);
    setAdoptedCustomerId(null);
    setForceNewCustomerId(null);
    setFieldIndex(0);
  }

  function editKnownCustomer() {
    setShowKnownPrompt(false);
    setFieldIndex(0);
  }

  function advance() {
    persistCustomer();
    if (isLastField) {
      finishCapture(score);
      return;
    }
    setFieldIndex((i) => i + 1);
  }

  function skipField() {
    persistCustomer();
    if (isLastField) {
      finishCapture(score);
      return;
    }
    setFieldIndex((i) => i + 1);
  }

  function selectCustomerType(typeId) {
    const chip = CUSTOMER_TYPE_CHIPS.find((c) => c.id === typeId);
    if (!chip) return;
    setCustomerType(typeId);
    if (typeId === 'unbekannt') {
      setName('');
      skipField();
      return;
    }
    setDismissedMatches(false);
  }

  const namePlaceholder = CUSTOMER_TYPE_CHIPS.find((c) => c.id === customerType)?.placeholder
    ?? FIELD_COPY.name.placeholder;

  function toggleNoteChip(chip) {
    setNote((prev) => {
      const parts = prev.split(/[,;]\s*/).map((s) => s.trim()).filter(Boolean);
      if (parts.includes(chip)) {
        return parts.filter((p) => p !== chip).join(', ');
      }
      return parts.length ? `${parts.join(', ')}, ${chip}` : chip;
    });
  }

  if (showReward) {
    return <RewardMoment />;
  }

  if (showKnownPrompt && formatCustomerDisplayName(name)) {
    return (
      <section className="dai-capture" aria-label="Kunde übernehmen">
        <KnownCustomerStep
          name={formatCustomerDisplayName(name)}
          phone={phone}
          email={email}
          hints={knownHints}
          onAccept={acceptKnownCustomer}
          onEdit={editKnownCustomer}
          onSearchOther={searchOtherCustomer}
        />
      </section>
    );
  }

  const showMatches = searchResult.matches.length > 0
    && (fieldId === 'name' || fieldId === 'email' || fieldId === 'phone');

  const wishSummary = buildCompactWishSummary(fields);

  return (
    <section className="dai-capture" aria-label="Kunde erfassen">
      <CleverStaerkeHeader score={score} wishSummary={wishSummary} fieldId={fieldId} />

      <div className="dai-capture-card" key={fieldId}>
        <h2 className="dai-capture-card__title">{copy.title}</h2>
        <p className="dai-capture-card__subline">{copy.subline}</p>

        {fieldId === 'name' && (
          <>
            <div className="dai-capture-chips dai-capture-chips--type" role="group" aria-label="Kundentyp">
              {CUSTOMER_TYPE_CHIPS.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  className={`dai-capture-chip${customerType === chip.id ? ' is-active' : ''}`}
                  onClick={() => selectCustomerType(chip.id)}
                  aria-pressed={customerType === chip.id}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <label className="dai-capture-field" htmlFor="capture-name">
              <span className="dai-capture-field__label">{copy.label}</span>
              <input
                id="capture-name"
                type="text"
                className="dai-capture-field__input"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setDismissedMatches(false);
                }}
                placeholder={namePlaceholder}
                autoComplete="name"
                autoFocus
              />
            </label>
            <p className="dai-capture-field__hint">
              Wir prüfen automatisch, ob der Kunde schon angelegt ist.
            </p>
          </>
        )}

        {fieldId === 'email' && (
          <>
            <label className="dai-capture-field" htmlFor="capture-email">
              <span className="dai-capture-field__label">{copy.label}</span>
              <input
                id="capture-email"
                type="email"
                inputMode="email"
                className="dai-capture-field__input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={copy.placeholder}
                autoComplete="email"
                autoFocus
              />
            </label>
            <div className="dai-capture-chips" role="group" aria-label="E-Mail-Domain">
              {EMAIL_DOMAINS.map((domain) => (
                <button
                  key={domain}
                  type="button"
                  className="dai-capture-chip"
                  onClick={() => setEmail(applyEmailDomain(email, domain))}
                >
                  {domain}
                </button>
              ))}
            </div>
          </>
        )}

        {fieldId === 'phone' && (
          <>
            <label className="dai-capture-field" htmlFor="capture-phone">
              <span className="dai-capture-field__label">{copy.label}</span>
              <input
                id="capture-phone"
                type="tel"
                inputMode="tel"
                className="dai-capture-field__input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={copy.placeholder}
                autoComplete="tel"
                autoFocus
              />
            </label>
            <div className="dai-capture-chips dai-capture-chips--phone" role="group" aria-label="Vorwahl">
              {PHONE_PREFIXES.map((prefix) => (
                <button
                  key={prefix}
                  type="button"
                  className={`dai-capture-chip${phone.startsWith(prefix) ? ' is-active' : ''}`}
                  onClick={() => setPhone(prefix)}
                >
                  {prefix}
                </button>
              ))}
            </div>
          </>
        )}

        {fieldId === 'note' && (
          <>
            <label className="dai-capture-field" htmlFor="capture-note">
              <span className="dai-capture-field__label">{copy.label}</span>
              <textarea
                id="capture-note"
                className="dai-capture-field__input dai-capture-field__input--area"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={copy.placeholder}
                autoFocus
              />
            </label>
            <div className="dai-capture-chips dai-capture-chips--notes" role="group" aria-label="Notizvorlagen">
              {NOTE_CHIPS.map((chip) => {
                const active = note.includes(chip);
                return (
                  <button
                    key={chip}
                    type="button"
                    className={`dai-capture-chip${active ? ' is-active' : ''}`}
                    onClick={() => toggleNoteChip(chip)}
                    aria-pressed={active}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {showMatches && (
          <CustomerMatchSuggestions
            title={searchResult.title}
            matches={searchResult.matches}
            strongMatch={searchResult.strongMatch}
            onAdopt={adoptMatch}
            onOpen={onOpenLead}
            onCreateNew={handleCreateNewAnyway}
          />
        )}

        <div className="dai-capture-actions">
          <button
            type="button"
            className="dai-cta dai-cta--primary dai-cta--block"
            onClick={advance}
          >
            {isLastField ? 'Weiter' : 'Weiter'}
            {!isLastField && <span className="dai-cta__arrow" aria-hidden>→</span>}
          </button>
          <button type="button" className="dai-capture-skip" onClick={skipField}>
            {isLastField ? 'Überspringen' : 'Überspringen'}
          </button>
        </div>
      </div>
    </section>
  );
}
