import { useGameState } from "../useGameState";
import { cx } from "@signalco/ui-primitives/cx";
import { useCurrentGarden } from "../hooks/useCurrentGarden";
import { RaisedBedField } from "./raisedBed/RaisedBedField";
import { Check } from "@signalco/ui-icons";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { RaisedBedSensorInfo } from "./raisedBed/RaisedBedSensorInfo";
import { ButtonGreen } from "../shared-ui/ButtonGreen";
import { RaisedBedInfo } from "../controls/components/RaisedBedInfo";
import { Modal } from "@signalco/ui-primitives/Modal";
import { SVGProps } from "react";
import { Stack } from "@signalco/ui-primitives/Stack";
import { useShoppingCart } from "../hooks/useShoppingCart";
import { useSetShoppingCartItem } from "../hooks/useSetShoppingCartItem";

const RaisedBedIcon = (props: SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={24}
        height={24}
        fill="none"
        viewBox="0 0 500 500"
        {...props}
    >
        <path
            stroke="currentColor"
            strokeWidth={20}
            d="M42 191v118.5l208 122M42 191 250 68l210.5 123M42 191l208 118.5M460.5 191v118.5L250 431.5M460.5 191 250 309.5m0 122v-122m0-199L111.5 191l29 17.2M250 110.5 391.5 191l-31 17.2M250 110.5V143m-109.5 65.2L250 270.5l110.5-62.3m-220 0L250 143m0 0 110.5 65.2"
        />
    </svg>
)

function RaisedBedFieldSuggestions({ gardenId, raisedBedId }: { gardenId: number; raisedBedId: number }) {
    const { data: currentGarden } = useCurrentGarden();
    const raisedBed = currentGarden?.raisedBeds.find(bed => bed.id === raisedBedId);
    const { data: shoppingCart } = useShoppingCart();
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
            setCartItem.mutateAsync({
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
        <div className="absolute top-[calc(50%+160px)] left-[calc(50%+36px)] md:top-[calc(50%-162px)] md:left-[calc(50%+210px)]">
            <div className="flex items-center flex-col gap-1 md:gap-2 bg-gradient-to-br from-lime-100/90 dark:from-lime-200/80 to-lime-100/80 dark:to-lime-200/70 dark:text-green-950 rounded-3xl px-4 py-2 md:px-4 md:pb-4 md:pt-3">
                <Typography level="body1" bold className="dark:text-primary-foreground" noWrap>
                    Brzo sijanje
                </Typography>
                <div className="flex flex-row md:flex-col gap-2">
                    <ButtonGreen
                        variant='plain'
                        className={cx(
                            "md:size-auto bg-black/80 hover:bg-black/50",
                            "rounded-full size-10 left-[calc(50%+118px)]",
                        )}
                        startDecorator={<span className="text-xl">☀️</span>}
                        onClick={() => handleQuickPick('summer')}
                        loading={setCartItem.isPending}
                    >
                        <span className="hidden md:block">Ljetni mix</span>
                    </ButtonGreen>
                    <ButtonGreen
                        variant='plain'
                        className={cx(
                            "md:size-auto bg-black/80 hover:bg-black/50",
                            "rounded-full size-10 left-[calc(50%+118px)]",
                        )}
                        startDecorator={<span className="text-xl">🥬</span>}
                        onClick={() => handleQuickPick('salad')}
                        loading={setCartItem.isPending}
                    >
                        <span className="hidden md:block">Salatni mix</span>
                    </ButtonGreen>
                </div>
            </div>
        </div>
    );
}

export function RaisedBedFieldHud() {
    const { data: currentGarden } = useCurrentGarden();
    const view = useGameState(state => state.view);
    const setView = useGameState(state => state.setView);
    const closeupBlock = useGameState(state => state.closeupBlock);
    const raisedBed = currentGarden?.raisedBeds.find((bed) => bed.blockId === closeupBlock?.id);

    return (
        <>
            <div className={cx(
                "opacity-0 transition-opacity pointer-events-none duration-300",
                view === 'closeup' && "opacity-100 [transition-delay:950ms] pointer-events-auto",
            )}>
                {(currentGarden && raisedBed) && (
                    <div className="absolute max-w-64 md:max-w-[312px] top-[calc(50%-203.5px)] left-[calc(50%-156.5px)]">
                        <Modal
                            title="Informacije o gredici"
                            trigger={(
                                <ButtonGreen fullWidth>
                                    <Row spacing={1}>
                                        <RaisedBedIcon className="size-6" />
                                        <Typography semiBold noWrap>{raisedBed?.name}</Typography>
                                    </Row>
                                </ButtonGreen>
                            )}>
                            <RaisedBedInfo gardenId={currentGarden.id} raisedBed={raisedBed} />
                        </Modal>
                    </div>
                )}
                <div
                    className='absolute top-[calc(50%-3px)] left-1/2 size-[316px] -translate-x-1/2 -translate-y-1/2'>
                    {view === 'closeup' && (
                        <>
                            {currentGarden && raisedBed && (
                                <RaisedBedField
                                    gardenId={currentGarden.id}
                                    raisedBedId={raisedBed.id}
                                />
                            )}
                        </>
                    )}
                </div>
                {currentGarden && raisedBed && (
                    <div className="absolute top-[calc(50%+160px)] left-[calc(50%-156.5px)] md:left-[calc(50%+210px)] md:top-[calc(50%+118px)]">
                        <RaisedBedSensorInfo
                            gardenId={currentGarden.id}
                            raisedBedId={raisedBed.id} />
                    </div>
                )}
                {currentGarden && raisedBed && (
                    <RaisedBedFieldSuggestions
                        gardenId={currentGarden.id}
                        raisedBedId={raisedBed.id}
                    />
                )}
                <ButtonGreen
                    variant='plain'
                    className={cx(
                        "absolute top-[calc(50%-203.5px)] md:left-[calc(50%+210px)] md:size-auto",
                        "rounded-full size-10 left-[calc(50%+118px)]",
                    )}
                    onClick={() => {
                        setView({ view: 'normal' });
                    }}
                    startDecorator={<Check className="size-5 shrink-0" />}
                >
                    <span className="hidden md:block">Završi uređivanje</span>
                </ButtonGreen>
            </div>
        </>
    )
}
