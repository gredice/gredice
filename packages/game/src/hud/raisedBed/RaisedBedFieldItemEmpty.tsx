import { PlantOrSortImage } from '@gredice/ui/plants';
import { ShoppingCart } from '@signalco/ui-icons';
import { cx } from '@signalco/ui-primitives/cx';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { useShoppingCart } from '../../hooks/useShoppingCart';
import { PlantingSeed } from '../../icons/PlantingSeed';
import { RaisedBedFieldItemButton } from './RaisedBedFieldItemButton';
import { PlantPicker } from './RaisedBedPlantPicker';

export function RaisedBedFieldItemEmpty({
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
    const { data: cart, isLoading: isCartPending } = useShoppingCart();
    const { data: garden, isLoading: isGardenPending } = useCurrentGarden();
    const raisedBed = garden?.raisedBeds.find((bed) => bed.id === raisedBedId);
    const cartItems = cart?.items.filter(
        (item) =>
            item.gardenId === gardenId &&
            item.raisedBedId === raisedBedId &&
            item.positionIndex === positionIndex,
    );
    const cartPlantItem = cartItems?.find(
        (item) => item.entityTypeName === 'plantSort' && item.status === 'new',
    );
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
                        <PlantingSeed className="size-8 stroke-green-800" />
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
