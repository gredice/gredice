import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { getRaisedBedBlockIds } from '../../utils/raisedBedBlocks';

export function useNeighboringRaisedBeds(raisedBedId: number) {
    const { data: garden } = useCurrentGarden();
    const raisedBed = garden?.raisedBeds.find((bed) => bed.id === raisedBedId);
    if (!garden || !raisedBed?.blockId) {
        return [];
    }

    const blockIds = getRaisedBedBlockIds(garden, raisedBedId);
    const neighboringBlockIds = blockIds
        .map((blockId) =>
            garden.stacks
                .flatMap((stack) =>
                    stack.blocks.map((block, index) => ({
                        block,
                        index,
                        x: stack.position.x,
                        z: stack.position.z,
                    })),
                )
                .find((candidate) => candidate.block.id === blockId),
        )
        .filter(Boolean);

    return garden.raisedBeds.filter((bed) => {
        if (!bed.blockId || bed.id === raisedBedId) {
            return false;
        }

        const bedPlacement = garden.stacks
            .flatMap((stack) =>
                stack.blocks.map((block, index) => ({
                    block,
                    index,
                    x: stack.position.x,
                    z: stack.position.z,
                })),
            )
            .find((candidate) => candidate.block.id === bed.blockId);

        if (!bedPlacement) {
            return false;
        }

        return neighboringBlockIds.some((placement) => {
            if (!placement) {
                return false;
            }

            return (
                placement.index === bedPlacement.index &&
                ((placement.x === bedPlacement.x &&
                    Math.abs(placement.z - bedPlacement.z) === 1) ||
                    (placement.z === bedPlacement.z &&
                        Math.abs(placement.x - bedPlacement.x) === 1))
            );
        });
    });
}
