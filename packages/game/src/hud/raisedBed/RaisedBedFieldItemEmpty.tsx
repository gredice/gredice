import { PlantingSeedIcon } from '@gredice/ui/PlantingSeedIcon';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { ShoppingCart } from '@signalco/ui-icons';
import { cx } from '@signalco/ui-primitives/cx';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import type { ShoppingCartItemData } from '../../hooks/useShoppingCart';
import { RaisedBedFieldItemButton } from './RaisedBedFieldItemButton';
import { PlantPicker } from './RaisedBedPlantPicker';

function formatScheduledSowingDateLabel(date: Date, now: Date): string {
    const day = date.getDate();
    const sameMonthAndYear =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth();
    const shouldIncludeMonth = !sameMonthAndYear && day >= now.getDate();

    if (!shouldIncludeMonth) {
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
                                    <div className="relative size-8 rounded-full border-2 bg-stone-200 border-stone-400 text-stone-800 shadow-lg overflow-hidden">
                                        <div className="absolute inset-x-0 top-0 h-2 bg-stone-300" />
                                        <span className="absolute inset-0 pt-1.5 flex items-center justify-center text-[9px] font-semibold leading-none">
                                            {scheduledDateLabel}
                                        </span>
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
