import { useMemo, useState } from 'react';
import { PAYMENT_TYPE_LABELS } from '../../services/dealerAiParser.js';
import {
  LEARNING_SOURCE_AREAS,
  dealerAiRecognitionNeedsLearningFeedback,
} from '../../services/admin/cleverLearningRequestService.js';
import CleverLearningRequestCard from '../shared/CleverLearningRequestCard.jsx';
import './DealerAiRecognition.css';

function ChipList({
  chips = [],
  onRemove,
  onAdd,
  emptyLabel = 'Noch nichts erkannt',
}) {
  return (
    <div className="dai-recognition-chips">
      {chips.length === 0 && (
        <p className="dai-recognition-chips__empty">{emptyLabel}</p>
      )}
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          className="dai-recognition-chips__chip"
          onClick={() => onRemove?.(chip)}
          title="Entfernen"
        >
          {chip}
          <span className="dai-recognition-chips__chip-x" aria-hidden>×</span>
        </button>
      ))}
      <button type="button" className="dai-recognition-chips__add" onClick={onAdd}>
        + Info hinzufügen
      </button>
    </div>
  );
}

function RecognitionCard({ title, children }) {
  return (
    <article className="dai-recognition-card">
      <h3 className="dai-recognition-card__title">{title}</h3>
      {children}
    </article>
  );
}

