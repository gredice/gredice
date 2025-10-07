import { PlantOrSortImage } from '@gredice/ui/plants';
import { ShoppingCart } from '@signalco/ui-icons';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { usePlantSort } from '../../hooks/usePlantSorts';
import { useShoppingCart } from '../../hooks/useShoppingCart';
import { PlantingSeed } from '../../icons/PlantingSeed';
import { RaisedBedFieldItemButton } from './RaisedBedFieldItemButton';
import { PlantPicker } from './RaisedBedPlantPicker';

export function RaisedBedFieldItemEmpty({
    gardenId,
    raisedBedId,
    positionIndex,
}: {
    raisedBedId: number;
    gardenId: number;
    positionIndex: number;
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
    const { data: cartPlantSort, isLoading: isCartPlantSortPending } =
        usePlantSort(cartPlantSortId);
    if (!raisedBed) {
        return null;
    }

    const cartPlantId = cartPlantSort?.information.plant.id;
    const additionalDataRaw = cartPlantItem?.additionalData
        ? JSON.parse(cartPlantItem.additionalData)
        : null;
    const cartPlantOptions = {
        scheduledDate: additionalDataRaw?.scheduledDate
            ? new Date(additionalDataRaw.scheduledDate)
            : null,
    };

    const isLoading =
        isCartPending ||
        isGardenPending ||
        (Boolean(cartPlantSortId) && isCartPlantSortPending);
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
                >
                    {(isLoading || !cartPlantItem) && (
                        <PlantingSeed className="size-10 stroke-green-800" />
                    )}
                    {!isLoading && cartPlantItem && (
                        <>
                            <PlantOrSortImage
                                coverUrl={cartPlantItem.shopData.image}
                                alt={cartPlantItem.shopData.name ?? 'Nepoznato'}
                                width={60}
                                height={60}
                            />
                            <div className="absolute right-1.5 top-1.5">
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
            selectedPlantId={cartPlantId}
            selectedSortId={cartPlantSortId}
            selectedPlantOptions={cartPlantOptions}
        />
    );
}
