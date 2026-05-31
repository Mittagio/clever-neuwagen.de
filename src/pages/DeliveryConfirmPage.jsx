import { useState, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useLeads } from '../context/LeadsContext.jsx';
import { DELIVERY_REWARDS } from '../data/deliveryRewards.js';
import { formatPrice } from '../data/kiaSportage.js';
import { getSelectedVoucher } from '../logic/partnerAssignment.js';
import { validateDeliveryToken } from '../services/delivery/deliveryWorkflow.js';
import './DeliveryConfirmPage.css';

function GiftPicker({ rewards, onSelect, submitting }) {
  const [picked, setPicked] = useState(null);

  const fuelOptions = rewards.options?.filter((o) => o.type === 'fuel') ?? [];
  const chargingOptions = rewards.options?.filter((o) => o.type === 'charging') ?? [];

  function handleConfirm() {
    if (!picked || submitting) return;
    onSelect(picked);
  }

  return (
    <div className="delivery-gift">
      <p className="delivery-gift__title">Wählen Sie Ihr Geschenk</p>
      <p className="delivery-gift__sub">
        Ein Gutschein Ihrer Wahl – Tankstelle oder Ladebetreiber (20 €)
      </p>

      {fuelOptions.length > 0 && (
        <GiftGroup
          icon="⛽"
          label="Tankstellen"
          options={fuelOptions}
          picked={picked}
          onPick={setPicked}
        />
      )}

      {chargingOptions.length > 0 && (
        <GiftGroup
          icon="⚡"
          label="Ladebetreiber"
          options={chargingOptions}
          picked={picked}
          onPick={setPicked}
        />
      )}

      <button
        type="button"
        className="delivery-btn delivery-btn--yes delivery-gift__confirm"
        disabled={!picked || submitting}
        onClick={handleConfirm}
      >
        {submitting ? 'Wird gesendet…' : 'Gutschein sichern'}
      </button>
    </div>
  );
}

