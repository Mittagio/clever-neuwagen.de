import express from 'express';
import { setIntelligenceStorageAdapter } from '../src/services/intelligenceStorageAdapter.js';
import { setTrendPublishAdapter } from '../src/services/trendPublishAdapter.js';
import { createFileStorageAdapter } from './fileEventStore.js';
import { createPublishedTrendsAdapter, replacePublishedTrends } from './publishedTrendsStore.js';

setIntelligenceStorageAdapter(createFileStorageAdapter());
setTrendPublishAdapter(createPublishedTrendsAdapter());

const { getIntelligenceApiResponseSafe, INTELLIGENCE_API_VERSION } = await import('../src/services/intelligenceApi.js');
const { INTELLIGENCE_EVENT } = await import('../src/services/intelligenceAnalytics.js');
const { appendEventToFile, mergeEventsInFile, replaceEventsInFile } = await import('./fileEventStore.js');

const router = express.Router();

router.get('/v1/intelligence/events', (_req, res) => {
  const data = createFileStorageAdapter().load();
  res.json({
    events: data.events,
    lastUpdated: data.lastUpdated,
    count: data.events.length,
  });
});

router.get('/v1/trends/published', (_req, res) => {
  const data = createPublishedTrendsAdapter().load();
  res.json({
    pages: data.pages,
    lastUpdated: data.lastUpdated,
    count: data.pages.length,
  });
});

router.post('/v1/trends/published', express.json({ limit: '128kb' }), (req, res) => {
  const { pages, mode } = req.body ?? {};

  if (!Array.isArray(pages)) {
    return res.status(400).json({ error: true, message: 'pages array required' });
  }

  const data = mode === 'replace'
    ? replacePublishedTrends(pages)
    : replacePublishedTrends([
      ...createPublishedTrendsAdapter().load().pages,
      ...pages,
    ].filter((page, index, all) => all.findIndex((p) => p.slug === page.slug) === index));

  res.json({ ok: true, count: data.pages.length, mode: mode ?? 'merge' });
});

router.get('/v1/intelligence/:resource', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const period = req.query.period ?? '7d';
  const payload = getIntelligenceApiResponseSafe(req.params.resource, period, baseUrl);
  const status = payload.error ? (payload.code === 'NOT_FOUND' ? 404 : 400) : 200;
  res.status(status).json(payload);
});

router.post('/v1/intelligence/events', express.json({ limit: '512kb' }), (req, res) => {
  const { event, events, mode } = req.body ?? {};

  if (Array.isArray(events)) {
    const data = mode === 'replace'
      ? replaceEventsInFile(events)
      : mergeEventsInFile(events);
    return res.json({ ok: true, count: data.events.length, mode: mode ?? 'merge' });
  }

  if (!event?.type) {
    return res.status(400).json({ error: true, message: 'event.type required' });
  }

  const validTypes = new Set(Object.values(INTELLIGENCE_EVENT));
  if (!validTypes.has(event.type)) {
    return res.status(400).json({ error: true, message: 'invalid event type' });
  }

  const data = appendEventToFile({
    ...event,
    at: event.at ?? new Date().toISOString(),
  });

  res.json({ ok: true, count: data.events.length });
});

router.get('/v1/intelligence', (_req, res) => {
  res.json({
    apiVersion: INTELLIGENCE_API_VERSION,
    message: 'Clever Intelligence API',
    docs: '/intelligence/api',
    example: '/api/v1/intelligence/overview?period=7d',
    eventsSync: '/api/v1/intelligence/events',
    trendsPublished: '/api/v1/trends/published',
  });
});

export default router;
