type GardenStack = {
    blocks: string[];
};

type RaisedBedPlacement = {
    id: number;
    blockId: string | null;
};

type RaisedBedOperation = {
    raisedBedId: number | null;
};

export function visibleRaisedBedsForGarden<
    RaisedBed extends RaisedBedPlacement,
>({ raisedBeds, stacks }: { raisedBeds: RaisedBed[]; stacks: GardenStack[] }) {
    const visibleBlockIds = new Set(stacks.flatMap((stack) => stack.blocks));

    return raisedBeds.filter(
        (raisedBed) =>
            raisedBed.blockId !== null &&
            visibleBlockIds.has(raisedBed.blockId),
    );
}

export function visibleOperationsForGarden<
    RaisedBed extends RaisedBedPlacement,
    Operation extends RaisedBedOperation,
>(
    garden: { raisedBeds: RaisedBed[]; stacks: GardenStack[] },
    operations: Operation[],
) {
    const visibleRaisedBedIds = new Set(
        visibleRaisedBedsForGarden(garden).map((raisedBed) => raisedBed.id),
    );

    return operations.filter(
        (operation) =>
            operation.raisedBedId === null ||
            visibleRaisedBedIds.has(operation.raisedBedId),
    );
}
