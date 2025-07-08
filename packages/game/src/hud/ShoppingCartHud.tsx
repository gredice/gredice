import { Delete, Euro, Info, Navigate, ShoppingCart as ShoppingCartIcon, Timer } from "@signalco/ui-icons";
import { Button } from "@signalco/ui-primitives/Button";
import { Row } from "@signalco/ui-primitives/Row";
import { DotIndicator } from "@signalco/ui-primitives/DotIndicator";
import { HudCard } from "./components/HudCard";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Modal } from "@signalco/ui-primitives/Modal";
import { Stack } from "@signalco/ui-primitives/Stack";
import { NoDataPlaceholder } from "@signalco/ui/NoDataPlaceholder";
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { useShoppingCart, ShoppingCartItemData } from "../hooks/useShoppingCart";
import { useCurrentGarden } from "../hooks/useCurrentGarden";
import { client } from "@gredice/client";
import { ModalConfirm } from "@signalco/ui/ModalConfirm";
import { Chip } from "@signalco/ui-primitives/Chip";
import { useSetShoppingCartItem } from "../hooks/useSetShoppingCartItem";
import { useCheckout } from "../hooks/useCheckout";
import { Alert } from "@signalco/ui/Alert";

function ButtonPricePickPaymentMethod({ price, isSunflower, onChange }: { price: number | null | undefined, isSunflower: boolean, onChange?: (isSunflower: boolean) => void }) {
    function handleToggle() {
        onChange?.(!isSunflower);
    }

    if (price == null || price === undefined) {
        return <Typography level="body1">Nevaljan iznos</Typography>
    }

    const displayPrice = isSunflower ? price * 1000 : price

    return (
        <Row spacing={1} className="overflow-hidden px-0.5 py-1">
            {/* Price Display */}
            <Typography level="body1" semiBold>
                {displayPrice.toFixed(2)}
            </Typography>

            {/* Custom Switch */}
            <button
                onClick={handleToggle}
                className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#2f6e40] focus:ring-offset-2 ${isSunflower ? "bg-yellow-200 dark:bg-yellow-400" : "bg-gray-300 dark:bg-slate-600"}`}
                role="switch"
                aria-checked={isSunflower}
            >
                <span className={`size-5 transform rounded-full bg-white text-black shadow-lg transition-transform flex items-center justify-center text-md font-medium ${isSunflower ? "translate-x-5" : "translate-x-0.5"}`}>
                    {isSunflower ? "🌻" : "€"}
                </span>
            </button>
        </Row>
    )
}

