function formatDeliveryTime(item, fallback) {
  if (item.eta) {
    const date = new Date(item.eta);
    if (!Number.isNaN(date.getTime())) {
      const weeks = Math.max(1, Math.ceil((date - Date.now()) / (7 * 24 * 60 * 60 * 1000)));
      return weeks === 1 ? '1 Woche' : `${weeks} Wochen`;
    }
  }
  if (item.type === 'lager') return 'Sofort';
  const raw = fallback ?? '4 Wochen';
  return raw.replace('4–6 Wochen', '4 Wochen').replace('–', '–');
}

function findMarketplaceMatch(item, pool) {
  return pool.find((v) => {
    if (v.model !== item.model) return false;
    const eq = (item.equipment ?? '').toLowerCase();
    if (!eq) return true;
    return (v.title ?? '').toLowerCase().includes(eq)
      || (v.equipment ?? []).some((e) => String(e).toLowerCase().includes(eq));
  }) ?? pool.find((v) => v.model === item.model);
}

export function enrichDealerStockItem(item, marketplacePool = [], conditions = {}) {
  const match = findMarketplaceMatch(item, marketplacePool);
  const title = match?.title ?? `Kia ${item.model} ${item.equipment ?? ''}`.trim();

  return {
    ...item,
    displayTitle: title,
    monthlyRate: match?.monthlyRate ?? 299,
    deliveryLabel: formatDeliveryTime(item, match?.deliveryTime ?? conditions.deliveryTime),
    slug: match?.slug ?? null,
    imageModel: match?.imageModel ?? item.model,
    brand: 'Kia',
    dealerId: conditions.dealerId ?? item.dealerId,
  };
}
