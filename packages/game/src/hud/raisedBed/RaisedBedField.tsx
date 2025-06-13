import { cx } from "@signalco/ui-primitives/cx";
import { PlantPicker } from "./RaisedBedPlantPicker";
import { PlantingSeed } from "../../icons/PlantingSeed";
import { useCurrentGarden } from "../../hooks/useCurrentGarden";
import { useShoppingCart } from "../../hooks/useShoppingCart";
import { DotIndicator } from "@signalco/ui-primitives/DotIndicator";
import { ShoppingCart } from "@signalco/ui-icons";
import { usePlantSort } from "../../hooks/usePlantSorts";

function RaisedBedFieldItem({ gardenId, raisedBedId, positionIndex }: { raisedBedId: number; gardenId: number; positionIndex: number }) {
    const { data: cart, isPending: isCartPending } = useShoppingCart();
    const { data: garden, isPending: isGardenPending } = useCurrentGarden();
    const raisedBed = garden?.raisedBeds.find((bed) => bed.id === raisedBedId);
    if (!raisedBed) {
        return null;
    }

    const cartItems = cart?.items.filter(item =>
        item.raisedBedId === raisedBedId &&
        item.positionIndex === positionIndex);
    const plantCartItem = cartItems?.find(item => item.entityTypeName === 'plantSort');
    const plantSortId = plantCartItem ? Number(plantCartItem.entityId) : null;
    const { data: plantSort, isPending: isPlantSortPending } = usePlantSort(plantSortId);
    const plantId = plantSort?.information.plant.id;
    const plantOptions = plantCartItem?.additionalData ? JSON.parse(plantCartItem.additionalData) : null;

    const isLoading = isCartPending || isGardenPending || (plantSortId && isPlantSortPending);
    if (isLoading) {
        return null;
    }

    return (
        <PlantPicker
            trigger={(
                <button
                    type="button"
                    className={cx(
                        'relative',
                        "bg-gradient-to-br from-lime-100/90 to-lime-100/80 size-full flex items-center justify-center rounded-sm",
                        "hover:bg-white cursor-pointer"
                    )}>
                    {plantCartItem ? (
                        <>
                            <img src={`https://www.gredice.com/${plantCartItem.shopData.image}`} alt={plantCartItem.shopData.name} width={60} height={60} />
                            <div className="absolute right-1 top-1">
                                <DotIndicator size={30} color={"success"} content={(
                                    <ShoppingCart className="size-6 stroke-white" />
                                )} />
                            </div>
                        </>
                    ) : (
                        <PlantingSeed className="size-10 stroke-green-800" />
                    )}
                </button>
            )}
            gardenId={gardenId}
            raisedBedId={raisedBedId}
            positionIndex={positionIndex}
            inShoppingCart={Boolean(plantCartItem)}
            selectedPlantId={plantId}
            selectedSortId={plantSortId}
            selectedPlantOptions={plantOptions}
        />
    );
}

export function RaisedBedField({
    gardenId,
    raisedBedId
}: {
    gardenId: number;
    raisedBedId: number;
}) {
    return (
        <div className="size-full grid grid-rows-3">
            {[...Array(3)].map((_, rowIndex) => (
                <div key={`${rowIndex}`} className="size-full grid grid-cols-3">
                    {[...Array(3)].map((_, colIndex) => (
                        <div key={`${rowIndex}-${colIndex}`} className="size-full p-0.5">
                            <RaisedBedFieldItem
                                gardenId={gardenId}
                                raisedBedId={raisedBedId}
                                positionIndex={(2 - rowIndex) * 3 + (2 - colIndex)}
                            />
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}
