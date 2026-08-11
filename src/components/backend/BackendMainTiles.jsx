/**
 * Legacy-Export: Home-Kacheln leben jetzt in Widgets + Werkzeuge.
 * formatCleverEingangTileMeta bleibt für bestehende Tests / Aufrufer.
 */
export { default as BackendHomeTools } from './BackendHomeTools.jsx';
export { default as BackendHomeWidgets } from './BackendHomeWidgets.jsx';
export {
  buildBackendHomeEingangStats,
  formatCleverEingangHomeStats,
} from '../../logic/backendHomeStats.js';

/** @deprecated Home nutzt „N offen“ – Alias für bestehende Tests */
export function formatCleverEingangTileMeta({ unreadCount = 0, openCount = 0 } = {}) {
  return `${unreadCount} ungelesen · ${openCount} offene Vorgänge`;
}

export { default } from './BackendHomeTools.jsx';
