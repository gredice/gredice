import { cx } from "@signalco/ui-primitives/cx";
import { useCurrentGarden } from "../../hooks/useCurrentGarden";
import { Typography } from "@signalco/ui-primitives/Typography";
import { ButtonGreen } from "../../shared-ui/ButtonGreen";
import { useShoppingCart } from "../../hooks/useShoppingCart";
import { useSetShoppingCartItem } from "../../hooks/useSetShoppingCartItem";
import { RaisedBedCard } from "./RaisedBedCard";

export function RaisedBedFieldSuggestions({ gardenId, raisedBedId }: { gardenId: number; raisedBedId: number }) {
    const { data: currentGarden } = useCurrentGarden();
    const raisedBed = currentGarden?.raisedBeds.find(bed => bed.id === raisedBedId);
    const { data: shoppingCart, isLoading: isLoadingShoppingCart } = useShoppingCart();
    const setCartItem = useSetShoppingCartItem();
    if (!currentGarden || !raisedBed || !shoppingCart) return null;

    // Check if there are already 9 plants in the cart or planted for this raised bed
    const cartItems = shoppingCart?.items.filter(item => item.raisedBedId === raisedBedId);
    const cartPlantItems = cartItems?.filter(item => item.entityTypeName === 'plantSort' && item.status === 'new');
    if (raisedBed.fields.length + (cartPlantItems?.length ?? 0) >= 9)
        return null;

    async function handleQuickPick(type: 'summer' | 'salad') {
        const layouts = {
            summer: [222, 227, 279, 223, 294, 230, 223, 215, 230],
            salad: [282, 229, 209, 299, 234, 221, 281, 215, 204]
        }

        await Promise.all(Array.from({ length: 9 }).map(async (_, index) => {
            if (!raisedBed || !shoppingCart) return;
            if (raisedBed.fields.find(field => field.positionIndex === index)) return;
            if (shoppingCart.items.find(item => item.raisedBedId === raisedBedId && item.positionIndex === index && item.entityTypeName === 'plantSort' && item.status === 'new')) return;
            return setCartItem.mutateAsync({
                entityTypeName: "plantSort",
                entityId: layouts[type][index].toString(),
                amount: 1,
                gardenId,
                raisedBedId,
                positionIndex: index
            });
        }));
    }

    return (
        <RaisedBedCard className="flex items-center flex-col gap-1 px-4 py-2 md:gap-2 md:px-4 md:pb-4 md:pt-3">
            <Typography level="body1" bold className="dark:text-primary-foreground" noWrap>
                Brzo sijanje
            </Typography>
            <div className="flex flex-row md:flex-col gap-2">
                <ButtonGreen
                    variant='plain'
                    className={cx(
                        "md:size-auto bg-black/80 dark:bg-white/10 hover:bg-black/50",
                        "rounded-full size-10 left-[calc(50%+118px)]",
                    )}
                    startDecorator={<span className="text-xl">☀️</span>}
                    onClick={() => handleQuickPick('summer')}
                    loading={setCartItem.isPending || isLoadingShoppingCart}
                >
                    <span className="hidden md:block">Ljetni mix</span>
                </ButtonGreen>
                <ButtonGreen
                    variant='plain'
                    className={cx(
                        "md:size-auto bg-black/80 dark:bg-white/10 hover:bg-black/50",
                        "rounded-full size-10 left-[calc(50%+118px)]",
                    )}
                    startDecorator={<span className="text-xl">🥬</span>}
                    onClick={() => handleQuickPick('salad')}
                    loading={setCartItem.isPending || isLoadingShoppingCart}
                >
                    <span className="hidden md:block">Salatni mix</span>
                </ButtonGreen>
            </div>
        </RaisedBedCard>
    );
}
