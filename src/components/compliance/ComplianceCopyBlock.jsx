import { useMemo } from 'react';
import CopyBlock from '../listing/CopyBlock.jsx';
import {
  appendLegalBlockToText,
  validateVehicleCompliance,
} from '../../logic/complianceShield.js';
import {
  auditComplianceChecked,
  auditLegalBlockCopied,
  auditPublishBlocked,
} from '../../services/sprint5Audit.js';

export default function ComplianceCopyBlock({
  vehicleRef,
  validation: validationProp,
  label,
  text,
  compact = false,
  channelId,
}) {
  const validation = useMemo(
    () => validationProp ?? validateVehicleCompliance(vehicleRef ?? {}),
    [validationProp, vehicleRef],
  );

  const copyText = useMemo(() => {
    if (!validation.publishable) return text;
    return appendLegalBlockToText(text, validation);
  }, [text, validation]);

  function handleCopied() {
    auditComplianceChecked(validation.vehicleLabel, validation.score);
    if (!validation.publishable) {
      auditPublishBlocked(validation.vehicleLabel, validation.missingFields);
      return;
    }
    auditLegalBlockCopied(validation.vehicleLabel, channelId ?? label);
  }

  return (
    <CopyBlock
      label={label}
      text={copyText}
      compact={compact}
      disabled={!validation.publishable}
      disabledReason={validation.blockedCopyMessage}
      onCopied={handleCopied}
    />
  );
}
