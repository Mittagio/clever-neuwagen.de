/**
 * Verifizierte Anhängelast: Stammdaten zuerst, sonst Technical Registry / Preisliste.
 */
import { getVerifiedTechnicalProfile } from '../../../../data/technical/verifiedTechnicalDataRegistry.js';

/**
 * @param {string} modelKey
 * @param {object|null} [record]
 * @param {object|null} [attrs]
 * @returns {{ value: number|string, sourceId: string|null, minKg?: number, maxKg?: number } | null}
 */
export function resolveVerifiedTowingCapacity(modelKey, record = null, attrs = null) {
  const fromRecord = record?.towing?.brakedKg ?? attrs?.towCapacityKg ?? null;
  if (fromRecord != null && Number.isFinite(Number(fromRecord))) {
    return {
      value: Number(fromRecord),
      sourceId: record?.sourceId ?? record?.id ?? `kia:${modelKey}`,
    };
  }

  const profile = getVerifiedTechnicalProfile(modelKey);
  if (!profile?.variants?.length) return null;

  const kgs = profile.variants
    .map((variant) => variant.towing?.brakedKg)
    .filter((kg) => kg != null && Number.isFinite(Number(kg)))
    .map(Number);

  if (!kgs.length) {
    const blocked = profile.variants.some((variant) => variant.towing?.permitted === false);
    if (blocked) {
      return {
        value: 0,
        sourceId: profile.sourceDocument ?? profile.sourceId ?? `tech:${modelKey}`,
      };
    }
    return null;
  }

  const unique = [...new Set(kgs)];
  const sourceId = profile.sourceDocument ?? profile.sourceId ?? `tech:${modelKey}`;
  if (unique.length === 1) {
    return { value: unique[0], sourceId };
  }

  const min = Math.min(...unique);
  const max = Math.max(...unique);
  return {
    value: `${min}–${max}`,
    sourceId,
    minKg: min,
    maxKg: max,
  };
}
