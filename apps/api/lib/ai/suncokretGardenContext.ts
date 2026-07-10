type GardenStack = {
    blocks: string[];
};

type RaisedBedPlacement = {
    blockId: string | null;
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
