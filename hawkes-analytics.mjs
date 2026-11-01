// Hawkes Analytics as an ES module (bundlers, <script type="module">): runs hawkes-analytics.js and exports its API.
//   import hawkesAnalytics from './hawkes-analytics.mjs';
//   hawkesAnalytics.init({ product: 'phorigins', build: { version: '0.9.1' } });
// Keep it next to hawkes-analytics.js. docs/analytics.md in Hawkes Gen has the quick start.
import './hawkes-analytics.js';

export const hawkesAnalytics = globalThis.hawkesAnalytics;
export default hawkesAnalytics;
