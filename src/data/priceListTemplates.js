import { change } from './priceListImport.js';

/** Beispiel-Preislisten (Download-Hinweise im Admin) */
export const PRICE_LIST_EXAMPLES = [
  {
    id: 'kia-sportage',
    brand: 'Kia',
    brandId: 'kia',
    model: 'Sportage',
    fileName: 'Kia_Sportage_Preisliste_2026.csv',
    format: 'CSV',
    description: 'Ausstattungslinien, UPE, WLTP',
  },
  {
    id: 'kia-ev4',
    brand: 'Kia',
    brandId: 'kia',
    model: 'EV4',
    fileName: 'Kia_EV4_Preisliste_2026.pdf',
    format: 'PDF',
    description: 'Neue GT-Line, Reichweiten, Farben',
  },
  {
    id: 'toyota-rav4',
    brand: 'Toyota',
    brandId: 'toyota',
    model: 'RAV4',
    fileName: 'Toyota_RAV4_Preisliste_2026.xlsx',
    format: 'Excel',
    description: 'Hybrid-Preise, Pakete',
  },
  {
    id: 'hyundai-tucson',
    brand: 'Hyundai',
    brandId: 'hyundai',
    model: 'Tucson',
    fileName: 'Hyundai_Tucson_Preisliste_2026.csv',
    format: 'CSV',
    description: 'Modelljahreswechsel 2026',
  },
];

/**
 * KI-Parser-Templates pro Marke/Modell (Demo – erkennt Struktur aus Dateiname + Meta)
 */
export function getTemplateChanges(brandId, model, modelYear, fileName = '') {
  const modelLower = model.toLowerCase();
  const fileLower = fileName.toLowerCase();

  if (brandId === 'kia' && modelLower.includes('ev4')) {
    return [
      change('ev4-1', 'engine', 'Ausstattungslinie', '–', 'EV4 GT-Line neu', `Kia EV4 ${modelYear}`),
      change('ev4-2', 'price', 'GT-Line', '–', '42.990 €', `Kia EV4 ${modelYear}`),
      change('ev4-3', 'price', 'Air', '39.490 €', '40.490 €', `Kia EV4 ${modelYear}`),
      change('ev4-4', 'color', 'Farbe', '–', 'Ivory Silver (neu)', `Kia EV4 ${modelYear}`),
      change('ev4-5', 'wltp', 'Reichweite GT-Line', '520 km', '535 km', `Kia EV4 ${modelYear}`),
      change('ev4-6', 'package', 'Paket', '–', 'Winter-Paket EV', `Kia EV4 ${modelYear}`),
    ];
  }

  if (brandId === 'kia' && modelLower.includes('sportage')) {
    return [
      change('sp-1', 'price', 'Vision', '36.490 €', '36.990 €', `Kia Sportage ${modelYear}`),
      change('sp-2', 'price', 'Spirit', '41.490 €', '41.990 €', `Kia Sportage ${modelYear}`),
      change('sp-3', 'price', 'GT-Line', '44.990 €', '45.490 €', `Kia Sportage ${modelYear}`),
      change('sp-4', 'color', 'Farbe', 'Wolfgrau', 'Steel Grey', `Kia Sportage ${modelYear}`),
      change('sp-5', 'package', 'Paket', 'P4 Panorama', 'P4 Panorama Plus', `Kia Sportage ${modelYear}`),
      change('sp-6', 'wltp', 'WLTP 1.6 T-GDI', '6,4 l/100 km', '6,2 l/100 km', `Kia Sportage ${modelYear}`),
      change('sp-7', 'wltp', 'CO₂ 1.6 T-GDI', '145 g/km', '141 g/km', `Kia Sportage ${modelYear}`),
    ];
  }

  if (brandId === 'toyota' || fileLower.includes('toyota')) {
    const m = modelLower.includes('rav') ? 'RAV4' : model || 'Corolla';
    return [
      change('ty-1', 'price', 'Style', '32.990 €', '33.490 €', `Toyota ${m} ${modelYear}`),
      change('ty-2', 'price', 'Team Deutschland', '35.490 €', '35.990 €', `Toyota ${m} ${modelYear}`),
      change('ty-3', 'package', 'Paket', 'Business-Paket', 'Business-Paket Plus', `Toyota ${m} ${modelYear}`),
      change('ty-4', 'wltp', 'WLTP Hybrid', '4,8 l/100 km', '4,6 l/100 km', `Toyota ${m} ${modelYear}`),
      change('ty-5', 'color', 'Farbe', '–', 'Oxide Bronze (neu)', `Toyota ${m} ${modelYear}`),
    ];
  }

  if (brandId === 'hyundai' || fileLower.includes('hyundai')) {
    const m = modelLower.includes('tucson') ? 'Tucson' : model || 'IONIQ 5';
    return [
      change('hy-1', 'price', 'Pure', '34.900 €', '35.400 €', `Hyundai ${m} ${modelYear}`),
      change('hy-2', 'price', 'N Line', '42.500 €', '43.200 €', `Hyundai ${m} ${modelYear}`),
      change('hy-3', 'color', 'Farbe', '–', 'Meta Blue Pearl (neu)', `Hyundai ${m} ${modelYear}`),
      change('hy-4', 'wltp', 'Reichweite BEV', '507 km', '522 km', `Hyundai ${m} ${modelYear}`),
      change('hy-5', 'package', 'Paket', 'Klima-Paket', 'Klima-Paket Pro', `Hyundai ${m} ${modelYear}`),
    ];
  }

  return [
    change('gen-1', 'price', 'Basis', '–', 'Preis aktualisiert', `${model} ${modelYear}`),
    change('gen-2', 'wltp', 'WLTP', '–', 'Aktualisiert', `${model} ${modelYear}`),
  ];
}
