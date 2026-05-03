import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import {
    findRaisedBedFieldWithPlant,
    findRaisedBedOccupiedField,
} from '../../utils/raisedBedFields';
import { RaisedBedFieldItemButton } from './RaisedBedFieldItemButton';
import { RaisedBedFieldItemEmpty } from './RaisedBedFieldItemEmpty';
import { RaisedBedFieldItemPlanted } from './RaisedBedFieldItemPlanted';

export function RaisedBedFieldItem({
    gardenId,
    raisedBedId,
    positionIndex,
    isDragging,
}: {
    raisedBedId: number;
    gardenId: number;
    positionIndex: number;
    isDragging?: boolean;
}) {
    const { data: garden, isLoading: isGardenLoading } = useCurrentGarden();
    const raisedBed = garden?.raisedBeds.find((bed) => bed.id === raisedBedId);
    if (!raisedBed) {
        return null;
    }

    const field = findRaisedBedOccupiedField(raisedBed.fields, positionIndex);
    const historicalField = findRaisedBedFieldWithPlant(
        raisedBed.fields,
        positionIndex,
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
        if (historicalField) {
            return (
                <RaisedBedFieldItemPlanted
                    raisedBedId={raisedBedId}
                    positionIndex={positionIndex}
                    isHistorical={true}
                />
            );
        }

        return (
            <RaisedBedFieldItemEmpty
                gardenId={gardenId}
                raisedBedId={raisedBedId}
                positionIndex={positionIndex}
                isDragging={isDragging}
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
