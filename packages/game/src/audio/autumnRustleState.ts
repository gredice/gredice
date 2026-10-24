import type { AutumnState } from '../scene/autumnState';
import type { Season } from '../scene/seasonState';

export const autumnRustleMaxGain = 0.14;
export const autumnRustleFadeSeconds = 0.3;

/** The raw scene wind uses the shared 0–3 weather scale. */
export function resolveAutumnRustleTarget({
    windSpeed,
    season,
    autumn,
    hasTrees,
    enabled,
    previousGain = 0,
}: {
    windSpeed: number;
    season: Season;
    autumn: AutumnState;
    hasTrees: boolean;
    enabled: boolean;
    previousGain?: number;
}) {
    if (
        !enabled ||
        !hasTrees ||
        (season !== 'autumn' && season !== 'winter') ||
        !Number.isFinite(windSpeed)
    )
        return 0;
    const wind = Math.min(3, Math.max(0, windSpeed));
    // Schmitt thresholds retain a quiet layer through tiny wind fluctuations.
    if (wind < (previousGain > 0 ? 0.3 : 0.45)) return 0;
    const leaves = Math.min(
        1,
        Math.max(
            0,
            autumn.leafRetention * 0.65 + autumn.settledLeafAmount * 0.35,
        ),
    );
    if (!Number.isFinite(leaves) || leaves < 0.025) return 0;
    const strength = Math.max(0, (wind - 0.25) / 2.75);
    return autumnRustleMaxGain * leaves * strength;
}
