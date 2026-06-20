/**
 * Modellspezifische Lackfarben – aus Kia-Preislisten / kiaModelImages.
 * Wird ergänzt, wenn Hersteller-Registry noch keine colors[] hat.
 */
export const MODEL_COLOR_CATALOG = {
  ev3: [
    { id: 'clearwhite', label: 'Clear White', priceGross: 0 },
    { id: 'snowwhitepearl', label: 'Snow White Pearl', priceGross: 790 },
    { id: 'aurorablackpearl', label: 'Aurora Black Pearl', priceGross: 790 },
    { id: 'shalegrey', label: 'Shale Grey', priceGross: 790 },
    { id: 'frostblue', label: 'Frost Blue', priceGross: 790 },
    { id: 'ivorysilver', label: 'Ivory Silver', priceGross: 790 },
    { id: 'aventurinegreen', label: 'Aventurine Green', priceGross: 790 },
    { id: 'terracotta', label: 'Terracotta', priceGross: 790 },
  ],
  ev4: [
    { id: 'clearwhite', label: 'Clear White', priceGross: 0 },
    { id: 'aurorablackpearl', label: 'Aurora Black Pearl', priceGross: 790 },
    { id: 'wolfgray', label: 'Wolf Gray', priceGross: 790 },
    { id: 'oceanblue', label: 'Ocean Blue', priceGross: 790 },
    { id: 'runwayred', label: 'Runway Red', priceGross: 790 },
    { id: 'snowwhitepearl', label: 'Snow White Pearl', priceGross: 990 },
  ],
  ev5: [
    { id: 'clearwhite', label: 'Clear White', priceGross: 0 },
    { id: 'aurorablackpearl', label: 'Aurora Black Pearl', priceGross: 790 },
    { id: 'wolfgray', label: 'Wolf Gray', priceGross: 790 },
    { id: 'oceanblue', label: 'Ocean Blue', priceGross: 790 },
    { id: 'snowwhitepearl', label: 'Snow White Pearl', priceGross: 990 },
  ],
  ev6: [
    { id: 'clearwhite', label: 'Clear White', priceGross: 0 },
    { id: 'aurorablackpearl', label: 'Aurora Black Pearl', priceGross: 790 },
    { id: 'wolfgray', label: 'Wolf Gray', priceGross: 790 },
    { id: 'oceanblue', label: 'Ocean Blue', priceGross: 790 },
    { id: 'runwayred', label: 'Runway Red', priceGross: 790 },
    { id: 'snowwhitepearl', label: 'Snow White Pearl', priceGross: 990 },
  ],
  ev9: [
    { id: 'clearwhite', label: 'Clear White', priceGross: 0 },
    { id: 'aurorablackpearl', label: 'Aurora Black Pearl', priceGross: 790 },
    { id: 'wolfgray', label: 'Wolf Gray', priceGross: 790 },
    { id: 'oceanblue', label: 'Ocean Blue', priceGross: 790 },
    { id: 'snowwhitepearl', label: 'Snow White Pearl', priceGross: 990 },
  ],
  stonic: [
    { id: 'clearwhite', label: 'Clear White', priceGross: 0 },
    { id: 'snowwhitepearl', label: 'Snow White Pearl', priceGross: 790 },
    { id: 'aurorablackpearl', label: 'Aurora Black Pearl', priceGross: 790 },
    { id: 'sparklingsilver', label: 'Sparkling Silver', priceGross: 790 },
    { id: 'astrogray', label: 'Astro Gray', priceGross: 790 },
    { id: 'smokeblue', label: 'Smoke Blue', priceGross: 790 },
    { id: 'yachtblue', label: 'Yacht Blue', priceGross: 790 },
    { id: 'signalred', label: 'Signal Red', priceGross: 790 },
    { id: 'adventurousgreen', label: 'Adventurous Green', priceGross: 790 },
  ],
  xceed: [
    { id: 'clearwhite', label: 'Clear White', priceGross: 0 },
    { id: 'aurorablackpearl', label: 'Aurora Black Pearl', priceGross: 790 },
    { id: 'wolfgray', label: 'Wolf Gray', priceGross: 790 },
    { id: 'runwayred', label: 'Runway Red', priceGross: 790 },
    { id: 'snowwhitepearl', label: 'Snow White Pearl', priceGross: 990 },
  ],
  niro: [
    { id: 'clearwhite', label: 'Clear White', priceGross: 0 },
    { id: 'aurorablackpearl', label: 'Aurora Black Pearl', priceGross: 790 },
    { id: 'wolfgray', label: 'Wolf Gray', priceGross: 790 },
    { id: 'runwayred', label: 'Runway Red', priceGross: 790 },
    { id: 'snowwhitepearl', label: 'Snow White Pearl', priceGross: 990 },
  ],
  picanto: [
    { id: 'clearwhite', label: 'Clear White', priceGross: 0 },
    { id: 'aurorablackpearl', label: 'Aurora Black Pearl', priceGross: 790 },
    { id: 'signalred', label: 'Signal Red', priceGross: 790 },
    { id: 'sparklingsilver', label: 'Sparkling Silver', priceGross: 790 },
    { id: 'astrogray', label: 'Astro Gray', priceGross: 790 },
  ],
  ceed: [
    { id: 'clearwhite', label: 'Clear White', priceGross: 0 },
    { id: 'aurorablackpearl', label: 'Aurora Black Pearl', priceGross: 790 },
    { id: 'wolfgray', label: 'Wolf Gray', priceGross: 790 },
    { id: 'runwayred', label: 'Runway Red', priceGross: 790 },
    { id: 'snowwhitepearl', label: 'Snow White Pearl', priceGross: 990 },
  ],
};

export function getModelColorCatalog(modelKey) {
  const key = String(modelKey ?? '').toLowerCase();
  return MODEL_COLOR_CATALOG[key] ?? null;
}
