/**
 * @typedef {'draft'|'checked'|'live'|'archived'} RuleStatus
 * @typedef {'draft'|'review'|'live'|'archived'} DataVersionStatus
 * @typedef {'package_availability'|'package_dependency'|'package_exclusion'|'package_included'|'price'|'color'|'trim_standard_equipment'} RuleType
 * @typedef {'seller'|'admin'} ConfiguratorAudience
 * @typedef {'error'|'warning'|'info'} ValidationSeverity
 */

/**
 * @typedef {object} Manufacturer
 * @property {string} id
 * @property {string} name
 * @property {string} [slug]
 * @property {string} [country]
 * @property {DataVersionStatus} [status]
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {object} Model
 * @property {string} id
 * @property {string} manufacturerId
 * @property {string} name
 * @property {string} [slug]
 * @property {string} [segment]
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {object} ModelYear
 * @property {string} id
 * @property {string} manufacturerId
 * @property {string} modelId
 * @property {string} modelYear
 * @property {string} [dataVersion]
 * @property {DataVersionStatus} status
 * @property {string} [priceListDate]
 * @property {string} [tagline]
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {object} Powertrain
 * @property {string} id
 * @property {string} manufacturerId
 * @property {string} modelId
 * @property {string} modelYearId
 * @property {string} name
 * @property {string} [fuelType]
 * @property {string} [transmission]
 * @property {string} [drive]
 * @property {number|null} [batteryKwh]
 * @property {number|null} [powerKw]
 * @property {number|null} [powerPs]
 * @property {number|null} [rangeKm]
 * @property {number|null} [priceFromGross]
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {object} Trim
 * @property {string} id
 * @property {string} manufacturerId
 * @property {string} modelId
 * @property {string} modelYearId
 * @property {string} name
 * @property {string} [shortDescription]
 * @property {number|null} [priceFromGross]
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {object} EquipmentItem
 * @property {string} id
 * @property {string} manufacturerId
 * @property {string} modelId
 * @property {string} modelYearId
 * @property {string} name
 * @property {string} [category]
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {object} OptionPackage
 * @property {string} id
 * @property {string} manufacturerId
 * @property {string} modelId
 * @property {string} modelYearId
 * @property {string} code
 * @property {string} name
 * @property {string} [description]
 * @property {string} [group]
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {object} PackageContent
 * @property {string} id
 * @property {string} manufacturerId
 * @property {string} modelId
 * @property {string} modelYearId
 * @property {string} packageId
 * @property {string} equipmentItemId
 * @property {number} [sortOrder]
 */

/**
 * @typedef {object} FoundationRule
 * @property {string} id
 * @property {string} manufacturerId
 * @property {string} modelId
 * @property {string} modelYearId
 * @property {string|null} trimId
 * @property {string|null} powertrainId
 * @property {string|null} packageId
 * @property {string|null} equipmentItemId
 * @property {string|null} colorId
 * @property {RuleType} ruleType
 * @property {Record<string, unknown>} value
 * @property {number|null} price
 * @property {string} validFrom
 * @property {string|null} validTo
 * @property {string|null} source
 * @property {string|null} sourceDocumentId
 * @property {string|null} checkedBy
 * @property {string|null} checkedAt
 * @property {RuleStatus} status
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {object} SourceDocument
 * @property {string} id
 * @property {string} manufacturerId
 * @property {string} modelId
 * @property {string} modelYearId
 * @property {string} title
 * @property {string} [fileName]
 * @property {string} [url]
 * @property {string} [importedAt]
 * @property {string} createdAt
 */

/**
 * @typedef {object} ChangeLogEntry
 * @property {string} id
 * @property {string} manufacturerId
 * @property {string} modelId
 * @property {string} modelYearId
 * @property {string} summary
 * @property {string} [detail]
 * @property {string} [source]
 * @property {string} [author]
 * @property {RuleStatus|DataVersionStatus} [status]
 * @property {string} createdAt
 */

/**
 * @typedef {object} ConfiguratorFoundationDatabase
 * @property {number} schemaVersion
 * @property {Manufacturer[]} manufacturers
 * @property {Model[]} models
 * @property {ModelYear[]} modelYears
 * @property {Powertrain[]} powertrains
 * @property {Trim[]} trims
 * @property {EquipmentItem[]} equipmentItems
 * @property {OptionPackage[]} optionPackages
 * @property {PackageContent[]} packageContents
 * @property {FoundationRule[]} rules
 * @property {SourceDocument[]} sourceDocuments
 * @property {ChangeLogEntry[]} changeLogs
 */

/**
 * @typedef {object} ModelYearBundle
 * @property {Manufacturer|null} manufacturer
 * @property {Model|null} model
 * @property {ModelYear|null} modelYear
 * @property {Powertrain[]} powertrains
 * @property {Trim[]} trims
 * @property {EquipmentItem[]} equipmentItems
 * @property {OptionPackage[]} optionPackages
 * @property {PackageContent[]} packageContents
 * @property {FoundationRule[]} rules
 * @property {SourceDocument[]} sourceDocuments
 * @property {ChangeLogEntry[]} changeLogs
 * @property {{ manufacturerId: string, modelId: string, modelYearId: string }} scope
 */

/**
 * @typedef {object} ConfigurationSelection
 * @property {string|null} trimId
 * @property {string|null} powertrainId
 * @property {string|null} colorId
 * @property {string[]} packageIds
 */

/**
 * @typedef {'available'|'selected'|'included'|'blocked'|'unavailable'|'hidden'} PackageEvaluationStatus
 */

/**
 * @typedef {object} EvaluatedPackage
 * @property {string} id
 * @property {string} code
 * @property {string} name
 * @property {PackageEvaluationStatus} status
 * @property {number|null} priceGross
 * @property {string[]} highlights
 * @property {string|null} includedInTrimLabel
 * @property {string[]} missingRequiredLabels
 * @property {string[]} excludedByLabels
 * @property {string[]} dependencyHints
 * @property {boolean} usesDraftRules
 */

export {};
