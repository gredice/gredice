import type { BlockData } from '@gredice/client';
import {
    type AutumnArrangement,
    type Placement,
    autumnArrangements as sharedAutumnArrangements,
} from '@gredice/js/autumnArrangements';
import { autumnBlanketBench } from '@gredice/js/autumnBlanketBench';
import { fallenLog } from '@gredice/js/fallenLog';
import { getGardenBlockSpan } from '@gredice/js/gardenBlocks';

export {
    type AutumnArrangement,
    getAutumnArrangementItems,
} from '@gredice/js/autumnArrangements';

import type { entityNameMap } from '../entities/entityNameMap';
export const autumnArrangements = sharedAutumnArrangements satisfies {
    placements: { entityName: keyof typeof entityNameMap }[];
}[];

import { isInternalSceneBlockData } from '../internalSceneBlockData';

/** Caller supplies the published directory response, without internal fallback rows. */
export function getAvailableAutumnArrangements({
    blockData,
    isSandbox = false,
}: {
    blockData: BlockData[] | null | undefined;
    isSandbox?: boolean;
}) {
    const available = new Map(
        blockData
            ?.filter(
                (block) =>
                    isSandbox ||
                    (block.id > 0 && !isInternalSceneBlockData(block)),
            )
            .map((block) => [block.information.name, block]),
    );
    return autumnArrangements.filter((arrangement) =>
        arrangement.placements.every((placement) => {
            const block = available.get(placement.entityName);
            if (!block) return false;
            const expected = getGardenBlockSpan(
                placement.entityName === autumnBlanketBench.name
                    ? autumnBlanketBench
                    : placement.entityName === fallenLog.name
                      ? fallenLog
                      : undefined,
                placement.rotation,
            );
            const actual = getGardenBlockSpan(block, placement.rotation);
            if (
                actual.width !== expected.width ||
                actual.depth !== expected.depth
            )
                return false;
            const price = block.prices.sunflowers;
            return (
                isSandbox ||
                placement.role === 'scenery' ||
                (typeof price === 'number' &&
                    Number.isFinite(price) &&
                    price > 0)
            );
        }),
    );
}

/** Derive occupied cells and dimensions from the same catalogue spans as placement. */
export function getAutumnArrangementLayout(
    arrangement: AutumnArrangement,
    blockData: BlockData[],
) {
    const byName = new Map(
        blockData.map((block) => [block.information.name, block]),
    );
    const placements = arrangement.placements.map((placement) => {
        const block = byName.get(placement.entityName);
        if (!block)
            throw new Error(
                `Missing arrangement block: ${placement.entityName}`,
            );
        const span = getGardenBlockSpan(block, placement.rotation);
        return {
            ...placement,
            ...span,
            cells: Array.from(
                { length: span.width * span.depth },
                (_, index) => ({
                    x: placement.x + (index % span.width),
                    z: placement.z + Math.floor(index / span.width),
                }),
            ),
        };
    });
    function bounds(role?: Placement['role']) {
        const cells = placements
            .filter((placement) => !role || placement.role === role)
            .flatMap((placement) => placement.cells);
        const x = Math.min(...cells.map((cell) => cell.x));
        const z = Math.min(...cells.map((cell) => cell.z));
        return {
            x,
            z,
            width: Math.max(...cells.map((cell) => cell.x)) - x + 1,
            depth: Math.max(...cells.map((cell) => cell.z)) - z + 1,
            occupiedCells: new Set(cells.map((cell) => `${cell.x}:${cell.z}`))
                .size,
        };
    }
    return { placements, garden: bounds(), decoration: bounds('included') };
}

/** Use the same host as game models when embedded in WWW or other consumers. */
export function getAutumnArrangementPreviewUrl(
    arrangement: AutumnArrangement,
    appBaseUrl: string,
) {
    return `${appBaseUrl.replace(/\/+$/u, '')}${arrangement.preview}`;
}
