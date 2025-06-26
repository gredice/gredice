import { Typography } from "@signalco/ui-primitives/Typography";
import { useCurrentGarden } from "../../hooks/useCurrentGarden";
import { BlockImage } from "../../shared-ui/BlockImage";
import { RaisedBedFieldItemButton } from "./RaisedBedFieldItemButton";
import { RaisedBedFieldItemEmpty } from "./RaisedBedFieldItemEmpty";
import { RaisedBedFieldItemPlanted } from "./RaisedBedFieldItemPlanted";
import { Stack } from "@signalco/ui-primitives/Stack";

function RaisedBedFieldItem({ gardenId, raisedBedId, positionIndex }: { raisedBedId: number; gardenId: number; positionIndex: number }) {
    const { data: garden, isPending: isGardenPending } = useCurrentGarden();
    const raisedBed = garden?.raisedBeds.find((bed) => bed.id === raisedBedId);
    if (!raisedBed) {
        return null;
    }

    const field = raisedBed.fields.find(field => field.positionIndex === positionIndex);
    const hasField = Boolean(field);

    if (isGardenPending) {
        return (
            <RaisedBedFieldItemButton isLoading={true} />
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
    )
}

export function RaisedBedField({
    gardenId,
    raisedBedId
}: {
    gardenId: number;
    raisedBedId: number;
}) {
    // Check neighboring fields to determine if there is exactly one raised bed in the area next to this one
    // if not, display a warning and illustrate the issue
    const { data: garden } = useCurrentGarden();
    if (garden) {
        const raisedBed = garden?.raisedBeds.find((bed) => bed.id === raisedBedId);
        const raisedBedBlockId = raisedBed?.blockId;
        const raisedBedStack = garden?.stacks.find(stack => stack.blocks.some(block => block.id === raisedBedBlockId));
        const raisedBedPosition = raisedBedStack?.position;
        const raisedBedIndex = raisedBedStack?.blocks.findIndex(block => block.id === raisedBedBlockId);
        const neighboringRaisedBeds = garden?.raisedBeds.filter(bed => {
            const stack = garden?.stacks.find(stack => stack.blocks.some(block => block.id === bed.blockId));
            if (!stack) return false;
            const position = stack.position;
            const index = stack.blocks.findIndex(block => block.id === bed.blockId);
            if (raisedBedIndex !== index) return false;
            // Check if the position is adjacent (left, right, above, below)
            return (
                (position.x === raisedBedPosition?.x && Math.abs(position.z - raisedBedPosition?.z) === 1) || // Above or below
                (position.z === raisedBedPosition?.z && Math.abs(position.x - raisedBedPosition?.x) === 1) // Left or right
            );
        });
        console.log("Neighboring Raised Beds:", neighboringRaisedBeds);
        if (neighboringRaisedBeds?.length !== 1) {
            return (
                <div className="flex flex-col mt-4 items-center h-full">
                    <Stack spacing={1}>
                        <Typography level="h5" semiBold center secondary>Nevaljan oblik gredice</Typography>
                        <Typography level="body1" center className="text-balance">
                            Gredice trenutno mogu biti samo u obliku 1x2 ili 2x1.
                        </Typography>
                        <div className="relative left-14">
                            <BlockImage blockName="Raised_Bed" className="size-36 absolute" />
                            <BlockImage blockName="Raised_Bed" className="size-36 absolute left-[60px] top-[33px]" />
                        </div>
                    </Stack>
                </div>
            );
        }
    }

    return (
        <>
            <div></div>
            <div className="size-full grid grid-rows-3">
                {[...Array(3)].map((_, rowIndex) => (
                    <div key={`${rowIndex}`} className="size-full grid grid-cols-3">
                        {[...Array(3)].map((_, colIndex) => (
                            <div key={`${rowIndex}-${colIndex}`} className="size-full p-0.5">
                                <RaisedBedFieldItem
                                    gardenId={gardenId}
                                    raisedBedId={raisedBedId}
                                    positionIndex={(2 - rowIndex) * 3 + (2 - colIndex)}
                                />
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </>
    );
}
