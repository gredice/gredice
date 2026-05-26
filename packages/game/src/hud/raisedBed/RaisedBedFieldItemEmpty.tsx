import { MoreHorizontal, ShoppingCart } from '@gredice/ui/icons';
import { PlantingSeedIcon } from '@gredice/ui/PlantingSeedIcon';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { cx } from '@gredice/ui/utils';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import type { ShoppingCartItemData } from '../../hooks/useShoppingCart';
import type { RaisedBedFieldPlantHistoryEntry } from '../../utils/raisedBedFields';
import { RaisedBedFieldIconStack } from './RaisedBedFieldIconStack';
import { RaisedBedFieldItemButton } from './RaisedBedFieldItemButton';
import { RaisedBedFieldItemPlanted } from './RaisedBedFieldItemPlanted';
import { RaisedBedFieldPlantHistoryModal } from './RaisedBedFieldPlantHistoryModal';
import { PlantPicker } from './RaisedBedPlantPicker';
import { ScheduledSowingDateBadge } from './ScheduledSowingDateBadge';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function parseScheduledSowingDate(additionalData: string | null | undefined) {
    if (!additionalData) {
        return null;
    }

    try {
        const parsed: unknown = JSON.parse(additionalData);
        if (!isRecord(parsed) || typeof parsed.scheduledDate !== 'string') {
            return null;
        }

        const date = new Date(parsed.scheduledDate);
        return Number.isNaN(date.getTime()) ? null : date;
    } catch {
        return null;
    }
}

export function RaisedBedFieldItemEmpty({
    cartPlantItem,
    gardenId,
    isCartPending,
    plantHistory = [],
    raisedBedId,
    positionIndex,
    isDragging,
}: {
    raisedBedId: number;
    gardenId: number;
    cartPlantItem: ShoppingCartItemData | null;
    isCartPending: boolean;
    plantHistory?: RaisedBedFieldPlantHistoryEntry[];
    positionIndex: number;
    isDragging?: boolean;
}) {
    const { data: garden, isLoading: isGardenPending } = useCurrentGarden();
    const raisedBed = garden?.raisedBeds.find((bed) => bed.id === raisedBedId);
    const cartPlantSortId = cartPlantItem
        ? Number(cartPlantItem.entityId)
        : null;
    if (!raisedBed) {
        return null;
    }

    const cartPlantSort = cartPlantItem?.entityData;
    const cartPlantId = cartPlantSort?.information?.plant?.id;
    const scheduledDate = parseScheduledSowingDate(
        cartPlantItem?.additionalData,
    );
    const cartPlantOptions = {
        scheduledDate,
    };
    const plantPickerProps = {
        gardenId,
        inShoppingCart: Boolean(cartPlantItem),
        positionIndex,
        raisedBedId,
        selectedPlantId: cartPlantId ?? null,
        selectedPlantOptions: cartPlantOptions,
        selectedSortId: cartPlantSortId,
    };
    const visiblePlantHistory = plantHistory.slice(-2);
    const shouldShowAllPlantHistory = plantHistory.length > 2;

    const isLoading = isCartPending || isGardenPending;
    if (isLoading) {
        return (
            <RaisedBedFieldItemButton
                isLoading={true}
                positionIndex={positionIndex}
            />
        );
    }

    return (
        <div className="relative size-full">
            <PlantPicker
                trigger={
                    <RaisedBedFieldItemButton
                        isLoading={isLoading}
                        positionIndex={positionIndex}
                        className={cx(
                            isDragging &&
                                'opacity-50 ring-2 ring-lime-500 scale-105',
                        )}
                    >
                        {(isLoading || !cartPlantItem) && (
                            <PlantingSeedIcon className="size-8 text-green-800" />
                        )}
                        {!isLoading && cartPlantItem && (
                            <>
                                <PlantOrSortImage
                                    plantSort={cartPlantSort}
                                    alt={
                                        cartPlantItem.shopData.name ??
                                        'Nepoznato'
                                    }
                                    width={50}
                                    height={50}
                                />
                                {scheduledDate && (
                                    <ScheduledSowingDateBadge
                                        date={scheduledDate}
                                    />
                                )}
                            </>
                        )}
                    </RaisedBedFieldItemButton>
                }
                {...plantPickerProps}
            />
            <RaisedBedFieldIconStack>
                {shouldShowAllPlantHistory && (
                    <RaisedBedFieldPlantHistoryModal
                        entries={plantHistory}
                        raisedBedId={raisedBedId}
                        trigger={
                            <button
                                type="button"
                                className="inline-flex size-8 items-center justify-center rounded-full border-2 border-white bg-white p-0 hover:bg-gray-100 shadow-lg ring-1 ring-black/10 transition-transform hover:scale-105 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700"
                                title={`Povijest biljaka (${plantHistory.length})`}
                                aria-label={`Prikaži povijest biljaka za polje ${positionIndex + 1}`}
                                onPointerDown={(event) =>
                                    event.stopPropagation()
                                }
                                onClick={(event) => event.stopPropagation()}
                                onKeyDown={(event) => event.stopPropagation()}
                            >
                                <MoreHorizontal className="size-5" />
                            </button>
                        }
                    />
                )}
                {visiblePlantHistory.map((historyEntry) => (
                    <RaisedBedFieldItemPlanted
                        key={
                            historyEntry.plantPlaceEventId ??
                            `${historyEntry.positionIndex}-${historyEntry.plantSortId}`
                        }
                        fieldOverride={historyEntry}
                        isHistorical
                        positionIndex={positionIndex}
                        raisedBedId={raisedBedId}
                        triggerVariant="avatar"
                    />
                ))}
                {cartPlantItem && (
                    <PlantPicker
                        trigger={
                            <button
                                type="button"
                                className="inline-flex size-8 items-center justify-center rounded-full bg-white hover:bg-gray-100 p-1 shadow-lg ring-1 ring-black/10 transition-transform hover:scale-105 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700"
                                title="U košarici"
                                aria-label="Otvori sadnju u košarici"
                                onPointerDown={(event) =>
                                    event.stopPropagation()
                                }
                                onKeyDown={(event) => event.stopPropagation()}
                            >
                                <ShoppingCart className="size-[18px] text-foreground dark:text-[hsl(28_47.4%_11.2%)]" />
                            </button>
                        }
                        {...plantPickerProps}
                    />
                )}
            </RaisedBedFieldIconStack>
        </div>
    );
}
