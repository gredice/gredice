import type { Stack } from '../types/Stack';
import { autumnSeed } from './autumnState';
import type { SeasonState } from './seasonState';

export function getAutumnCanopyShadowKey(
    stacks: readonly Pick<Stack, 'blocks'>[] | undefined,
    retention: number,
) {
    return (
        stacks
            ?.flatMap((stack) =>
                stack.blocks
                    .filter(
                        (block) =>
                            block.name === 'Tree' ||
                            block.name === 'SeasonalMaple' ||
                            block.name === 'Bush' ||
                            block.name === 'AutumnShrub',
                    )
                    .map(
                        (block) =>
                            `${block.id}:${block.name === 'AutumnShrub' ? getAutumnShrubCanopyStage(retention, block.id) : block.name === 'Tree' ? getAutumnTreeCanopyStage(retention, block.id) : getAutumnCanopyStage(retention, block.id)}`,
                    ),
            )
            .join('|') ?? ''
    );
}

/**
 * Leaf retention at or below which a deciduous crown has lost its last
 * leaves: from about 2 December to 25 March (`autumnState`: retention falls
 * to 0.1 at the end of autumn, rests at 0.08 through winter and passes 0.1
 * again in the first days of spring). Above it the late autumn thinning and
 * sparse stages stay as they are. The round tree spreads it per tree
 * (`autumnBareRetentionSpread`); the autumn shrub uses it as it is.
 */
export const autumnBareRetention = 0.1;

/** This deciduous shrub loses its last leaves. */
export function getAutumnShrubCanopyStage(retention: number, blockId: string) {
    if (Number.isFinite(retention) && retention <= autumnBareRetention)
        return 'bare';
    return getAutumnCanopyStage(retention, blockId);
}

/**
 * How far each round tree's bare threshold moves around
 * `autumnBareRetention` (the whole width, seeded per tree like the other
 * stage offsets), so trees lose their crowns over about 30 November to
 * 5 December and regrow them over about 23 to 27 March instead of all on
 * one day. Kept small enough that every tree is bare at the 0.08 winter
 * floor (the lowest threshold is 0.085).
 */
export const autumnBareRetentionSpread = 0.03;

/**
 * The round Tree is bare in winter (GAME_ART.md "Weather > Snow"): no crown
 * on the branches, so snow settles as thin lines on the branches instead of
 * a cap on a leftover ball. Its crown returns as the sparse stage in spring.
 * A tree that thins early also goes bare early and leafs out late (the same
 * seed as `getAutumnCanopyStage`).
 */
export function getAutumnTreeCanopyStage(retention: number, blockId: string) {
    const threshold =
        autumnBareRetention +
        (autumnSeed(`${blockId}:retention`) - 0.5) * autumnBareRetentionSpread;
    if (Number.isFinite(retention) && retention <= threshold) return 'bare';
    return getAutumnCanopyStage(retention, blockId);
}

/**
 * The round tree's crown colour progress. A bare winter tree keeps no
 * leaves to turn green in spring, so the crown that regrows from 25 March is
 * fresh green from its first day (GAME_ART "Time of day and seasons"), as on
 * the seasonal maple and the autumn shrub, never a yellow ball in the fork.
 */
export function resolveTreeFoliageColorProgress(
    foliageColorProgress: number,
    season: SeasonState['season'],
) {
    return season === 'spring' ? 0 : foliageColorProgress;
}

/** Stable, bounded per-tree timing; fully grown and winter endpoints are exact. */
export function getAutumnCanopyStage(retention: number, blockId: string) {
    const value = Number.isFinite(retention)
        ? Math.min(1, Math.max(0, retention))
        : 1;
    const offset = (autumnSeed(`${blockId}:retention`) - 0.5) * 0.12;
    if (value > 0.68 + offset) return 'full';
    if (value > 0.22 + offset) return 'thinning';
    return 'sparse';
}
