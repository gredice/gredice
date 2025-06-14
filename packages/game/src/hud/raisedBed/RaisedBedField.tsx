import { useCurrentGarden } from "../../hooks/useCurrentGarden";
import { RaisedBedFieldItemButton } from "./RaisedBedFieldItemButton";
import { RaisedBedFieldItemEmpty } from "./RaisedBedFieldItemEmpty";
import { RaisedBedFieldItemPlanted } from "./RaisedBedFieldItemPlanted";

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
