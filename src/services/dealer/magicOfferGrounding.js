/**
 * Magic Offer Grounding – Intent gegen verifizierte Herstellerdaten auflösen.
 */
import { resolveConfigureModel } from '../configuration/configureModelBridge.js';

function normalizeKey(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function resolveModelKey(hint, fallbackModelKey = null) {
  if (fallbackModelKey) return fallbackModelKey;
  if (!hint) return null;
  const key = normalizeKey(hint);
  if (key.startsWith('ev')) return key.replace(/^ev/, 'ev');
  const map = {
    ev2: 'ev2',
    ev3: 'ev3',
    ev4: 'ev4',
    ev5: 'ev5',
    ev6: 'ev6',
    ev9: 'ev9',
    sportage: 'sportage',
    ceed: 'ceed',
    picanto: 'picanto',
    niro: 'niro',
    sorento: 'sorento',
    stonic: 'stonic',
    xceed: 'xceed',
    soul: 'esoul',
    esoul: 'esoul',
  };
  return map[key] ?? key;
}

function resolvePackageId(data, codeOrAlias, trimId) {
  const needle = normalizeKey(codeOrAlias);
  const codeUpper = String(codeOrAlias).toUpperCase().replace(/\s+/g, '');
  const packages = data?.packages ?? [];
  for (const pkg of packages) {
    const candidates = [
      pkg.id,
      pkg.code,
      pkg.name,
      ...(pkg.aliases ?? []),
    ]
      .filter(Boolean)
      .map(normalizeKey);
    const nameCode = String(pkg.name ?? '').match(/\bP\s*([1-9]\d?)\b/i);
    if (nameCode) candidates.push(normalizeKey(`P${nameCode[1]}`));
    const idCode = String(pkg.id ?? '').match(/p(\d+)$/i);
    if (idCode) candidates.push(normalizeKey(`P${idCode[1]}`));

    if (
      candidates.includes(needle)
      || candidates.includes(normalizeKey(codeUpper))
      || String(pkg.code ?? '').toUpperCase() === codeUpper
    ) {
      if (pkg.availableTrims?.length && trimId && !pkg.availableTrims.includes(trimId)) {
        return { ok: false, reason: 'package_trim_mismatch', package: pkg };
      }
      return { ok: true, package: pkg };
    }
  }
  return { ok: false, reason: 'unknown_package', package: null };
}

/**
 * @param {object} intent – parseMagicOfferIntent result
 * @param {{ modelKey?: string|null, trimId?: string|null }} [context]
 */
export function groundMagicOfferIntent(intent = {}, context = {}) {
  const modelKey = resolveModelKey(intent.vehicleRequest?.modelHint, context.modelKey);
  const mfg = modelKey ? resolveConfigureModel(modelKey) : null;
  const data = mfg?.data ?? null;

  if (!modelKey || !data) {
    return {
      ok: false,
      status: 'needs_review',
      reason: 'unknown_model',
      message: 'Modell konnte ich nicht sicher zuordnen.',
      grounded: null,
      unresolvedPackages: intent.vehicleRequest?.packageKeys ?? [],
    };
  }

  const trimHint = intent.vehicleRequest?.trimHint ?? context.trimId ?? null;
  const trim = (data.trims ?? []).find((t) => t.id === trimHint)
    ?? (data.trims ?? []).find((t) => normalizeKey(t.name) === normalizeKey(trimHint))
    ?? null;

  const engineHint = intent.vehicleRequest?.motorHint ?? null;
  const engine = (data.engines ?? []).find((e) => e.id === engineHint)
    ?? (data.engines ?? []).find((e) => /long/i.test(e.name) && (!engineHint || engineHint.includes('long')))
    ?? (data.engines ?? [])[0]
    ?? null;

  const variant = (data.variants ?? []).find((v) => (
    (!trim || v.trimId === trim.id) && (!engine || v.engineId === engine.id)
  ))
    ?? (data.variants ?? []).find((v) => !trim || v.trimId === trim.id)
    ?? null;

  if (!variant?.priceGross) {
    return {
      ok: false,
      status: 'needs_review',
      reason: 'missing_list_price',
      message: 'Preis bitte prüfen – keine verifizierte UPE gefunden.',
      grounded: null,
      unresolvedPackages: intent.vehicleRequest?.packageKeys ?? [],
    };
  }

  const colorHint = intent.vehicleRequest?.colorHint ?? null;
  const color = colorHint
    ? (data.colors ?? []).find((c) => c.id === colorHint || normalizeKey(c.label) === normalizeKey(colorHint))
    : null;

  const lineItems = [{
    id: variant.id,
    kind: 'base',
    label: `Kia ${data.model}${trim ? ` ${trim.name}` : ''}`,
    amount: variant.priceGross,
    source: 'verified_price_list',
  }];

  const resolvedPackages = [];
  const unresolvedPackages = [];
  const packageIds = [];

  for (const code of intent.vehicleRequest?.packageKeys ?? []) {
    const resolved = resolvePackageId(data, code, trim?.id);
    if (!resolved.ok || !resolved.package) {
      unresolvedPackages.push(code);
      continue;
    }
    const pkg = resolved.package;
    if (packageIds.includes(pkg.id)) continue;
    packageIds.push(pkg.id);
    resolvedPackages.push(pkg);
    lineItems.push({
      id: pkg.id,
      kind: 'package',
      label: pkg.name,
      amount: pkg.priceGross,
      source: 'verified_price_list',
      code: pkg.code ?? null,
    });
  }

  if (color) {
    lineItems.push({
      id: color.id,
      kind: 'color',
      label: color.label,
      amount: color.priceGross ?? 0,
      source: 'verified_price_list',
    });
  } else if (intent.vehicleRequest?.colorHint) {
    return {
      ok: false,
      status: 'needs_review',
      reason: 'unknown_color',
      message: `Farbe „${intent.vehicleRequest.colorHint}“ finde ich nicht sicher.`,
      grounded: null,
      unresolvedPackages,
    };
  }

  const suggestions = unresolvedPackages.length
    ? (data.packages ?? [])
      .filter((pkg) => !trim?.id || !pkg.availableTrims?.length || pkg.availableTrims.includes(trim.id))
      .slice(0, 6)
      .map((pkg) => ({ id: pkg.id, code: pkg.code ?? null, label: pkg.name, priceGross: pkg.priceGross }))
    : [];

  return {
    ok: unresolvedPackages.length === 0,
    status: unresolvedPackages.length ? 'needs_review' : 'grounded',
    reason: unresolvedPackages.length ? 'unknown_package' : null,
    message: unresolvedPackages.length
      ? `${unresolvedPackages.join(', ')} finde ich beim ${data.model}${trim ? ` ${trim.name}` : ''} nicht sicher.`
      : null,
    grounded: {
      modelKey,
      brand: data.brand ?? 'Kia',
      model: data.model,
      trimId: trim?.id ?? null,
      trimLabel: trim?.name ?? null,
      engineId: engine?.id ?? null,
      engineLabel: engine?.name ?? null,
      variantId: variant.id,
      basePrice: variant.priceGross,
      colorId: color?.id ?? null,
      colorLabel: color?.label ?? null,
      packageIds,
      resolvedPackages,
      lineItems,
    },
    unresolvedPackages,
    suggestions,
  };
}
