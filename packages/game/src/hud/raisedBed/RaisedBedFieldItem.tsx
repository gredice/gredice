import { useEffect } from 'react';
import { useGameFlags } from '../../GameFlagsContext';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import type { ShoppingCartItemData } from '../../hooks/useShoppingCart';
import { useRaisedBedFieldDetailsParam } from '../../useUrlState';
import {
    findRaisedBedOccupiedField,
    getRaisedBedFieldPlantHistory,
} from '../../utils/raisedBedFields';
import { RaisedBedFieldItemButton } from './RaisedBedFieldItemButton';
import { RaisedBedFieldItemEmpty } from './RaisedBedFieldItemEmpty';
import { RaisedBedFieldItemPlanted } from './RaisedBedFieldItemPlanted';

export function RaisedBedFieldItem({
    cartPlantItem,
    gardenId,
    isCartPending,
    raisedBedId,
    showPlantHistoryBadges = true,
    positionIndex,
    isDragging,
}: {
    raisedBedId: number;
    gardenId: number;
    cartPlantItem: ShoppingCartItemData | null;
    isCartPending: boolean;
    showPlantHistoryBadges?: boolean;
    positionIndex: number;
    isDragging?: boolean;
}) {
    const { data: garden, isLoading: isGardenLoading } = useCurrentGarden();
    const { enablePlantHistoryFlag } = useGameFlags();
    const [fieldDetailsParam, setFieldDetailsParam] =
        useRaisedBedFieldDetailsParam();
    const raisedBed = garden?.raisedBeds.find((bed) => bed.id === raisedBedId);

    const field = findRaisedBedOccupiedField(raisedBed?.fields, positionIndex);
    const plantHistory = getRaisedBedFieldPlantHistory(
        raisedBed?.fields,
        positionIndex,
    );
    const visiblePlantHistory =
        enablePlantHistoryFlag && showPlantHistoryBadges ? plantHistory : [];
    const hasField = Boolean(field);
    const focusedPositionIndex =
        typeof fieldDetailsParam === 'number' && fieldDetailsParam > 0
            ? fieldDetailsParam - 1
            : null;
    const isFieldDetailsFocused = focusedPositionIndex === positionIndex;
    const focusedHistoryEntry =
        isFieldDetailsFocused && !hasField && plantHistory.length > 0
            ? plantHistory[plantHistory.length - 1]
            : null;

    useEffect(() => {
        if (
            !isFieldDetailsFocused ||
            isGardenLoading ||
            hasField ||
            focusedHistoryEntry
        ) {
            return;
        }

        void setFieldDetailsParam(null);
    }, [
        focusedHistoryEntry,
        hasField,
        isFieldDetailsFocused,
        isGardenLoading,
        setFieldDetailsParam,
    ]);

    function handleFieldDetailsOpenChange(open: boolean) {
        if (!open && isFieldDetailsFocused) {
            void setFieldDetailsParam(null);
        }
    }

    if (!raisedBed) {
        return null;
    }

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
            <>
                <RaisedBedFieldItemEmpty
                    cartPlantItem={cartPlantItem}
                    gardenId={gardenId}
                    plantHistory={visiblePlantHistory}
                    isCartPending={isCartPending}
                    raisedBedId={raisedBedId}
                    positionIndex={positionIndex}
                    isDragging={isDragging}
                />
                {focusedHistoryEntry && (
                    <RaisedBedFieldItemPlanted
                        fieldOverride={focusedHistoryEntry}
                        isHistorical
                        onOpenChange={handleFieldDetailsOpenChange}
                        open
                        positionIndex={positionIndex}
                        raisedBedId={raisedBedId}
                        triggerOverride={null}
                        triggerVariant="avatar"
                    />
                )}
            </>
        );
    }

    return (
        <RaisedBedFieldItemPlanted
            onOpenChange={
                isFieldDetailsFocused ? handleFieldDetailsOpenChange : undefined
            }
            open={isFieldDetailsFocused ? true : undefined}
            plantHistory={visiblePlantHistory}
            raisedBedId={raisedBedId}
            positionIndex={positionIndex}
        />
    );
}
