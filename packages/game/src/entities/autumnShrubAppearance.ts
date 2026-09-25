import { Color } from 'three';
import { getAutumnShrubCanopyStage } from '../scene/autumnCanopy';
import type { AutumnState } from '../scene/autumnState';
import type { SeasonState } from '../scene/seasonState';

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
    const gold = new Color('#6D913F').lerpHSL(
        new Color('#D6B83F'),
        Math.min(1, progress * 2),
    );
    if (progress > 0.65)
        gold.lerpHSL(new Color('#79563C'), (progress - 0.65) / 0.35);
    const russet = new Color('#4E7F35').lerpHSL(
        new Color('#B06A3D'),
        Math.min(1, progress * 1.6),
    );
    return {
        stage: getAutumnShrubCanopyStage(
            disabled ? 1 : autumn.leafRetention,
            blockId,
        ),
        gold,
        russet,
    };
}
