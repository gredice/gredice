import { PlantPicker } from "./RaisedBedPlantPicker";
import { PlantingSeed } from "../../icons/PlantingSeed";
import { useCurrentGarden } from "../../hooks/useCurrentGarden";
import { useShoppingCart } from "../../hooks/useShoppingCart";
import { DotIndicator } from "@signalco/ui-primitives/DotIndicator";
import { ShoppingCart } from "@signalco/ui-icons";
import { usePlantSort } from "../../hooks/usePlantSorts";
import { RaisedBedFieldItemButton } from "./RaisedBedFieldItemButton";

export function RaisedBedFieldItemEmpty({ gardenId, raisedBedId, positionIndex }: { raisedBedId: number; gardenId: number; positionIndex: number }) {
    const { data: cart, isLoading: isCartPending } = useShoppingCart();
    const { data: garden, isLoading: isGardenPending } = useCurrentGarden();
    const raisedBed = garden?.raisedBeds.find((bed) => bed.id === raisedBedId);
    if (!raisedBed) {
        return null;
    }

    const cartItems = cart?.items.filter(item =>
        item.gardenId === gardenId &&
        item.raisedBedId === raisedBedId &&
        item.positionIndex === positionIndex);
    const cartPlantItem = cartItems?.find(item => item.entityTypeName === 'plantSort' && item.status === 'new');
    const cartPlantSortId = cartPlantItem ? Number(cartPlantItem.entityId) : null;
    const { data: cartPlantSort, isLoading: isCartPlantSortPending } = usePlantSort(cartPlantSortId);
    const cartPlantId = cartPlantSort?.information.plant.id;
    const additionalDataRaw = cartPlantItem?.additionalData ? JSON.parse(cartPlantItem.additionalData) : null;
    const cartPlantOptions = {
        scheduledDate: additionalDataRaw?.scheduledDate ? new Date(additionalDataRaw.scheduledDate) : null,
    };

    const isLoading = isCartPending || isGardenPending || (Boolean(cartPlantSortId) && isCartPlantSortPending);
    if (isLoading) {
        return (
            <RaisedBedFieldItemButton isLoading={true} />
        );
    }

    return (
        <PlantPicker
            trigger={(
                <RaisedBedFieldItemButton isLoading={isLoading}>
                    {(isLoading || !cartPlantItem) && <PlantingSeed className="size-10 stroke-green-800" />}
                    {(!isLoading && cartPlantItem) && (
                        <>
                            <img
                                src={`https://www.gredice.com/${cartPlantItem.shopData.image}`}
                                alt={cartPlantItem.shopData.name}
                                width={60}
                                height={60}
                            />
                            <div className="absolute right-1 top-1">
                                <DotIndicator
                                    size={30}
                                    color={"success"}
                                    content={
                                        <ShoppingCart className="size-6 stroke-white" />
                                    }
                                />
                            </div>
                        </>
                    )}
                </RaisedBedFieldItemButton>
            )}
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
