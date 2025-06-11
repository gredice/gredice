import { Delete, Euro, Navigate, ShoppingCart as ShoppingCartIcon, Timer } from "@signalco/ui-icons";
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
import { useQueryClient } from "@tanstack/react-query";
import { cx } from "@signalco/ui-primitives/cx";
import { clientStripe } from '@gredice/stripe/client';

function ShoppingCartItem({ item }: { item: ShoppingCartItemData }) {
    const { data: garden } = useCurrentGarden();
    const queryClient = useQueryClient(); // TODO: Move to mutation

    const hasDiscount = typeof item.shopData.discountPrice === 'number';
    const hasGarden = Boolean(item.gardenId && garden);
    const hasRaisedBed = Boolean(item.raisedBedId);
    const hasPosition = Boolean(item.positionIndex);

    const raisedBed = hasRaisedBed ? garden?.raisedBeds.find(rb => rb.id === item.raisedBedId) : null;
    const scheduledDateString = item.additionalData ? JSON.parse(item.additionalData).scheduledDate : null;
    const scheduledDate = scheduledDateString ? new Date(scheduledDateString) : null;

    async function handleRemoveItem() {
        await client().api["shopping-cart"].$post({
            json: {
                amount: 0,
                cartId: item.cartId,
                entityId: item.entityId,
                entityTypeName: item.entityTypeName,
                gardenId: item.gardenId ?? undefined,
                raisedBedId: item.raisedBedId ?? undefined,
                positionIndex: item.positionIndex ?? undefined,
                additionalData: item.additionalData,
            }
        });
        queryClient.invalidateQueries({ queryKey: ['shopping-cart'] });
    }

    // Hide delete button for automatic items
    const isAutomatic = item.owner === 'automatic';

    return (
        <Row spacing={2} alignItems="start">
            <img className="rounded-lg border overflow-hidden" width={50} height={50} src={"https://www.gredice.com" + (item.shopData.image ?? '/assets/plants/placeholder.png')} />
            <Stack className="grow">
                <Row alignItems="start" justifyContent="space-between" spacing={1}>
                    <Typography level="body1" noWrap>{item.shopData.name}</Typography>
                    <Row>
                        <Typography className={cx(hasDiscount && 'line-through opacity-50 text-sm')} level="body1" bold>{item.shopData.price?.toFixed(2) ?? "Nevaljan iznos"}</Typography>
                        <Euro className={cx(hasDiscount ? "size-3" : "size-4")} />
                    </Row>
                </Row>
                {hasDiscount && (
                    <Row justifyContent="space-between" spacing={1}>
                        <Typography level="body3" secondary className="text-green-600">
                            {`Popust: ${(100 - (item.shopData.discountPrice! / item.shopData.price! * 100)).toFixed(0)}% - ${item.shopData.discountDescription}`}
                        </Typography>
                        <Row spacing={0.5} alignItems="center">
                            <Typography level="body1" bold className="text-green-600">
                                {item.shopData.discountPrice?.toFixed(2) ?? "Nevaljan iznos"}
                            </Typography>
                            <Euro className="size-4" />
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
                                <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground mx-1"></span>
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
                                        {item.raisedBedId ? `Gredica ${raisedBed?.name}` : "Nepoznato"}
                                    </Typography>
                                )}
                                {(hasRaisedBed && hasPosition) && (
                                    <Navigate className="size-3 shrink-0" />
                                )}
                                {hasPosition && (
                                    <Typography level="body3" secondary>
                                        {item.positionIndex !== undefined ? `Pozicija ${item.positionIndex}` : "Nepoznato"}
                                    </Typography>
                                )}
                            </Row>
                        </Row>
                        {scheduledDate && (
                            <Row>
                                <Chip startDecorator={<Timer className="size-4" />} className="bg-muted">
                                    <Typography level="body3" secondary>
                                        {scheduledDate.toLocaleDateString()}
                                    </Typography>
                                </Chip>
                            </Row>
                        )}
                    </Stack>
                    {/* Only show delete button if not automatic */}
                    {!isAutomatic && (
                        <ModalConfirm
                            title="Potvrdi brisanje stavke"
                            header="Brisanje stavke iz košarice"
                            onConfirm={handleRemoveItem}
                            trigger={(
                                <IconButton
                                    title="Makni s popisa"
                                    variant="plain"
                                    className="rounded-full p-1 text-red-600"
                                    size="sm">
                                    <Delete className="size-4" />
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

    const handleCheckout = async () => {
        if (!cart || !cart.id) {
            console.error("No cart available for checkout");
            return;
        }

        const response = await client().api.checkout.checkout.$post({
            json: {
                cartId: cart.id,
            }
        });
        if (!response.ok) {
            console.error("Failed to create checkout session:", response.statusText);
            // TODO: Show notification to user
            return;
        }

        const checkoutSession = await response.json();
        const stripe = await clientStripe();
        const result = await stripe?.redirectToCheckout({
            sessionId: checkoutSession.sessionId,
        });
        if (result?.error) {
            console.error("Stripe checkout error:", result.error);
            // TODO: Show notification to user
        }
    }

    async function confirmClearCart() {
        await client().api["shopping-cart"].$delete();
        refetch();
    }

    return (
        <Stack spacing={4}>
            <Row spacing={2}>
                <div className="rounded-full bg-background p-2 flex items-center justify-center">
                    <ShoppingCartIcon className="size-7" />
                </div>
                <Typography level="h3">Košarica</Typography>
            </Row>
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
                <Row justifyContent="space-between">
                    <Typography>
                        Ukupno
                    </Typography>
                    <Row>
                        <Typography level="body1" bold>
                            {cart?.total.toFixed(2)}
                        </Typography>
                        <Euro className="size-4" />
                    </Row>
                </Row>
                <Row spacing={2}>
                    {/* TODO: Localize */}
                    <ModalConfirm
                        title="Potvrdi brisanje košarice"
                        header="Brisanje košarice"
                        onConfirm={confirmClearCart}
                        trigger={
                            <Button
                                variant="plain"
                                fullWidth
                                disabled={!cart?.items.length}>
                                Očisti košaricu
                            </Button>
                        }
                    >
                        <Typography>Jeste li sigurni da želite obrisati sve stavke iz košarice?</Typography>
                    </ModalConfirm>
                    <Button
                        variant="solid"
                        onClick={handleCheckout}
                        fullWidth
                        disabled={!cart?.items.length}>
                        Plaćanje
                    </Button>
                </Row>
            </Stack>
        </Stack>
    )
}

export function ShoppingCartHud() {
    const { data: cart } = useShoppingCart();
    if (!cart) {
        return null;
    }

    return (
        <HudCard
            open
            position="floating"
            className="static md:px-1">
            <Row spacing={1}>
                <Modal
                    title="Košarica"
                    className='bg-card border-tertiary border-b-4'
                    trigger={(
                        <IconButton
                            title="Trenutno vrijeme"
                            variant="plain"
                            className="relative rounded-full justify-between">
                            <ShoppingCartIcon className="size-5" />
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