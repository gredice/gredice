import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { getRaisedBedFootprintSegments } from '../../utils/raisedBedBlocks';

export function useNeighboringRaisedBeds(raisedBedId: number) {
    const { data: garden } = useCurrentGarden();
    if (!garden) {
        return [];
    }

    const placements = new Map(
        garden.raisedBeds.flatMap((raisedBed) => {
            if (!raisedBed.blockId) {
                return [];
            }

            for (const stack of garden.stacks) {
                const index = stack.blocks.findIndex(
                    (block) => block.id === raisedBed.blockId,
                );
                const block = stack.blocks[index];
                if (index >= 0 && block) {
                    return [
                        [
                            raisedBed.id,
                            {
                                cells: getRaisedBedFootprintSegments(
                                    block.rotation,
                                ).map((segment) => ({
                                    x:
                                        stack.position.x +
                                        Math.round(segment.offset.x),
                                    z:
                                        stack.position.z +
                                        Math.round(segment.offset.z),
                                })),
                                index,
                            },
                        ] as const,
                    ];
                }
            }

            return [];
        }),
    );
    const source = placements.get(raisedBedId);
    if (!source) {
        return [];
    }

    return garden.raisedBeds.filter((raisedBed) => {
        if (raisedBed.id === raisedBedId) {
            return false;
        }

        const candidate = placements.get(raisedBed.id);
        return (
            candidate?.index === source.index &&
            source.cells.some((sourceCell) =>
                candidate.cells.some(
                    (candidateCell) =>
                        Math.abs(sourceCell.x - candidateCell.x) +
                            Math.abs(sourceCell.z - candidateCell.z) ===
                        1,
                ),
            )
        );
    });
}