export default function DealerAiRecognitionReview({
  insight,
  onChange,
  onConfirm,
  isExecuting = false,
}) {
  const [draftNote, setDraftNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);

  const customer = insight?.customer ?? {};
  const displayName = useMemo(() => {
    const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
    return name || customer.displayName || '';
  }, [customer]);

  if (!insight) return null;

  function updateCustomer(patch) {
    onChange?.({
      ...insight,
      customer: { ...insight.customer, ...patch },
    });
  }

  function updateHelperNotes(nextNotes) {
    onChange?.({ ...insight, customerHelperNotes: nextNotes });
  }

  function removeHelperNote(note) {
    updateHelperNotes((insight.customerHelperNotes ?? []).filter((item) => item !== note));
  }

  function addHelperNote() {
    const trimmed = draftNote.trim();
    if (!trimmed) {
      setShowNoteInput(false);
      return;
    }
    const next = [...(insight.customerHelperNotes ?? [])];
    if (!next.includes(trimmed)) next.push(trimmed);
    updateHelperNotes(next);
    setDraftNote('');
    setShowNoteInput(false);
  }

  const payment = insight.paymentWish ?? {};
  const paymentSummary = payment.paymentType && payment.paymentType !== 'unknown'
    ? [
        payment.paymentLabel,
        payment.budget ? `${Number(payment.budget).toLocaleString('de-DE')} €` : null,
        payment.termMonths ? `${payment.termMonths} Monate` : null,
        payment.mileagePerYear ? `${payment.mileagePerYear.toLocaleString('de-DE')} km` : null,
      ].filter(Boolean).join(' · ')
    : 'noch offen';

  return (
    <section className="dai-recognition-review" aria-labelledby="dai-recognition-review-title">
      <header className="dai-recognition-review__head">
        <p className="dai-recognition-review__kicker">Clever hat folgende Punkte erkannt.</p>
        <h2 id="dai-recognition-review-title" className="dai-recognition-review__title">
          Clever hat erkannt
        </h2>
      </header>

      <div className="dai-recognition-review__cards">
        <RecognitionCard title="Kunde">
          <label className="dai-recognition-field">
            <span className="dai-recognition-field__label">Vorname</span>
            <input
              type="text"
              className="dai-recognition-field__input"
              value={customer.firstName ?? ''}
              placeholder="Kunde noch offen"
              onChange={(e) => updateCustomer({
                firstName: e.target.value,
                displayName: [e.target.value, customer.lastName].filter(Boolean).join(' '),
              })}
            />
          </label>
          <label className="dai-recognition-field">
            <span className="dai-recognition-field__label">Nachname</span>
            <input
              type="text"
              className="dai-recognition-field__input"
              value={customer.lastName ?? ''}
              onChange={(e) => updateCustomer({
                lastName: e.target.value,
                displayName: [customer.firstName, e.target.value].filter(Boolean).join(' '),
              })}
            />
          </label>
          <label className="dai-recognition-field">
            <span className="dai-recognition-field__label">Telefon</span>
            <input
              type="tel"
              className="dai-recognition-field__input"
              value={customer.phone ?? ''}
              placeholder="nicht erkannt"
              onChange={(e) => updateCustomer({ phone: e.target.value || null })}
            />
          </label>
          <label className="dai-recognition-field">
            <span className="dai-recognition-field__label">E-Mail</span>
            <input
              type="email"
              className="dai-recognition-field__input"
              value={customer.email ?? ''}
              placeholder="nicht erkannt"
              onChange={(e) => updateCustomer({ email: e.target.value || null })}
            />
          </label>
          {!displayName && (
            <p className="dai-recognition-review__hint">Kunde noch offen</p>
          )}
        </RecognitionCard>

        <RecognitionCard title="Kundeninfos">
          <ChipList
            chips={insight.customerHelperNotes ?? []}
            onRemove={removeHelperNote}
            onAdd={() => setShowNoteInput(true)}
          />
          {showNoteInput && (
            <div className="dai-recognition-inline-add">
              <input
                type="text"
                className="dai-recognition-field__input"
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                placeholder="z. B. Gebrauchtwagen BMW"
                onKeyDown={(e) => e.key === 'Enter' && addHelperNote()}
              />
              <button type="button" className="dai-btn dai-btn--primary" onClick={addHelperNote}>
                Übernehmen
              </button>
            </div>
          )}
        </RecognitionCard>

        <RecognitionCard title="Fahrzeugwunsch">
          {(insight.vehicleWish?.labels ?? []).length > 0 ? (
            <ul className="dai-recognition-list">
              {insight.vehicleWish.labels.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="dai-recognition-review__hint">noch offen</p>
          )}
        </RecognitionCard>

        <RecognitionCard title="Konditionen">
          <p className="dai-recognition-review__line">{paymentSummary}</p>
          {payment.paymentType && payment.paymentType !== 'unknown' && (
            <p className="dai-recognition-review__sub">
              {PAYMENT_TYPE_LABELS[payment.paymentType] ?? payment.paymentType}
            </p>
          )}
        </RecognitionCard>

        {insight.recommendation && (
          <RecognitionCard title="Clever Empfehlung">
            <p className="dai-recognition-review__model">{insight.recommendation.modelLabel}</p>
            {insight.recommendation.reasonBullets?.length > 0 && (
              <ul className="dai-recognition-list dai-recognition-list--bullets">
                {insight.recommendation.reasonBullets.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}
            {insight.recommendation.alternatives?.length > 0 && (
              <p className="dai-recognition-review__sub">
                Alternative: {insight.recommendation.alternatives.map((a) => a.modelLabel).join(' · ')}
              </p>
            )}
          </RecognitionCard>
        )}
      </div>

      {dealerAiRecognitionNeedsLearningFeedback(insight) && (
        <CleverLearningRequestCard
          query={insight.sourceText ?? 'KI-Erkennung'}
          modelKey={insight.recommendation?.modelKey ?? null}
          modelLabel={insight.recommendation?.modelLabel ?? insight.vehicleWish?.modelLabel ?? null}
          sourceArea={LEARNING_SOURCE_AREAS.CUSTOMER_AKTE}
          pageContext="KI-Erkennung"
        />
      )}

      <div className="dai-recognition-review__actions">
        <button
          type="button"
          className="dai-btn dai-btn--primary dai-btn--block"
          onClick={() => onConfirm?.(insight)}
          disabled={isExecuting}
        >
          {isExecuting ? 'Wird übernommen …' : 'Stimmt so – weiter'}
        </button>
      </div>
    </section>
  );
}
