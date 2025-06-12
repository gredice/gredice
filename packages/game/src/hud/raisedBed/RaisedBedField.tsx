import { cx } from "@signalco/ui-primitives/cx";
import { PlantPicker } from "./RaisedBedPlantPicker";
import { PlantingSeed } from "../../icons/PlantingSeed";
import { useCurrentGarden } from "../../hooks/useCurrentGarden";
import { useShoppingCart } from "../../hooks/useShoppingCart";
import { DotIndicator } from "@signalco/ui-primitives/DotIndicator";
import { ShoppingCart } from "@signalco/ui-icons";

function RaisedBedFieldItem({ gardenId, raisedBedId, positionIndex }: { raisedBedId: number; gardenId: number; positionIndex: number }) {
    const { data: cart } = useShoppingCart();
    const { data: garden } = useCurrentGarden();
    const raisedBed = garden?.raisedBeds.find((bed) => bed.id === raisedBedId);
    if (!raisedBed) {
        return null;
    }

    const field = raisedBed.fields.find(field => field.positionIndex === positionIndex);
    const cartItem = cart?.items.find(item => item.raisedBedId === raisedBedId && item.positionIndex === positionIndex);

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
                    {cartItem ? (
                        <>
                            <img src={`https://www.gredice.com/${cartItem.shopData.image}`} alt={cartItem.shopData.name} width={60} height={60} />
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
                                positionIndex={rowIndex * 3 + colIndex}
                            />
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}