function ShoppingCartItem({ item }: { item: ShoppingCartItemData }) {
    const { data: garden } = useCurrentGarden();

    const hasDiscount = typeof item.shopData.discountPrice === 'number';
    const hasGarden = Boolean(item.gardenId && garden);
    const hasRaisedBed = Boolean(item.raisedBedId);
    const hasPosition = typeof item.positionIndex === 'number';

    const raisedBed = hasRaisedBed ? garden?.raisedBeds.find(rb => rb.id === item.raisedBedId) : null;
    const scheduledDateString = item.additionalData ? JSON.parse(item.additionalData).scheduledDate : null;
    const scheduledDate = scheduledDateString ? new Date(scheduledDateString) : null;
    const changeCurrencyShoppingCartItem = useSetShoppingCartItem();
    const removeShoppingCartItem = useSetShoppingCartItem();

    async function handleChangePaymentType(isSunflower: boolean) {
        await changeCurrencyShoppingCartItem.mutateAsync({
            id: item.id,
            amount: item.amount,
            entityId: item.entityId,
            entityTypeName: item.entityTypeName,
            currency: isSunflower ? 'sunflower' : 'euro'
        });
    }

    async function handleRemoveItem() {
        await removeShoppingCartItem.mutateAsync({
            id: item.id,
            amount: 0,
            entityId: item.entityId,
            entityTypeName: item.entityTypeName
        });
    }

    // Hide delete button for paid items
    const isProcessed = item.status === 'paid';

    return (
        <Row spacing={2} alignItems="start">
            <img
                className="rounded-lg border overflow-hidden size-14 aspect-square shrink-0"
                width={56}
                height={56}
                alt={item.shopData.name}
                src={"https://www.gredice.com" + (item.shopData.image ?? '/assets/plants/placeholder.png')} />
            <Stack className="grow">
                <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                    <Typography level="body1" noWrap>{item.shopData.name}</Typography>
                    {!hasDiscount && (
                        <ButtonPricePickPaymentMethod
                            price={item.shopData.price}
                            isSunflower={item.currency === 'sunflower'}
                            onChange={handleChangePaymentType}
                        />
                    )}
                </div>
                {hasDiscount && (
                    <Row justifyContent="space-between" spacing={1}>
                        <Typography level="body3" secondary className="text-green-600">
                            {`Popust: ${(100 - (item.shopData.discountPrice! / item.shopData.price! * 100)).toFixed(0)}% - ${item.shopData.discountDescription}`}
                        </Typography>
                        <Row spacing={0.5} alignItems="center">
                            <Typography level="body1" bold className="text-green-600">
                                {item.shopData.discountPrice?.toFixed(2) ?? "Nevaljan iznos"}
                            </Typography>
                            <Euro className="size-4 stroke-green-600" />
                        </Row>
                    </Row>
                )}
                {item.shopData.description && (
                    <Typography level="body3" secondary>
                        {item.shopData.description}
                    </Typography>
                )}
                <Row justifyContent="space-between">
                    <Stack spacing={1}>
                        <Row spacing={1}>
                            <Row justifyContent="space-between" spacing={0.5}>
                                <Typography level="body3">Kol.</Typography>
                                <Typography level="body2" bold>{item.amount}</Typography>
                            </Row>
                            {(hasGarden || hasRaisedBed || hasPosition) && (
                                <span className="shrink-0 inline-block h-1 w-1 rounded-full bg-muted-foreground mx-1"></span>
                            )}
                            <Row spacing={0.5} className="flex-wrap gap-y-0">
                                {hasGarden && (
                                    <Typography level="body3" secondary>
                                        {garden?.name || "Nepoznati vrt"}
                                    </Typography>
                                )}
                                {(hasGarden && hasRaisedBed) && (
                                    <Navigate className="size-3 shrink-0" />
                                )}
                                {hasRaisedBed && (
                                    <Typography level="body3" secondary>
                                        {item.raisedBedId ? `${raisedBed?.name}` : "Nepoznato"}
                                    </Typography>
                                )}
                                {(hasRaisedBed && hasPosition) && (
                                    <Navigate className="size-3 shrink-0" />
                                )}
                                {hasPosition && (
                                    <Typography level="body3" secondary>
                                        {`Poz.${(item.positionIndex ?? 0) + 1}`}
                                    </Typography>
                                )}
                            </Row>
                        </Row>
                        {scheduledDate && (
                            <Row>
                                <Chip startDecorator={<Timer className="size-4" />} className="bg-muted">
                                    <Typography level="body3" secondary>
                                        {scheduledDate.toLocaleDateString("hr-HR", {
                                            year: 'numeric',
                                            month: '2-digit',
                                            day: '2-digit'
                                        })}
                                    </Typography>
                                </Chip>
                            </Row>
                        )}
                    </Stack>
                    {!isProcessed && (
                        <ModalConfirm
                            title="Potvrdi brisanje stavke"
                            header="Brisanje stavke iz košarice"
                            onConfirm={handleRemoveItem}
                            trigger={(
                                <IconButton
                                    title="Makni s popisa"
                                    variant="plain"
                                    loading={removeShoppingCartItem.isPending}
                                    className="rounded-full aspect-square p-1 text-red-600"
                                    size="sm">
                                    <Delete className="size-4 shrink-0" />
                                </IconButton>
                            )}>
                            <Typography>Jeste li sigurni da želite ukloniti ovu stavku iz košarice?</Typography>
                        </ModalConfirm>
                    )}
                </Row>
            </Stack>
        </Row>
    );
}

