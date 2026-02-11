import { BlockImage } from '@gredice/ui/BlockImage';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { getRaisedBedBlockIds } from '../../utils/raisedBedBlocks';
import { getPositionIndexFromGrid } from '../../utils/raisedBedOrientation';
import { RaisedBedFieldItemButton } from './RaisedBedFieldItemButton';
import { RaisedBedFieldItemEmpty } from './RaisedBedFieldItemEmpty';
import { RaisedBedFieldItemPlanted } from './RaisedBedFieldItemPlanted';

function RaisedBedFieldItem({
    gardenId,
    raisedBedId,
    positionIndex,
}: {
    raisedBedId: number;
    gardenId: number;
    positionIndex: number;
}) {
    const { data: garden, isLoading: isGardenLoading } = useCurrentGarden();
    const raisedBed = garden?.raisedBeds.find((bed) => bed.id === raisedBedId);
    if (!raisedBed) {
        return null;
    }

    const field = raisedBed.fields.find(
        (field) => field.positionIndex === positionIndex && field.active,
    );
    const hasField = Boolean(field);

    if (isGardenLoading) {
        return (
            <RaisedBedFieldItemButton
                isLoading={true}
                positionIndex={positionIndex}
            />
        );
    }

    if (!hasField) {
        return (
            <RaisedBedFieldItemEmpty
                gardenId={gardenId}
                raisedBedId={raisedBedId}
                positionIndex={positionIndex}
            />
        );
    }

    return (
        <RaisedBedFieldItemPlanted
            raisedBedId={raisedBedId}
            positionIndex={positionIndex}
        />
    );
}

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

export function RaisedBedField({
    gardenId,
    raisedBedId,
}: {
    gardenId: number;
    raisedBedId: number;
}) {
    const { data: garden } = useCurrentGarden();
    const raisedBed = garden?.raisedBeds.find((bed) => bed.id === raisedBedId);
    const orientation = raisedBed?.orientation ?? 'vertical';
    if (!raisedBed?.isValid) {
        return (
            <div className="flex flex-col mt-4 items-center h-full">
                <Stack spacing={1}>
                    <Typography
                        level="h5"
                        semiBold
                        center
                        className="text-white"
                    >
                        Nevaljan oblik gredice
                    </Typography>
                    <Typography
                        level="body1"
                        center
                        className="text-balance text-white/80"
                    >
                        Gredice trenutno mogu biti samo u obliku 1x2 ili 2x1.
                    </Typography>
                    <div className="relative left-14">
                        <BlockImage
                            blockName="Raised_Bed"
                            width={144}
                            height={144}
                            className="size-36 absolute"
                        />
                        <BlockImage
                            blockName="Raised_Bed"
                            width={144}
                            height={144}
                            className="size-36 absolute left-[60px] top-[33px]"
                        />
                    </div>
                </Stack>
            </div>
        );
    }

    const blockCount =
        garden && raisedBed
            ? Math.max(getRaisedBedBlockIds(garden, raisedBed.id).length, 1)
            : 1;
    const totalColumns = blockCount * 3;
    const rows = Array.from({ length: 3 }, (_, index) => ({
        id: `row-${index.toString()}`,
        index,
    }));
    const columns = Array.from({ length: totalColumns }, (_, index) => ({
        id: `col-${index.toString()}`,
        index,
    }));

    return (
        <>
            <div></div>
            <div className="size-full grid grid-rows-3">
                {rows.map((row) => (
                    <div
                        key={row.id}
                        className="size-full"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${totalColumns}, minmax(0, 1fr))`,
                        }}
                    >
                        {columns.map((column) => {
                            const blockIndex = Math.floor(column.index / 3);
                            const columnWithinBlock = column.index % 3;
                            const positionIndex =
                                getPositionIndexFromGrid(
                                    row.index,
                                    columnWithinBlock,
                                    orientation,
                                ) +
                                blockIndex * 9;

                            return (
                                <div
                                    key={`${row.id}-${column.id}`}
                                    className="size-full p-0.5"
                                >
                                    <RaisedBedFieldItem
                                        gardenId={gardenId}
                                        raisedBedId={raisedBedId}
                                        positionIndex={positionIndex}
                                    />
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </>
    );
}
