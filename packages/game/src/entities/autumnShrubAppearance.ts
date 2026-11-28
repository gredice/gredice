import { Color } from 'three';
import { getAutumnShrubCanopyStage } from '../scene/autumnCanopy';
import type { AutumnState } from '../scene/autumnState';
import { seasonalRoles } from '../scene/seasonalRoles';
import type { SeasonState } from '../scene/seasonState';

/** Summer canopy green as albedo (the canopy role, `#43b93a` on screen). */
const summerCanopyColor = '#30712c';

export function getAutumnShrubAppearance({
    autumn,
    season,
    blockId,
    disabled,
}: {
    autumn: AutumnState;
    season: SeasonState['season'];
    blockId: string;
    disabled: boolean;
}) {
    // Spring regrowth is fresh green; autumn's colour curve is only an autumn effect.
    const progress =
        disabled || season === 'spring' ? 0 : autumn.foliageColorProgress;
    // Both masses share the summer green, then turn through the bright
    // autumn canopy roles: the main mound to gold and late red, the side
    // mound to orange (GAME_ART seasonal roles, as on the tree and bush).
    const gold = new Color(summerCanopyColor).lerpHSL(
        new Color(seasonalRoles.autumnGold.albedo),
        Math.min(1, progress * 2),
    );
    if (progress > 0.65)
        gold.lerpHSL(
            new Color(seasonalRoles.autumnRed.albedo),
            (progress - 0.65) / 0.35,
        );
    const russet = new Color(summerCanopyColor).lerpHSL(
        new Color(seasonalRoles.autumnOrange.albedo),
        Math.min(1, progress * 1.6),
    );
    // Spring leaves are a lighter, fresher green, as on the tree and bush.
    const freshness =
        disabled || season !== 'spring' ? 0 : autumn.springFreshness;
    if (freshness > 0) {
        const springGreen = new Color(seasonalRoles.springGreen.albedo);
        gold.lerp(springGreen, freshness);
        russet.lerp(springGreen, freshness);
    }
    return {
        stage: getAutumnShrubCanopyStage(
            disabled ? 1 : autumn.leafRetention,
            blockId,
        ),
        gold,
        russet,
    };
}
