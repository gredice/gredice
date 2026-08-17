import { ADVANCED_SOWING_MAX_PLANTINGS_PER_FIELD } from '@gredice/js/plants';
import { PlantingSeedIcon } from '@gredice/ui/PlantingSeedIcon';
import { useEffect } from 'react';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import type { ShoppingCartItemData } from '../../hooks/useShoppingCart';
import {
    normalizeRaisedBedFieldTab,
    useRaisedBedCloseupParams,
} from '../../useUrlState';
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
    plantingCount = 0,
    plantingMode = false,
}: {
    raisedBedId: number;
    gardenId: number;
    cartPlantItem: ShoppingCartItemData | null;
    isCartPending: boolean;
    showPlantHistoryBadges?: boolean;
    positionIndex: number;
    isDragging?: boolean;
    plantingCount?: number;
    plantingMode?: boolean;
}) {
    const { data: garden, isLoading: isGardenLoading } = useCurrentGarden();
    const [fieldDetailsParams, setFieldDetailsParams] =
        useRaisedBedCloseupParams();
    const fieldDetailsParam = fieldDetailsParams.polje;
    const raisedBed = garden?.raisedBeds.find((bed) => bed.id === raisedBedId);

    const field = findRaisedBedOccupiedField(raisedBed?.fields, positionIndex);
    const plantHistory = getRaisedBedFieldPlantHistory(
        raisedBed?.fields,
        positionIndex,
    );
    const visiblePlantHistory = showPlantHistoryBadges ? plantHistory : [];
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

        void setFieldDetailsParams({
            polje: null,
            'polje-kartica': null,
        });
    }, [
        focusedHistoryEntry,
        hasField,
        isFieldDetailsFocused,
        isGardenLoading,
        setFieldDetailsParams,
    ]);

    function handleFieldDetailsOpenChange(open: boolean) {
        if (!open && isFieldDetailsFocused) {
            void setFieldDetailsParams({
                polje: null,
                'polje-kartica': null,
            });
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

    const plantingLimitReached =
        plantingCount >= ADVANCED_SOWING_MAX_PLANTINGS_PER_FIELD;

    if (plantingMode && !plantingLimitReached) {
        return (
            <RaisedBedFieldItemEmpty
                cartPlantItem={cartPlantItem}
                gardenId={gardenId}
                plantHistory={visiblePlantHistory}
                isCartPending={isCartPending}
                raisedBedId={raisedBedId}
                positionIndex={positionIndex}
                isDragging={isDragging}
                showOperations={false}
            />
        );
    }

    if (plantingMode && plantingLimitReached && !hasField) {
        return (
            <RaisedBedFieldItemButton
                aria-label={`Polje ${positionIndex + 1} već ima dvije sadnje`}
                disabled
                positionIndex={positionIndex}
                title="Polje već ima dvije sadnje"
            >
                <PlantingSeedIcon className="size-8 opacity-40" />
            </RaisedBedFieldItemButton>
        );
    }

    if (!plantingMode && plantingCount > 0 && !hasField && !cartPlantItem) {
        return (
            <RaisedBedFieldItemButton
                aria-label={`Polje ${positionIndex + 1} sadrži naprednu sjetvu`}
                disabled
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
                        requestedTab={normalizeRaisedBedFieldTab(
                            fieldDetailsParams['polje-kartica'],
                        )}
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
            requestedTab={
                isFieldDetailsFocused
                    ? normalizeRaisedBedFieldTab(
                          fieldDetailsParams['polje-kartica'],
                      )
                    : undefined
            }
            plantHistory={visiblePlantHistory}
            raisedBedId={raisedBedId}
            positionIndex={positionIndex}
        />
    );
}
