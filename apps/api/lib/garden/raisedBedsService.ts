import {
    type RaisedBedOrientation,
    type SelectGardenStack,
    type SelectRaisedBed,
    updateRaisedBed,
} from '@gredice/storage';

type RaisedBedInput = Pick<SelectRaisedBed, 'id' | 'blockId'>;
type GardenStackInput = Pick<
    SelectGardenStack,
    'positionX' | 'positionY' | 'blocks'
>;

export function calculateRaisedBedsValidity(
    raisedBeds: RaisedBedInput[],
    stacks: GardenStackInput[],
    blockNameById: ReadonlyMap<string, string>,
): Map<number, boolean> {
    const placedBlockIds = new Set(stacks.flatMap((stack) => stack.blocks));

    return new Map(
        raisedBeds.map((raisedBed) => [
            raisedBed.id,
            Boolean(
                raisedBed.blockId &&
                    placedBlockIds.has(raisedBed.blockId) &&
                    blockNameById.get(raisedBed.blockId) === 'Raised_Bed',
            ),
        ]),
    );
}

export function calculateRaisedBedsOrientation(
    raisedBeds: RaisedBedInput[],
    blockRotationById: ReadonlyMap<string, number | null | undefined>,
): Map<number, RaisedBedOrientation> {
    return new Map(
        raisedBeds.map((raisedBed) => {
            const rotation = raisedBed.blockId
                ? (blockRotationById.get(raisedBed.blockId) ?? 0)
                : 0;
            const normalizedRotation = ((Math.round(rotation) % 2) + 2) % 2;

            return [
                raisedBed.id,
                normalizedRotation === 1 ? 'vertical' : 'horizontal',
            ];
        }),
    );
}

export async function updateRaisedBedsOrientation(
    garden: {
        raisedBeds: Pick<SelectRaisedBed, 'id' | 'blockId' | 'orientation'>[];
    },
    blockRotationById: ReadonlyMap<string, number | null | undefined>,
) {
    const orientations = calculateRaisedBedsOrientation(
        garden.raisedBeds,
        blockRotationById,
    );
    const updates = garden.raisedBeds.flatMap((raisedBed) => {
        const orientation = orientations.get(raisedBed.id) ?? 'horizontal';
        return raisedBed.orientation === orientation
            ? []
            : [updateRaisedBed({ id: raisedBed.id, orientation })];
    });

    await Promise.all(updates);
    return orientations;
}
