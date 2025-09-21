import { BlockImage } from '@gredice/ui/BlockImage';
import { useSearchParam } from '@signalco/hooks/useSearchParam';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useEffect } from 'react';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { RaisedBedFieldItemButton } from './RaisedBedFieldItemButton';
import { RaisedBedFieldItemEmpty } from './RaisedBedFieldItemEmpty';
import { RaisedBedFieldItemPlanted } from './RaisedBedFieldItemPlanted';

function RaisedBedFieldItem({
    gardenId,
    raisedBedId,
    positionIndex,
    isSelected,
    onSelect,
    onClose,
}: {
    raisedBedId: number;
    gardenId: number;
    positionIndex: number;
    isSelected: boolean;
    onSelect: () => void;
    onClose: () => void;
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
                isSelected={isSelected}
                onSelect={onSelect}
                onClose={onClose}
            />
        );
    }

    return (
        <RaisedBedFieldItemPlanted
            raisedBedId={raisedBedId}
            positionIndex={positionIndex}
            isSelected={isSelected}
            onSelect={onSelect}
            onClose={onClose}
        />
    );
}

export function useNeighboringRaisedBeds(raisedBedId: number) {
    const { data: garden } = useCurrentGarden();
    const raisedBed = garden?.raisedBeds.find((bed) => bed.id === raisedBedId);
    const raisedBedBlockId = raisedBed?.blockId;
    const raisedBedStack = garden?.stacks.find((stack) =>
        stack.blocks.some((block) => block.id === raisedBedBlockId),
    );
    const raisedBedPosition = raisedBedStack?.position;
    const raisedBedIndex = raisedBedStack?.blocks.findIndex(
        (block) => block.id === raisedBedBlockId,
    );
    return garden?.raisedBeds.filter((bed) => {
        const stack = garden?.stacks.find((stack) =>
            stack.blocks.some((block) => block.id === bed.blockId),
        );
        if (!stack) return false;
        const position = stack.position;
        const index = stack.blocks.findIndex(
            (block) => block.id === bed.blockId,
        );
        if (raisedBedIndex !== index) return false;
        // Check if the position is adjacent (left, right, above, below)
        return (
            (position.x === raisedBedPosition?.x &&
                Math.abs(position.z - raisedBedPosition?.z) === 1) || // Above or below
            (position.z === raisedBedPosition?.z &&
                Math.abs(position.x - raisedBedPosition?.x) === 1) // Left or right
        );
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
    const [fieldParam, setFieldParam] = useSearchParam('polje');
    const trimmedFieldParam = fieldParam?.trim();
    const parsedFieldParam =
        trimmedFieldParam && /^[0-9]+$/.test(trimmedFieldParam)
            ? Number.parseInt(trimmedFieldParam, 10)
            : undefined;
    const isFieldParamValid =
        parsedFieldParam !== undefined &&
        !Number.isNaN(parsedFieldParam) &&
        parsedFieldParam >= 0 &&
        parsedFieldParam <= 8;
    const selectedFieldIndex = isFieldParamValid ? parsedFieldParam : null;

    useEffect(() => {
        if (fieldParam && !isFieldParamValid) {
            setFieldParam(undefined);
        }
    }, [fieldParam, isFieldParamValid, setFieldParam]);

    useEffect(() => {
        if (raisedBed && !raisedBed.isValid && fieldParam) {
            setFieldParam(undefined);
        }
    }, [fieldParam, raisedBed, setFieldParam]);

    function handleSelectField(index: number) {
        const nextValue = index.toString();
        if (fieldParam !== nextValue) {
            setFieldParam(nextValue);
        }
    }

    function handleCloseField() {
        if (fieldParam) {
            setFieldParam(undefined);
        }
    }

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

    return (
        <>
            <div></div>
            <div className="size-full grid grid-rows-3">
                {[...Array(3)].map((_, rowIndex) => (
                    <div
                        // biome-ignore lint/suspicious/noArrayIndexKey: Allowed, matrix
                        key={`${rowIndex}`}
                        className="size-full grid grid-cols-3"
                    >
                        {[...Array(3)].map((_, colIndex) => (
                            <div
                                // biome-ignore lint/suspicious/noArrayIndexKey: Allowed, matrix
                                key={`${rowIndex}-${colIndex}`}
                                className="size-full p-0.5"
                            >
                                <RaisedBedFieldItem
                                    gardenId={gardenId}
                                    raisedBedId={raisedBedId}
                                    positionIndex={
                                        (2 - rowIndex) * 3 + (2 - colIndex)
                                    }
                                    isSelected={
                                        selectedFieldIndex ===
                                        (2 - rowIndex) * 3 + (2 - colIndex)
                                    }
                                    onSelect={() =>
                                        handleSelectField(
                                            (2 - rowIndex) * 3 +
                                                (2 - colIndex),
                                        )
                                    }
                                    onClose={handleCloseField}
                                />
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </>
    );
}
