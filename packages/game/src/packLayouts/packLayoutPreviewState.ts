import type { CurrentGarden } from '../hooks/useCurrentGarden';
import type { OwnedGardenPack } from '../hud/ownedGardenPackInventory';

export type PackLayoutPreviewSelection = {
    key: string;
    userId: string;
    accountId: string;
    gardenId: number;
    pack: OwnedGardenPack;
    layoutId: string;
    anchor: { x: number; y: number };
    rotation: 0 | 1 | 2 | 3;
    gardenSignature: string;
};

/** Appearance, rotations, structures and support stacks are part of the reviewed state. */
export function packLayoutGardenSignature(
    garden: Pick<CurrentGarden, 'id' | 'stacks'>,
) {
    return JSON.stringify([
        garden.id,
        garden.stacks
            .map((stack) => [
                stack.position.x,
                stack.position.z,
                stack.blocks.map((block) => [
                    block.id,
                    block.name,
                    block.rotation,
                    block.variant ?? null,
                ]),
            ])
            .sort((left, right) =>
                JSON.stringify(left).localeCompare(JSON.stringify(right)),
            ),
    ]);
}

export function movePackLayout(
    selection: PackLayoutPreviewSelection,
    x: number,
    y: number,
) {
    return {
        ...selection,
        anchor: { x: selection.anchor.x + x, y: selection.anchor.y + y },
    };
}

export function turnPackLayout(
    selection: PackLayoutPreviewSelection,
): PackLayoutPreviewSelection {
    return {
        ...selection,
        rotation:
            selection.rotation === 0
                ? 1
                : selection.rotation === 1
                  ? 2
                  : selection.rotation === 2
                    ? 3
                    : 0,
    };
}
