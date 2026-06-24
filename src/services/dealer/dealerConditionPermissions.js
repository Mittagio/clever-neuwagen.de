/**
 * Rollenrechte für Konditionen – Verkäufer pflegt, Leiter veröffentlicht
 */
import { canAccess, PERMISSIONS } from '../../data/rolesConfig.js';

export const CONDITION_PERMISSIONS = {
  EDIT: PERMISSIONS.dealerConditionsEdit,
  PUBLISH: PERMISSIONS.dealerConditionsPublish,
};

export function canEditConditions(roleId = 'dealerAdmin') {
  return canAccess(roleId, CONDITION_PERMISSIONS.EDIT)
    || canAccess(roleId, PERMISSIONS.dealerConditions);
}

export function canPublishConditions(roleId = 'dealerAdmin') {
  return canAccess(roleId, CONDITION_PERMISSIONS.PUBLISH)
    || canAccess(roleId, PERMISSIONS.dealerConditions);
}

export function getConditionRoleHint(roleId = 'sales') {
  if (canPublishConditions(roleId)) {
    return 'Sie können Konditionen pflegen und veröffentlichen.';
  }
  if (canEditConditions(roleId)) {
    return 'Sie können Konditionen pflegen. Veröffentlichung durch Verkaufsleitung.';
  }
  return 'Keine Berechtigung für Konditionen.';
}
