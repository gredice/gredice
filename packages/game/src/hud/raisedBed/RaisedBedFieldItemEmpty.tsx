import { PlantingSeedIcon } from '@gredice/ui/PlantingSeedIcon';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Calendar, ShoppingCart } from '@signalco/ui-icons';
import { cx } from '@signalco/ui-primitives/cx';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import type { ShoppingCartItemData } from '../../hooks/useShoppingCart';
import { RaisedBedFieldItemButton } from './RaisedBedFieldItemButton';
import { PlantPicker } from './RaisedBedPlantPicker';

function formatScheduledSowingDateLabel(date: Date, now: Date): string {
    const day = date.getDate();
    const sameMonth =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth();

    if (sameMonth) {
        return day.toString();
    }

    return `${day}.${date.getMonth() + 1}.`;
}

export function RaisedBedFieldItemEmpty({
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
    const additionalDataRaw = cartPlantItem?.additionalData
        ? JSON.parse(cartPlantItem.additionalData)
        : null;
    const cartPlantOptions = {
        scheduledDate: additionalDataRaw?.scheduledDate
            ? new Date(additionalDataRaw.scheduledDate)
            : null,
    };
    const scheduledDate = cartPlantOptions.scheduledDate;
    const hasScheduledDate =
        scheduledDate instanceof Date && !Number.isNaN(scheduledDate.valueOf());
    const scheduledDateLabel = hasScheduledDate
        ? formatScheduledSowingDateLabel(scheduledDate, new Date())
        : null;

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
                                alt={cartPlantItem.shopData.name ?? 'Nepoznato'}
                                width={50}
                                height={50}
                            />
                            <div className="absolute right-0.5 top-0.5">
                                <div className="rounded-full border-2 p-1 bg-yellow-600 border-white shadow-lg">
                                    <ShoppingCart className="size-4 stroke-white" />
                                </div>
                            </div>
                            {scheduledDateLabel && (
                                <div className="absolute left-0.5 bottom-0.5">
                                    <div className="rounded-full border-2 px-1 py-0.5 bg-stone-200 border-stone-400 text-stone-800 shadow-lg min-w-8">
                                        <div className="flex items-center gap-0.5">
                                            <Calendar className="size-3" />
                                            <span className="text-[10px] font-semibold leading-none">
                                                {scheduledDateLabel}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </RaisedBedFieldItemButton>
            }
            gardenId={gardenId}
            raisedBedId={raisedBedId}
            positionIndex={positionIndex}
            inShoppingCart={Boolean(cartPlantItem)}
            selectedPlantId={cartPlantId ?? null}
            selectedSortId={cartPlantSortId}
            selectedPlantOptions={cartPlantOptions}
        />
    );
}
