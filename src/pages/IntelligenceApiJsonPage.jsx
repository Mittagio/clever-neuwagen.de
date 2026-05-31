import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getIntelligenceApiResponseSafe } from '../services/intelligenceApi.js';

/**
 * Rohe JSON-Antwort für /api/v1/intelligence/:resource
 * Maschinenlesbar · ohne UI-Chrome
 */
export default function IntelligenceApiJsonPage() {
  const { resource } = useParams();
  const [searchParams] = useSearchParams();
  const period = searchParams.get('period') ?? '7d';

  const json = useMemo(
    () => getIntelligenceApiResponseSafe(resource ?? 'manifest', period),
    [resource, period],
  );

  const text = JSON.stringify(json, null, 2);

  return (
    <pre
      className="intel-api-json"
      style={{
        margin: 0,
        padding: '16px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '13px',
        lineHeight: 1.5,
        background: '#0f172a',
        color: '#e2e8f0',
        minHeight: '100dvh',
      }}
    >
      {text}
    </pre>
  );
}