function GiftGroup({ icon, label, options, picked, onPick }) {
  return (
    <div className="delivery-gift__group">
      <p className="delivery-gift__group-label">{icon} {label}</p>
      <div className="delivery-gift__grid">
        {options.map((opt) => (
          <button
            key={opt.partnerId}
            type="button"
            className={`delivery-gift__option${picked === opt.partnerId ? ' is-picked' : ''}`}
            onClick={() => onPick(opt.partnerId)}
          >
            <span className="delivery-gift__option-name">{opt.name}</span>
            <span className="delivery-gift__option-value">{formatPrice(opt.voucherValue)}</span>
            <span className="delivery-gift__option-valid">{opt.validityLabel}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SelectedGift({ rewards, voucher }) {
  const selected = voucher ?? getSelectedVoucher(rewards);

  return (
    <>
      <div className="delivery-rewards">
        {selected && (
          <div className="delivery-reward delivery-reward--partner">
            <span className="delivery-reward__label">
              {selected.partnerType === 'charging' || selected.type === 'charging' ? '⚡' : '⛽'}{' '}
              {selected.partnerName ?? selected.name}
            </span>
            <span className="delivery-reward__value">{formatPrice(selected.value ?? selected.voucherValue)}</span>
            <span className="delivery-reward__code">Code: {selected.code ?? selected.promoCode}</span>
            <span className="delivery-reward__valid">{selected.validityLabel}</span>
          </div>
        )}
      </div>
      {voucher?.status === 'sent' ? (
        <p className="delivery-hint">✓ Ihr Gutschein wurde per E-Mail zugesendet.</p>
      ) : voucher?.status === 'error' ? (
        <p className="delivery-hint delivery-hint--error">E-Mail-Versand fehlgeschlagen. Ihr Händler sendet den Code erneut.</p>
      ) : (
        <p className="delivery-hint">Ihr Gutschein wird in Kürze per E-Mail zugesendet.</p>
      )}
    </>
  );
}

export default function DeliveryConfirmPage() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const { getLeadByDeliveryToken, confirmDelivery, selectVoucherGift } = useLeads();
  const [localDone, setLocalDone] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const lead = getLeadByDeliveryToken(token);
  const dc = lead?.deliveryConfirmation;
  const rewards = dc?.rewards ?? DELIVERY_REWARDS;
  const voucher = dc?.voucher;

  const urlAnswer = searchParams.get('antwort');
  const normalizedUrl = urlAnswer === 'ja' ? 'yes' : urlAnswer === 'nein' ? 'no' : urlAnswer;
  const response = localDone ?? dc?.response ?? normalizedUrl;
  const hasVoucherSent = voucher?.status === 'sent';
  const hasSelected = hasVoucherSent || !!voucher?.partnerId || !!rewards?.selectedPartnerId;

  const tokenCheck = lead ? validateDeliveryToken(lead) : { valid: false, code: 'INVALID_TOKEN' };

  useEffect(() => {
    if (!token || !lead || dc?.response) return;
    if (normalizedUrl !== 'yes' && normalizedUrl !== 'no') return;
    if (!tokenCheck.valid) return;

    confirmDelivery(token, normalizedUrl).then((res) => {
      if (res.ok) setLocalDone(normalizedUrl);
      else setError(res.message ?? 'Bestätigung fehlgeschlagen');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, normalizedUrl]);

  async function handleAnswer(answer) {
    if (!token || dc?.response || submitting) return;
    if (!tokenCheck.valid) {
      setError(tokenCheck.message);
      return;
    }
    setSubmitting(true);
    setError('');
    const res = await confirmDelivery(token, answer === 'yes' ? 'yes' : 'no');
    setSubmitting(false);
    if (res.ok) setLocalDone(answer === 'yes' ? 'yes' : 'no');
    else setError(res.message ?? 'Bestätigung fehlgeschlagen');
  }

  async function handleGiftSelect(partnerId) {
    setSubmitting(true);
    setError('');
    const res = await selectVoucherGift(token, partnerId);
    setSubmitting(false);
    if (!res.ok) setError(res.message ?? 'Gutschein konnte nicht gesendet werden');
  }

  if (!lead) {
    return (
      <div className="delivery-page delivery-page--empty">
        <div className="delivery-card">
          <h1>Link ungültig</h1>
          <p>Diese Auslieferungsbestätigung existiert nicht oder ist abgelaufen.</p>
          <Link to="/" className="delivery-btn">Zur Startseite</Link>
        </div>
      </div>
    );
  }

  if (!tokenCheck.valid && tokenCheck.code === 'EXPIRED_TOKEN') {
    return (
      <div className="delivery-page delivery-page--empty">
        <div className="delivery-card">
          <h1>Link abgelaufen</h1>
          <p>Bitte wenden Sie sich an Ihren Ansprechpartner für einen neuen Link.</p>
          <Link to="/" className="delivery-btn">Zur Startseite</Link>
        </div>
      </div>
    );
  }

  const name = lead.contact?.name?.trim() || 'Kunde';

  if (response === 'yes' || dc?.response === 'yes') {
    return (
      <div className="delivery-page delivery-page--wide">
        <div className="delivery-card delivery-card--success">
          <span className="delivery-icon">✓</span>
          <h1>Auslieferung bestätigt</h1>
          <p className="delivery-sub">Vielen Dank, {name}!</p>
          <p className="delivery-vehicle">{lead.vehicle?.label}</p>
          {error && <p className="delivery-hint delivery-hint--error">{error}</p>}

          {hasSelected ? (
            <SelectedGift rewards={rewards} voucher={voucher} />
          ) : (
            <GiftPicker rewards={rewards} onSelect={handleGiftSelect} submitting={submitting} />
          )}
        </div>
      </div>
    );
  }

  if (response === 'no' || dc?.response === 'no') {
    return (
      <div className="delivery-page">
        <div className="delivery-card delivery-card--info">
          <span className="delivery-icon">💬</span>
          <h1>Danke für Ihre Rückmeldung</h1>
          <p className="delivery-sub">
            Wir haben vermerkt, dass Sie Ihr Fahrzeug noch nicht erhalten haben.
          </p>
          <p className="delivery-hint">Ihr Ansprechpartner meldet sich bei Ihnen.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="delivery-page">
      <div className="delivery-card">
        <p className="delivery-kicker">Auslieferung</p>
        <h1>Haben Sie Ihr Fahrzeug erhalten?</h1>
        <p className="delivery-sub">{lead.vehicle?.label}</p>
        <p className="delivery-greeting">Hallo {name},</p>
        <p className="delivery-text">
          Bitte bestätigen Sie kurz, ob Ihr Fahrzeug bei Ihnen angekommen ist.
        </p>
        {error && <p className="delivery-hint delivery-hint--error">{error}</p>}

        <div className="delivery-actions">
          <button
            type="button"
            className="delivery-btn delivery-btn--yes"
            disabled={submitting}
            onClick={() => handleAnswer('yes')}
          >
            Ja
          </button>
          <button
            type="button"
            className="delivery-btn delivery-btn--no"
            disabled={submitting}
            onClick={() => handleAnswer('no')}
          >
            Nein
          </button>
        </div>
      </div>
    </div>
  );
}
