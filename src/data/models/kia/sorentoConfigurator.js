/**
 * Sorento – Konfigurator-Stammdaten für die Händler-Customer-Journey (Phase 2).
 * Preise & Kaufart folgen in späteren Phasen.
 */
export const sorentoConfigurator = {
  id: 'sorento',
  modelKey: 'sorento',
  label: 'Sorento',
  headline: 'Sorento konfigurieren',
  subtitle: 'Wählen Sie Farbe, Antrieb, Ausstattung und Pakete – Schritt für Schritt wie beim Verkäufer.',
  colors: [
    { id: 'black', label: 'Schwarz', imageSlug: 'aurorablackpearl' },
    { id: 'grey', label: 'Grau', imageSlug: 'interstellargrey' },
    { id: 'white', label: 'Weiß', imageSlug: 'snowwhitepearl' },
  ],
  powertrains: [
    { id: 'hybrid', label: 'Hybrid', modelKey: 'sorento-hybrid' },
    { id: 'phev', label: 'Plug-in Hybrid', modelKey: 'sorento-phev' },
  ],
  trims: [
    { id: 'vision', label: 'Vision' },
    { id: 'spirit', label: 'Spirit' },
    { id: 'platinum', label: 'Platinum' },
  ],
  packages: [
    { id: 'ahk', label: 'AHK', priceGross: 1290 },
    { id: 'winter-raeder', label: 'Winterräder', priceGross: 1890 },
    { id: 'wartung', label: 'Wartung', priceGross: 890 },
    { id: 'wartung-verschleiss', label: 'Wartung + Verschleiß', priceGross: 1490 },
  ],
  colorSurcharges: {
    grey: 790,
  },
  defaults: {
    colorId: 'black',
    powertrainId: 'hybrid',
    trimId: 'spirit',
    packageIds: [],
  },
};
