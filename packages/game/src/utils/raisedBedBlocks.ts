type RaisedBedWithBlockId = {
    id: number;
    blockId: string | null;
    orientation?: 'vertical' | 'horizontal';
};

type GardenLike<
    TRaisedBed extends RaisedBedWithBlockId = RaisedBedWithBlockId,
> = {
    raisedBeds: TRaisedBed[];
};

export type RaisedBedFootprintSegment = {
    blockIndex: number;
    blockOffset: number;
    offset: { x: number; z: number };
    shapeRotation: number;
};

export const raisedBedFieldSectionCount = 2;

export function getRaisedBedFootprintSegments(
    rotation: number | null | undefined,
): RaisedBedFootprintSegment[] {
    const normalizedRotation = ((Math.round(rotation ?? 0) % 2) + 2) % 2;

    if (normalizedRotation === 1) {
        return [
            {
                blockIndex: 1,
                blockOffset: 0,
                offset: { x: 0.05, z: 0 },
                shapeRotation: 0,
            },
            {
                blockIndex: 0,
                blockOffset: 9,
                offset: { x: 0.95, z: 0 },
                shapeRotation: 2,
            },
        ];
    }

    return [
        {
            blockIndex: 0,
            blockOffset: 9,
            offset: { x: 0, z: 0.05 },
            shapeRotation: 3,
        },
        {
            blockIndex: 1,
            blockOffset: 0,
            offset: { x: 0, z: 0.95 },
            shapeRotation: 1,
        },
    ];
}

export function getRaisedBedBlockIds<TRaisedBed extends RaisedBedWithBlockId>(
    garden: GardenLike<TRaisedBed>,
    raisedBedId: number,
): string[] {
    const blockId = garden.raisedBeds.find(
        (candidate) => candidate.id === raisedBedId,
    )?.blockId;

    return blockId ? [blockId] : [];
}

export function isRaisedBedShapeValid<TRaisedBed extends RaisedBedWithBlockId>(
    garden: GardenLike<TRaisedBed>,
    raisedBedId: number,
): boolean {
    return getRaisedBedBlockIds(garden, raisedBedId).length === 1;
}

export function findRaisedBedByBlockId<TRaisedBed extends RaisedBedWithBlockId>(
    garden: GardenLike<TRaisedBed> | null | undefined,
    blockId: string,
): TRaisedBed | null {
    return (
        garden?.raisedBeds.find((candidate) => candidate.blockId === blockId) ??
        null
    );
}
