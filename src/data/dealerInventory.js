/**
 * Statisches Lager anderer Händler (Demo)
 */
export const staticDealerInventory = {
  'autohaus-stuttgart': [
    {
      id: 'stg-001',
      type: 'vorlauf',
      model: 'Sportage',
      engineId: 'mhev-150',
      trimId: 'vision',
      colorId: 'panthera-black',
      color: 'Panthera Black',
      equipment: 'Vision',
      vin: '',
      eta: '2025-07-12',
      location: 'Stuttgart Zentrum',
    },
    {
      id: 'stg-002',
      type: 'bestellt',
      model: 'Sportage',
      engineId: 'diesel-136',
      trimId: 'pulse',
      colorId: 'steel-grey',
      color: 'Steel Grey',
      equipment: 'Pulse',
      vin: 'KNADM5A30S6999001',
      eta: '2025-08-01',
      location: 'Stuttgart Lager',
    },
  ],
  'autohaus-ulm': [
    {
      id: 'ulm-001',
      type: 'konfigurierbar',
      model: 'Sportage',
      engineId: 'mhev-150',
      trimId: 'vision',
      colorId: 'snow-white',
      color: 'Snow White Pearl',
      equipment: 'Vision',
      vin: '',
      eta: null,
      location: 'Ulm',
    },
  ],
};

export function getInventoryForDealer(dealerId, conditions) {
  if (dealerId === 'autohaus-trinkle') {
    return conditions.inventoryVehicles ?? conditions.inventory ?? [];
  }
  return staticDealerInventory[dealerId] ?? [];
}
