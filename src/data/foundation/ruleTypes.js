/** Regel- und Validierungsstatus – herstellerübergreifend */

export const RULE_STATUS = Object.freeze({
  DRAFT: 'draft',
  CHECKED: 'checked',
  LIVE: 'live',
  ARCHIVED: 'archived',
});

/** Für Verkäufer-Konfigurator zulässige Regel-Status */
export const SELLER_RULE_STATUSES = Object.freeze([RULE_STATUS.LIVE]);

/** Admin-Test: live + geprüft, Entwürfe mit Warnung */
export const ADMIN_TEST_RULE_STATUSES = Object.freeze([
  RULE_STATUS.LIVE,
  RULE_STATUS.CHECKED,
  RULE_STATUS.DRAFT,
]);

export const RULE_TYPE = Object.freeze({
  PACKAGE_AVAILABILITY: 'package_availability',
  PACKAGE_DEPENDENCY: 'package_dependency',
  PACKAGE_EXCLUSION: 'package_exclusion',
  PACKAGE_INCLUDED: 'package_included',
  PRICE: 'price',
  COLOR: 'color',
  TRIM_STANDARD_EQUIPMENT: 'trim_standard_equipment',
});

export const VALIDATION_SEVERITY = Object.freeze({
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
});

export const CONFIGURATOR_AUDIENCE = Object.freeze({
  SELLER: 'seller',
  ADMIN: 'admin',
});

export const DATA_VERSION_STATUS = Object.freeze({
  DRAFT: 'draft',
  REVIEW: 'review',
  LIVE: 'live',
  ARCHIVED: 'archived',
});
