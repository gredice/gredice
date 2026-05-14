import { useGameFlags } from '../../GameFlagsContext';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import type { ShoppingCartItemData } from '../../hooks/useShoppingCart';
import {
    findRaisedBedFieldWithPlant,
    findRaisedBedOccupiedField,
} from '../../utils/raisedBedFields';
import { RaisedBedFieldItemButton } from './RaisedBedFieldItemButton';
import { RaisedBedFieldItemEmpty } from './RaisedBedFieldItemEmpty';
import { RaisedBedFieldItemPlanted } from './RaisedBedFieldItemPlanted';

export function RaisedBedFieldItem({
    cartPlantItem,
    gardenId,
    isCartPending,
    raisedBedId,
    positionIndex,
    isDragging,
}: {
    raisedBedId: number;
    gardenId: number;
    cartPlantItem: ShoppingCartItemData | null;
    isCartPending: boolean;
    positionIndex: number;
    isDragging?: boolean;
}) {
    const { data: garden, isLoading: isGardenLoading } = useCurrentGarden();
    const { enablePlantHistoryFlag } = useGameFlags();
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
        if (enablePlantHistoryFlag && historicalField) {
            return (
                <RaisedBedFieldItemPlanted
                    raisedBedId={raisedBedId}
                    positionIndex={positionIndex}
                    isHistorical
                />
            );
        }

        return (
            <RaisedBedFieldItemEmpty
                cartPlantItem={cartPlantItem}
                gardenId={gardenId}
                isCartPending={isCartPending}
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
