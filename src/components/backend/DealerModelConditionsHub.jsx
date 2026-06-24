import {
  getLeasingWizardProgress,
  resolveSkippedMap,
} from '../../services/dealer/dealerLeasingWizard.js';
import {
  getFinancingWizardProgress,
} from '../../services/dealer/dealerFinancingWizard.js';
import {
  getFinanceResidualProgress,
  resolveFinanceResidualSkippedMap,
} from '../../services/dealer/dealerFinanceResiduals.js';
import {
  getModelTrimLines,
  resolveTrimSettings,
} from '../../services/dealer/dealerTrimConditions.js';
import { resolveModelSettings } from '../../services/dealer/dealerVehicleManagement.js';
import './DealerVehicleManagement.css';

const PAYMENT_CARDS = [
  {
    id: 'cash',
    label: 'Barzahlung',
    icon: '💶',
    hint: 'Händlerrabatt und Bonus für Barpreis',
  },
  {
    id: 'leasing',
    label: 'Leasing',
    icon: '📋',
    hint: 'Leasingfaktoren Schritt für Schritt pflegen',
  },
  {
    id: 'financing',
    label: 'Finanzierung',
    icon: '🏦',
    hint: 'Rabatt und Finanzierungskonditionen',
  },
];

export default function DealerModelConditionsHub({
  model,
  conditions,
  onBack,
  onOpenPayment,
}) {
  const trims = getModelTrimLines(model);
  const settings = resolveModelSettings(conditions, model.id);
  const hasTrimLines = trims.length > 0;
  const leasingProgress = getLeasingWizardProgress(
    conditions,
    model.id,
    resolveSkippedMap(settings),
  );

  function paymentMeta(cardId) {
    if (!hasTrimLines) {
      const discount = settings.paymentDiscounts?.[cardId];
      return discount != null ? `${discount} % Rabatt` : 'Noch nicht gepflegt';
    }

    const parts = trims.map((trim) => {
      const trimSettings = resolveTrimSettings(settings, trim.id);
      const discount = trimSettings.paymentDiscounts?.[cardId];
      return `${trim.name}: ${discount != null ? `${discount} %` : '–'}`;
    });
    return parts.join(' · ');
  }

  return (
    <div className="dvm-conditions">
      <button type="button" className="dvm-back" onClick={onBack}>
        ← {model.name}
      </button>

      <header className="dvm-conditions__head">
        <h2 className="dvm-conditions__title">Konditionen</h2>
        <p className="dvm-conditions__sub">
          Eine Zahlungsart wählen – jeweils ein eigener Screen.
        </p>
      </header>

      <div className="dvm-conditions__cards">
        {PAYMENT_CARDS.map((card) => {
          let meta = paymentMeta(card.id);

          if (card.id === 'leasing') {
            meta = `${leasingProgress.filled} von ${leasingProgress.total} Faktoren gepflegt`;
            if (leasingProgress.pending > 0) {
              meta += ` · ${leasingProgress.pending} offen`;
            }
            if (hasTrimLines) {
              meta += ' · pro Ausstattung';
            }
          }

          if (card.id === 'financing') {
            const financeProgress = trims.reduce((acc, trim) => {
              const trimSettings = resolveTrimSettings(settings, trim.id);
              const fp = getFinancingWizardProgress(
                conditions,
                model.id,
                trimSettings.financeWizardSkipped ?? {},
                trim.id,
              );
              const rp = getFinanceResidualProgress(
                conditions,
                model.id,
                resolveFinanceResidualSkippedMap(trimSettings, trim.id),
                trim.id,
              );
              return {
                filled: acc.filled + fp.filled,
                total: acc.total + fp.total,
                pending: acc.pending + fp.pending,
                residualsFilled: acc.residualsFilled + rp.filled,
                residualsTotal: acc.residualsTotal + rp.total,
              };
            }, {
              filled: 0,
              total: 0,
              pending: 0,
              residualsFilled: 0,
              residualsTotal: 0,
            });
            if (!hasTrimLines) {
              const fp = getFinancingWizardProgress(
                conditions,
                model.id,
                settings.financeWizardSkipped ?? {},
              );
              const rp = getFinanceResidualProgress(
                conditions,
                model.id,
                resolveFinanceResidualSkippedMap(settings),
              );
              meta = `${fp.filled} von ${fp.total} Konditionen · ${rp.filled} von ${rp.total} Schlussraten`;
              if (fp.pending > 0) meta += ` · ${fp.pending} offen`;
            } else {
              meta = `${financeProgress.filled} von ${financeProgress.total} Konditionen · ${financeProgress.residualsFilled} von ${financeProgress.residualsTotal} Schlussraten`;
              if (financeProgress.pending > 0) meta += ` · ${financeProgress.pending} offen`;
              meta += ' · pro Ausstattung';
            }
          }

          return (
            <button
              key={card.id}
              type="button"
              className="dvm-conditions-card"
              onClick={() => onOpenPayment(card.id)}
            >
              <span className="dvm-conditions-card__icon" aria-hidden>{card.icon}</span>
              <span className="dvm-conditions-card__body">
                <span className="dvm-conditions-card__label">{card.label}</span>
                <span className="dvm-conditions-card__hint">{card.hint}</span>
                <span className="dvm-conditions-card__meta">{meta}</span>
              </span>
              <span className="dvm-conditions-card__chev" aria-hidden>›</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
