/**
 * Händler-Fahrzeugverwaltung – Service-Tests
 */
import assert from 'node:assert/strict';
import {
  buildCustomerModelBadges,
  buildModelManagementCard,
  createEmptyPromotion,
  formatPreparationFeeSuffix,
  listManagementModels,
  resolveModelSettings,
} from './dealerVehicleManagement.js';
import { normalizeDealerConditions } from '../../data/dealerConditionsSchema.js';

const conditions = normalizeDealerConditions({
  preparationFee: 1290,
  discountsByModel: {
    sportage: { standard: 10 },
  },
  activeModels: [
    { id: 'sportage', brand: 'Kia', name: 'Sportage', active: true },
  ],
  modelSettingsByModel: {
    sportage: {
      paymentDiscounts: { cash: 10, leasing: 10, financing: 10 },
      promotions: [
        {
          id: 'p1',
          title: 'Studentenbonus',
          bonusAmount: 1000,
          targetGroup: 'studenten',
          validUntil: '2026-06-30',
          showOnCustomerSite: true,
          active: true,
          badgeText: '1.000 € Studentenbonus',
        },
      ],
    },
  },
});

const card = buildModelManagementCard(conditions, conditions.activeModels[0]);
assert.equal(card.discountPercent, 10);
assert.equal(card.activeActionCount, 1);

const badges = buildCustomerModelBadges(conditions, 'sportage');
assert.ok(badges.some((b) => /10 % Rabatt/.test(b.label)));
assert.ok(badges.some((b) => /Studentenbonus/.test(b.label)));
assert.ok(badges.some((b) => /gültig bis/.test(b.label)));

const leasingPrep = formatPreparationFeeSuffix(conditions, 'sportage', 'leasing');
assert.match(leasingPrep, /zzgl\. 1\.290 € Überführung/);

const settings = resolveModelSettings(conditions, 'sportage');
settings.preparationFee.cashDisplayMode = 'included';
conditions.modelSettingsByModel.sportage = settings;
const cashPrep = formatPreparationFeeSuffix(conditions, 'sportage', 'cash');
assert.match(cashPrep, /inkl\. 1\.290 € Überführung/);

const models = listManagementModels(conditions);
assert.equal(models.length, 1);

const promo = createEmptyPromotion();
assert.ok(promo.id);
assert.equal(promo.active, true);

console.log('dealerVehicleManagement.test.js: ok');
