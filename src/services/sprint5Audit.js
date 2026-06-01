import { appendAuditEntry } from './audit/auditService.js';

export const SPRINT5_AUDIT_TYPES = {
  document_uploaded: 'document_uploaded',
  document_deleted: 'document_deleted',
  vehicle_published: 'vehicle_published',
  compliance_error: 'compliance_error',
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
