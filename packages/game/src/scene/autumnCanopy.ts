import type { Stack } from '../types/Stack';
import { autumnSeed } from './autumnState';

export function getAutumnCanopyShadowKey(
    stacks: readonly Pick<Stack, 'blocks'>[] | undefined,
    retention: number,
) {
    return (
        stacks
            ?.flatMap((stack) =>
                stack.blocks
                    .filter((block) => block.name === 'Tree')
                    .map(
                        (block) =>
                            `${block.id}:${getAutumnCanopyStage(retention, block.id)}`,
                    ),
            )
            .join('|') ?? ''
    );
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
