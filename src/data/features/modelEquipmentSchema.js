/**
 * Schema für Modell-Ausstattungsdaten (Layer 2).
 * Importierbare Preislisten / Ausstattungsquellen sollen dieses Format anstreben.
 */

/** @typedef {'standard' | 'available' | 'optional' | 'package_required' | 'not_available' | 'unknown'} FeatureAvailabilityStatus */

/** @typedef {'high' | 'medium' | 'low'} DataConfidence */

/**
 * @typedef {object} EquipmentSourceRef
 * @property {string} [document]
 * @property {number | null} [page]
 * @property {string | null} [section]
 * @property {string | null} [rawText]
 * @property {string | null} [url]
 */

/**
 * @typedef {object} EquipmentImportSource
 * @property {'pricelist' | 'equipment_table' | 'technical_data' | 'manual_verified' | string} type
 * @property {string} [documentName]
 * @property {string} [validFrom]
 * @property {DataConfidence} [confidence]
 */

/**
 * @typedef {object} EquipmentImportRecord
 * @property {string} brand
 * @property {string} model
 * @property {string} modelKey
 * @property {string | number} [modelYear]
 * @property {EquipmentImportSource} source
 * @property {{ id: string, label?: string, name?: string }[]} trims
 * @property {{ id: string, label?: string, name?: string, trimIds?: string[] }[]} [packages]
 * @property {object[]} featureAvailability
 */

/**
 * @typedef {object} UnknownImportedFeature
 * @property {string} rawLabel
 * @property {string | null} suggestedFeatureId
 * @property {EquipmentSourceRef} [sourceRef]
 * @property {DataConfidence} confidence
 */

/**
 * @typedef {object} ModelFeatureAvailabilityEntry
 * @property {string} featureId – ID aus globalFeatureCatalog
 * @property {string} trimId
 * @property {string} [trimName]
 * @property {FeatureAvailabilityStatus} status
 * @property {string} [packageId]
 * @property {string} [packageName]
 * @property {string | EquipmentSourceRef} [sourceRef]
 * @property {DataConfidence} confidence
 * @property {EquipmentImportSource} [source]
 */

/**
 * @typedef {object} ModelEquipmentPackage
 * @property {string} id
 * @property {string} name
 * @property {string} [description]
 * @property {string[]} trimIds
 * @property {string[]} [featureIds]
 */

/**
 * @typedef {object} ModelEquipmentTrim
 * @property {string} id
 * @property {string} name
 */

/**
 * @typedef {object} ModelEquipmentProfile
 * @property {string} brand
 * @property {string} model
 * @property {string} modelKey
 * @property {number | null} [modelYear]
 * @property {ModelEquipmentTrim[]} trims
 * @property {ModelEquipmentPackage[]} packages
 * @property {object} [technicalData]
 * @property {ModelFeatureAvailabilityEntry[]} featureAvailability
 * @property {string[]} [sourceRefs]
 * @property {EquipmentImportSource} [source]
 * @property {'import' | 'legacy' | 'merged'} [dataOrigin]
 */

/**
 * @typedef {object} ResolvedModelFeatureAvailability
 * @property {string} featureId
 * @property {string} label
 * @property {FeatureAvailabilityStatus} modelStatus
 * @property {ModelFeatureAvailabilityEntry[]} entries
 * @property {{ trimId: string, trimName: string, via: 'standard' | 'optional' | 'package' }[]} availableTrims
 * @property {{ id: string, name: string, trimId?: string }[]} availablePackages
 * @property {DataConfidence} confidence
 * @property {string[]} sourceRefs
 */

export const FEATURE_AVAILABILITY_STATUS = {
  STANDARD: 'standard',
  AVAILABLE: 'available',
  OPTIONAL: 'optional',
  PACKAGE_REQUIRED: 'package_required',
  NOT_AVAILABLE: 'not_available',
  UNKNOWN: 'unknown',
};

export const DATA_CONFIDENCE_RANK = {
  high: 3,
  medium: 2,
  low: 1,
};
