/**
 * Mindestpreis-Schutz – Warnungen bei kritischen Rabatten
 */
import { resolveModelSettings } from './dealerVehicleManagement.js';
import { getModelTrimLines } from './dealerTrimConditions.js';
import { resolveTrimSettings } from './dealerTrimConditions.js';

const HIGH_DISCOUNT_THRESHOLD = 25;
const CRITICAL_DISCOUNT_THRESHOLD = 35;

export function assessMinPriceRisk(conditions = {}, modelId = '', model = { id: modelId }) {
  const settings = resolveModelSettings(conditions, modelId);
  const warnings = [];
  const listPrice = Number(settings.listPrice) || 0;
  const trims = getModelTrimLines(model);

  function checkDiscount(percent, label) {
    if (percent >= CRITICAL_DISCOUNT_THRESHOLD) {
      warnings.push({
        id: `discount-critical-${label}`,
        label: `${label}: Rabatt ${percent} % ist ungewöhnlich hoch`,
        severity: 'critical',
        requiresConfirmation: true,
      });
    } else if (percent >= HIGH_DISCOUNT_THRESHOLD) {
      warnings.push({
        id: `discount-high-${label}`,
        label: `${label}: Rabatt ${percent} % – Marge prüfen`,
        severity: 'warning',
        requiresConfirmation: false,
      });
    }
  }

  if (trims.length > 0) {
    for (const trim of trims) {
      const trimSettings = resolveTrimSettings(settings, trim.id);
      const discount = Math.max(
        trimSettings.paymentDiscounts?.cash ?? 0,
        trimSettings.paymentDiscounts?.leasing ?? 0,
        trimSettings.paymentDiscounts?.financing ?? 0,
      );
      if (discount > 0) checkDiscount(discount, trim.name);
    }
  } else {
    const discount = Math.max(
      settings.paymentDiscounts?.cash ?? 0,
      settings.paymentDiscounts?.leasing ?? 0,
      settings.paymentDiscounts?.financing ?? 0,
    );
    if (discount > 0) checkDiscount(discount, 'Modell');
  }

  if (listPrice > 0) {
    const maxDiscount = trims.length > 0
      ? Math.max(...trims.map((t) => {
        const ts = resolveTrimSettings(settings, t.id);
        return ts.paymentDiscounts?.cash ?? 0;
      }))
      : (settings.paymentDiscounts?.cash ?? 0);

    const minPrice = listPrice * (1 - maxDiscount / 100);
    const floor = settings.minSalePrice ?? listPrice * 0.65;
    if (minPrice < floor) {
      warnings.push({
        id: 'below-min-price',
        label: `Kaufpreis unter Mindestpreis (${Math.round(floor).toLocaleString('de-DE')} €)`,
        severity: 'critical',
        requiresConfirmation: true,
      });
    }
  }

  return {
    warnings,
    hasCritical: warnings.some((w) => w.severity === 'critical'),
  };
}
