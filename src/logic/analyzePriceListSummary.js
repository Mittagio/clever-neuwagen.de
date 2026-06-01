export function buildSummaryFromChanges(changes) {
  return {
    priceChanges: changes.filter((c) => c.type === 'price').length,
    newColors: changes.filter((c) => c.type === 'color').length,
    newPackages: changes.filter((c) => c.type === 'package').length,
    wltpUpdated: changes.some((c) => c.type === 'wltp'),
    newEngines: changes.filter((c) => c.type === 'engine').length,
  };
}
