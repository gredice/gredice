/**
 * Shared, framework-agnostic feature flag helpers.
 *
 * These provide a single source of truth for date-based rollouts that are
 * consumed by both the game (via the Vercel `flags` package) and the
 * administration app (directly on the server).
 */

/**
 * The date on which the weather history UI becomes enabled by default.
 *
 * Rolls out three days after the feature was introduced. An explicit override
 * can be provided via the `WEATHER_HISTORY_UI_ROLLOUT_DATE` environment
 * variable (any value parseable by `Date`).
 */
export const WEATHER_HISTORY_UI_ROLLOUT_DATE = new Date('2026-06-01T00:00:00Z');

function resolveRolloutDate(): Date {
    const override = process.env.WEATHER_HISTORY_UI_ROLLOUT_DATE;
    if (override) {
        const parsed = new Date(override);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }
    }
    return WEATHER_HISTORY_UI_ROLLOUT_DATE;
}

/**
 * Whether the weather history UI should be enabled.
 *
 * Enabled when the current date is on or after the rollout date. A boolean
 * override via the `NEXT_PUBLIC_FEATURE_WEATHER_HISTORY_UI` environment
 * variable (`on`/`off`) always takes precedence, which is handy for previews
 * and local development.
 */
export function isWeatherHistoryUiEnabled(now: Date = new Date()): boolean {
    const override = process.env.NEXT_PUBLIC_FEATURE_WEATHER_HISTORY_UI;
    if (override === 'on') return true;
    if (override === 'off') return false;

    return now.getTime() >= resolveRolloutDate().getTime();
}
