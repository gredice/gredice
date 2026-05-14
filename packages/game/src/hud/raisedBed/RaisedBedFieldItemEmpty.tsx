import { PlantingSeedIcon } from '@gredice/ui/PlantingSeedIcon';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Calendar, ShoppingCart } from '@signalco/ui-icons';
import { cx } from '@signalco/ui-primitives/cx';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import type { ShoppingCartItemData } from '../../hooks/useShoppingCart';
import { RaisedBedFieldItemButton } from './RaisedBedFieldItemButton';
import { PlantPicker } from './RaisedBedPlantPicker';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function parseScheduledDate(additionalData: string | null | undefined) {
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

function formatSowingDateLabel(date: Date | null, now = new Date()) {
    if (!date) {
        return null;
    }

    const day = date.getDate();
    const isCurrentMonth =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth();
    const shouldShowMonth = !isCurrentMonth && day >= now.getDate();

    return shouldShowMonth ? `${day}.${date.getMonth() + 1}.` : `${day}`;
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
    const scheduledDate = parseScheduledDate(cartPlantItem?.additionalData);
    const sowingDateLabel = formatSowingDateLabel(scheduledDate);
    const sowingDateIncludesMonth = sowingDateLabel?.includes('.') ?? false;
    const cartPlantOptions = {
        scheduledDate,
    };

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
                            {sowingDateLabel && (
                                <div className="absolute bottom-0.5 left-0.5">
                                    <div className="relative flex size-8 items-center justify-center rounded-full border-2 border-white bg-stone-200 text-stone-700 shadow-lg">
                                        <Calendar className="size-6 stroke-stone-600" />
                                        <span
                                            className={cx(
                                                'absolute inset-0 flex items-center justify-center pt-1 font-bold leading-none tabular-nums text-stone-800',
                                                sowingDateIncludesMonth
                                                    ? 'text-[7px]'
                                                    : 'text-[10px]',
                                            )}
                                        >
                                            {sowingDateLabel}
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
