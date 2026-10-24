export type GardenPackLayoutPlacement = {
    slotId: string;
    lineId: string;
    entityId: string;
    modelName: string;
    variant: { versionId: string; appearance: Record<string, string> } | null;
    offset: { x: number; y: number };
    rotation: number;
    /** Unrotated, positive-axis occupied cell dimensions. */
    footprint: { width: number; depth: number };
};
export type GardenPackLayout = {
    id: string;
    versionId: string;
    name: Record<string, string>;
    placements: GardenPackLayoutPlacement[];
    availableUnits: { lineId: string; unitOrdinal: number }[];
};
function rotate(x: number, y: number, turns: number) {
    switch (turns) {
        case 0:
            return { x, y };
        case 1:
            return { x: y, y: -x };
        case 2:
            return { x: -x, y: -y };
        case 3:
            return { x: -y, y: x };
        default:
            throw new Error('A quarter-turn rotation is required');
    }
}
/** Rotate every occupied cell about the layout origin, then recover its positive-axis anchor. */
export function resolveGardenPackLayoutPlacements(
    layout: Pick<GardenPackLayout, 'placements'>,
    anchor: { x: number; y: number },
    rotation: number,
) {
    if (!Number.isInteger(anchor.x) || !Number.isInteger(anchor.y))
        throw new Error('An integer layout anchor is required');
    return layout.placements.map((slot) => {
        const { width, depth } = slot.footprint;
        if (
            ![width, depth].every(
                (n) => Number.isInteger(n) && n >= 1 && n <= 16,
            ) ||
            !Number.isInteger(slot.rotation) ||
            slot.rotation < 0 ||
            slot.rotation > 3
        )
            throw new Error('Invalid reviewed footprint or rotation');
        const originalWidth = slot.rotation % 2 ? depth : width;
        const originalDepth = slot.rotation % 2 ? width : depth;
        const corners = [
            rotate(slot.offset.x, slot.offset.y, rotation),
            rotate(
                slot.offset.x + originalWidth - 1,
                slot.offset.y + originalDepth - 1,
                rotation,
            ),
        ];
        const position = {
            x: anchor.x + Math.min(...corners.map((p) => p.x)),
            y: anchor.y + Math.min(...corners.map((p) => p.y)),
        };
        if (
            ![position.x, position.y].every(
                (n) =>
                    Number.isSafeInteger(n) &&
                    n >= -2147483648 &&
                    n <= 2147483647,
            )
        )
            throw new Error('Layout position exceeds the supported grid');
        const turns = (slot.rotation + rotation) % 4;
        return {
            ...slot,
            position,
            rotation: turns,
            footprint: {
                width: turns % 2 ? depth : width,
                depth: turns % 2 ? width : depth,
            },
        };
    });
}
export function getGardenPackLayoutCells(
    placements: ReturnType<typeof resolveGardenPackLayoutPlacements>,
) {
    const cells = new Map<string, { positionX: number; positionY: number }>();
    for (const placement of placements) {
        for (let x = 0; x < placement.footprint.width; x++) {
            for (let y = 0; y < placement.footprint.depth; y++) {
                const positionX = placement.position.x + x;
                const positionY = placement.position.y + y;
                if (
                    ![positionX, positionY].every(
                        (n) => n >= -2147483648 && n <= 2147483647,
                    )
                )
                    throw new Error(
                        'Layout footprint exceeds the supported grid',
                    );
                cells.set(`${positionX}|${positionY}`, {
                    positionX,
                    positionY,
                });
            }
        }
    }
    return [...cells.values()].sort(
        (a, b) => a.positionX - b.positionX || a.positionY - b.positionY,
    );
}
