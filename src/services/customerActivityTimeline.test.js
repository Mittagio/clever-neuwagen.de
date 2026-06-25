import assert from 'node:assert/strict';
import {
  buildCleverQuestionActivity,
  buildFavoriteActivity,
  buildVariantViewedActivity,
  detectCleverInsights,
  formatTimelinePresentation,
  getActivityDashboard,
  getLastCustomerActivityHint,
  isCustomerEngagementEntry,
  mergeInsightActivities,
} from './customerActivityTimeline.js';

const history = [
  {
    id: '1',
    at: '2026-06-25T13:42:00.000Z',
    type: 'customer_activity',
    text: 'Kia EV4 Earth favorisiert',
    activityKind: 'favorite_detected',
    customerFacing: true,
    modelLabel: 'Kia EV4',
    trimLabel: 'Earth',
  },
  {
    id: '2',
    at: '2026-06-25T13:40:00.000Z',
    type: 'customer_activity',
    text: 'Frage: „Wie weit komme ich mit der großen Batterie?“',
    activityKind: 'clever_question',
    customerFacing: true,
    question: 'Wie weit komme ich mit der großen Batterie?',
    cleverAnswer: 'Bis zu 610 km WLTP.',
  },
  {
    id: '3',
    at: '2026-06-25T13:38:00.000Z',
    type: 'customer_activity',
    text: 'Kia EV4 Earth angesehen',
    activityKind: 'variant_viewed',
    customerFacing: true,
    modelLabel: 'Kia EV4',
    trimLabel: 'Earth',
  },
  { id: '4', at: '2026-06-25T12:00:00.000Z', type: 'note', text: 'Clever Kundenhelfer aktualisiert' },
];

assert.equal(isCustomerEngagementEntry(history[0]), true);
assert.equal(isCustomerEngagementEntry(history[3]), false);

const dashboard = getActivityDashboard(history, '2026-06-25T13:39:00.000Z');
assert.equal(dashboard.total, 4);
assert.equal(dashboard.newCustomerActivities, 2);
assert.equal(dashboard.newQuestions, 1);
assert.equal(dashboard.newFavorites, 1);

const hint = getLastCustomerActivityHint(history);
assert.ok(hint.includes('EV4 Earth'));

const questionItem = formatTimelinePresentation(history[1]);
assert.equal(questionItem.isQuestion, true);
assert.ok(questionItem.cleverAnswer);

const viewed = buildVariantViewedActivity({ modelLabel: 'Kia EV2', trimLabel: 'Earth' });
assert.ok(viewed.text.includes('Earth'));

const fav = buildFavoriteActivity({ modelLabel: 'Kia EV4', trimLabel: 'GT-Line' });
assert.ok(fav.meta.activityKind === 'favorite_detected');

const insights = detectCleverInsights(history);
assert.ok(insights.length >= 1);

const merged = mergeInsightActivities(history, insights);
assert.ok(Array.isArray(merged));

const qa = buildCleverQuestionActivity({
  question: 'Hat der EV2 eine Wärmepumpe?',
  cleverAnswer: 'Ja, im Winter-Connect-Paket.',
});
assert.equal(qa.meta.question, 'Hat der EV2 eine Wärmepumpe?');

console.log('customerActivityTimeline.test.js: ok');
