/**
 * @typedef {'base' | 'color' | 'package' | 'accessory'} UvpLineItemType
 */

/**
 * @typedef {object} UvpLineItem
 * @property {string} id
 * @property {UvpLineItemType} type
 * @property {string} label
 * @property {number} amount
 */

/**
 * @typedef {object} VehicleConfiguration
 * @property {string} brand
 * @property {string} model
 * @property {string} modelKey
 * @property {string|null} trimId
 * @property {string|null} trimLabel
 * @property {string|null} engineId
 * @property {string|null} motorLabel
 * @property {string|null} batteryLabel
 * @property {string|null} colorId
 * @property {string|null} colorLabel
 * @property {string[]} packageIds
 * @property {string[]} accessoryIds
 * @property {Record<string, boolean>} extras
 * @property {{ id: string, name: string, priceGross: number, status: string }[]} selectedPackages
 * @property {{ id: string, name: string }[]} includedPackages
 * @property {{ id: string, name: string, priceGross: number }[]} accessories
 * @property {{ id: string, name: string }[]} dealerExtras
 * @property {number|null} uvpBasePrice
 * @property {number|null} uvpConfigurationPrice
 * @property {UvpLineItem[]} uvpLineItems
 */

/**
 * @typedef {object} OfferConditions
 * @property {string} paymentType
 * @property {number} termMonths
 * @property {number} mileagePerYear
 * @property {number} downPayment
 * @property {number} preparationFee
 * @property {number|null} desiredRate
 * @property {number|null} desiredPrice
 * @property {string|null} desiredDeliveryDate
 * @property {Record<string, boolean>} extras
 */

/**
 * @typedef {object} OfferCalculation
 * @property {number|null} configurationPrice
 * @property {number|null} discountPercent
 * @property {number|null} discountAmount
 * @property {number|null} housePrice
 * @property {number|null} cashPrice
 * @property {number|null} monthlyRate
 * @property {number|null} leasingRate
 * @property {number|null} financeRate
 * @property {number} preparationFee
 * @property {string} paymentType
 * @property {number} termMonths
 * @property {number} mileagePerYear
 * @property {number} downPayment
 */

export {};
