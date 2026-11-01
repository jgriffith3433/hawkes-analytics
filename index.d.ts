// Types for @hawkesgen/analytics (index.mjs). The SDK's own types: hawkes-analytics.d.ts.
import type { HawkesAnalytics, HawkesAnalyticsInit, HawkesAsk, HawkesFeedback, HawkesBuild } from './hawkes-analytics.js';

export type * from './hawkes-analytics.js';

export declare const SDK_MAJOR: 1;
/** https://hawkesgen.ai/sdk/analytics@1.js */
export declare const SDK_URL: string;

export interface LoadOptions extends HawkesAnalyticsInit {
  /** Where to load the SDK from. Default SDK_URL (Hawkes Gen); keep the default unless Hawkes Gen says otherwise. */
  src?: string;
}

/** Adds Hawkes Gen's SDK script once and starts it. Resolves with the SDK, or null when it can't load. */
export declare function load(options?: LoadOptions): Promise<HawkesAnalytics | null>;

export interface HawkesAnalyticsQueued extends Omit<HawkesAnalytics, 'config' | 'version' | 'debugLog'> {
  /** What the SDK knows now, or null before it has loaded. */
  config(): ReturnType<HawkesAnalytics['config']> | null;
  /** Waits for the SDK, then shows the card; null when the SDK never arrives. */
  ask(options: HawkesAsk): Promise<(HawkesFeedback & { id: string }) | null>;
  /** True once Hawkes Gen's script has run. */
  loaded(): boolean;
}

/** Every call is safe before the SDK has loaded: it waits in window.hawkesAnalyticsQ and is played back. */
export declare const hawkesAnalytics: HawkesAnalyticsQueued;
export default hawkesAnalytics;
export type { HawkesBuild };