function ShoppingCart() {
    const { data: cart, isLoading, isError, refetch } = useShoppingCart();
    const checkout = useCheckout();

    const handleCheckout = async () => {
        if (!cart || !cart.id) {
            console.error("No cart available for checkout");
            return;
        }

        await checkout.mutateAsync(cart?.id);
    }

    async function confirmClearCart() {
        await client().api["shopping-cart"].$delete();
        refetch();
    }

    return (
        <Stack spacing={2}>
            <Row spacing={2}>
                <div className="rounded-full bg-tertiary/40 p-3 flex items-center justify-center">
                    <ShoppingCartIcon className="size-7 shrink-0" />
                </div>
                <Typography level="h3">Košarica</Typography>
            </Row>
            <Stack spacing={2}>
                <Stack spacing={2} className="max-h-[50vh] overflow-y-auto">
                    {isLoading && <Typography level="body1">Učitavanje...</Typography>}
                    {isError && <Typography level="body1">Greška prilikom učitavanja košarice</Typography>}
                    {!isLoading && !isError && (
                        <>
                            {cart?.items.length ? (
                                cart.items.map((item) => (
                                    <ShoppingCartItem key={item.id} item={item} />
                                ))
                            ) : (
                                <NoDataPlaceholder>Košarica je prazna</NoDataPlaceholder>
                            )}
                        </>
                    )}
                </Stack>
                <Stack className="border-t pt-4" spacing={4}>
                    <Row justifyContent="space-between" alignItems="start" spacing={2}>
                        <Typography level="body1">
                            Ukupno
                        </Typography>
                        <Stack>
                            <Typography level="body1" bold>
                                {cart?.total.toFixed(2)} €
                            </Typography>
                            {(cart?.totalSunflowers ?? 0) > 0 && (
                                <Typography level="body1" bold>
                                    {(cart?.totalSunflowers ?? 0) > 0 ? `-${cart?.totalSunflowers ?? 0}` : '0'} <span className={"text-lg"}>🌻</span>
                                </Typography>
                            )}
                        </Stack>
                    </Row>
                    <Stack spacing={1}>
                        {/* Display notes if present */}
                        {cart && (cart?.notes?.length ?? 0) > 0 && (
                            <Stack spacing={1}>
                                {cart.notes.map((note) => (
                                    <Alert key={note} color="info" startDecorator={<Info className="opacity-80 stroke-blue-900 dark:stroke-blue-100 mt-px" />}>
                                        <Typography level="body2" className="text-primary/90 text-blue-900 dark:text-blue-100">
                                            {note}
                                        </Typography>
                                    </Alert>
                                ))}
                            </Stack>
                        )}
                        <div className="flex flex-col sm:flex-row gap-2">
                            {/* TODO: Localize */}
                            <ModalConfirm
                                title="Potvrdi brisanje košarice"
                                header="Brisanje košarice"
                                onConfirm={confirmClearCart}
                                trigger={
                                    <Button
                                        variant="plain"
                                        fullWidth
                                        disabled={!cart?.items.length}
                                        startDecorator={<Delete className="size-5 shrink-0" />}
                                    >
                                        Očisti košaricu
                                    </Button>
                                }
                            >
                                <Typography>Jeste li sigurni da želite obrisati sve stavke iz košarice?</Typography>
                            </ModalConfirm>
                            {cart?.totalSunflowers ? (
                                <ModalConfirm
                                    title="Potvrdi plaćanje"
                                    header={`Potvrđuješ plaćanje ${cart?.totalSunflowers ?? 0} 🌻 i ${cart?.total.toFixed(2) ?? 0} €?`}
                                    onConfirm={handleCheckout}
                                    trigger={(
                                        <Button
                                            variant="solid"
                                            fullWidth
                                            disabled={!cart?.items.length || checkout.isPending || !cart.allowPurchase}
                                            loading={checkout.isPending}
                                            startDecorator={!cart?.allowPurchase ? <Info className="size-5 shrink-0 stroke-blue-600" /> : undefined}
                                            endDecorator={<Navigate className="size-5 shrink-0" />}
                                        >
                                            Potvrdi i plati
                                        </Button>
                                    )}
                                />
                            ) : (
                                <Button
                                    variant="solid"
                                    onClick={handleCheckout}
                                    fullWidth
                                    disabled={!cart?.items.length || checkout.isPending || !cart.allowPurchase}
                                    loading={checkout.isPending}
                                    startDecorator={!cart?.allowPurchase ? <Info className="size-5 shrink-0 stroke-blue-600" /> : undefined}
                                    endDecorator={<Navigate className="size-5 shrink-0" />}
                                >
                                    Plati
                                </Button>
                            )}

                        </div>
                    </Stack>
                </Stack>
            </Stack>
        </Stack>
    )
}

export function ShoppingCartHud() {
    const { data: cart } = useShoppingCart();
    if (!cart || !cart.items.length) {
        return null;
    }

    return (
        <HudCard
            open
            position="floating"
            className="static p-0.5">
            <Row spacing={1}>
                <Modal
                    title="Košarica"
                    className='bg-card border-tertiary border-b-4 md:max-w-2xl'
                    trigger={(
                        <IconButton
                            title="Košarica"
                            variant="plain"
                            className="relative rounded-full size-10">
                            <ShoppingCartIcon className="!stroke-[1.4px] shrink-0" />
                            {Boolean(cart?.items.length) && (
                                <div className="absolute -right-2 -top-2">
                                    <DotIndicator size={24} color={"success"} content={(
                                        <Typography>{cart?.items.length}</Typography>
                                    )} />
                                </div>
                            )}
                        </IconButton>
                    )}>
                    <ShoppingCart />
                </Modal>
            </Row>
        </HudCard>
    );
}