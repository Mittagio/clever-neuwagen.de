import { appendAuditEntry } from './audit/auditService.js';

export const SPRINT5_AUDIT_TYPES = {
  document_uploaded: 'document_uploaded',
  document_deleted: 'document_deleted',
  vehicle_published: 'vehicle_published',
  compliance_error: 'compliance_error',
  compliance_checked: 'compliance_checked',
  publish_blocked: 'publish_blocked',
  legal_block_copied: 'legal_block_copied',
  compliance_approved: 'compliance_approved',
  compliance_source_changed: 'compliance_source_changed',
  selbstauskunft_created: 'selbstauskunft_created',
};

export function auditDocumentUploaded(doc, actor = 'Kunde') {
  return appendAuditEntry({
    type: SPRINT5_AUDIT_TYPES.document_uploaded,
    actor,
    actorRole: 'customer',
    action: `Dokument hochgeladen: ${doc.fileType} (${doc.fileName})`,
    target: doc.id,
  });
}

export function auditDocumentDeleted(doc, { automatic = false, actor = 'System' } = {}) {
  return appendAuditEntry({
    type: SPRINT5_AUDIT_TYPES.document_deleted,
    actor,
    actorRole: automatic ? 'system' : 'dealer',
    action: automatic
      ? `Dokument automatisch gelöscht: ${doc.fileType}`
      : `Dokument gelöscht: ${doc.fileType}`,
    target: doc.id,
  });
}

export function auditSelbstauskunftCreated(item, actor = 'Kunde') {
  return appendAuditEntry({
    type: SPRINT5_AUDIT_TYPES.selbstauskunft_created,
    actor,
    actorRole: 'customer',
    action: `Selbstauskunft erstellt: ${item.personal?.firstName} ${item.personal?.lastName}`,
    target: item.id,
  });
}

export function auditComplianceError(vehicleLabel, missing, actor = 'System') {
  return appendAuditEntry({
    type: SPRINT5_AUDIT_TYPES.compliance_error,
    actor,
    actorRole: 'system',
    action: `Compliance: Pflichtangaben fehlen (${vehicleLabel}): ${missing.join(', ')}`,
    target: vehicleLabel,
  });
}

export function auditVehiclePublished(vehicleLabel, actor = 'Verkäufer') {
  return appendAuditEntry({
    type: SPRINT5_AUDIT_TYPES.vehicle_published,
    actor,
    actorRole: 'dealer',
    action: `Fahrzeug veröffentlicht: ${vehicleLabel}`,
    target: vehicleLabel,
  });
}

export function auditComplianceChecked(vehicleLabel, score, actor = 'System') {
  return appendAuditEntry({
    type: SPRINT5_AUDIT_TYPES.compliance_checked,
    actor,
    actorRole: 'system',
    action: `Compliance geprüft: ${vehicleLabel} (${score} %)`,
    target: vehicleLabel,
  });
}

export function auditPublishBlocked(vehicleLabel, missingFields = [], actor = 'Compliance Shield') {
  const labels = missingFields.map((f) => (typeof f === 'string' ? f : f.label)).join(', ');
  return appendAuditEntry({
    type: SPRINT5_AUDIT_TYPES.publish_blocked,
    actor,
    actorRole: 'system',
    action: `Veröffentlichung blockiert: ${vehicleLabel}${labels ? ` – ${labels}` : ''}`,
    target: vehicleLabel,
  });
}

export function auditLegalBlockCopied(vehicleLabel, channel, actor = 'Verkäufer') {
  return appendAuditEntry({
    type: SPRINT5_AUDIT_TYPES.legal_block_copied,
    actor,
    actorRole: 'dealer',
    action: `Pflichtblock kopiert: ${vehicleLabel}${channel ? ` (${channel})` : ''}`,
    target: vehicleLabel,
  });
}

export function auditComplianceApproved(vehicleLabel, actor = 'Admin') {
  return appendAuditEntry({
    type: SPRINT5_AUDIT_TYPES.compliance_approved,
    actor,
    actorRole: 'admin',
    action: `WLTP-Daten freigegeben: ${vehicleLabel}`,
    target: vehicleLabel,
  });
}

export function auditComplianceSourceChanged(vehicleLabel, source, actor = 'Admin') {
  return appendAuditEntry({
    type: SPRINT5_AUDIT_TYPES.compliance_source_changed,
    actor,
    actorRole: 'admin',
    action: `Compliance-Quelle geändert: ${vehicleLabel} → ${source}`,
    target: vehicleLabel,
  });
}
