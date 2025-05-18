import { ArrowRight, Delete, Euro, Navigate, ShoppingCart as ShoppingCartIcon } from "@signalco/ui-icons";
import { Button } from "@signalco/ui-primitives/Button";
import { Row } from "@signalco/ui-primitives/Row";
import { DotIndicator } from "@signalco/ui-primitives/DotIndicator";
import { HudCard } from "./components/HudCard";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Modal } from "@signalco/ui-primitives/Modal";
import { useQuery } from "@tanstack/react-query";
import { client } from "@gredice/client";
import { Stack } from "@signalco/ui-primitives/Stack";
import { NoDataPlaceholder } from "@signalco/ui/NoDataPlaceholder";
import { IconButton } from "@signalco/ui-primitives/IconButton";

function useShoppingCart() {
    return useQuery({
        queryKey: ['shopping-cart'],
        queryFn: async () => {
            const response = await client().api["shopping-cart"].$get();
            if (response.status !== 200) {
                throw new Error('Failed to fetch shopping cart');
            }
            const cart = await response.json();
            cart.items.push({
                id: 1,
                cartId: cart.id,
                amount: 10.00,
                gardenId: 1,
                raisedBedId: 1,
                entityTypeName: "product",
                entityId: "1",
                isDeleted: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            return cart;
        },
    });
}

function ShoppingCartItem() {
    return (
        <Row spacing={2}>
            <img className="rounded-lg border overflow-hidden" width={50} height={50} />
            <Stack className="grow">
                <Row justifyContent="space-between">
                    <Typography level="body1">Naziv proizvoda</Typography>
                    <Typography level="body1" bold>
                        <Row>
                            10.00
                            <Euro className="size-4" />
                        </Row>
                    </Typography>
                </Row>
                <Typography level="body3" secondary>
                    Opis proizvoda
                </Typography>
                <Row justifyContent="space-between">
                    <Row spacing={1}>
                        <Row justifyContent="space-between" spacing={0.5}>
                            <Typography level="body3">Kol.</Typography>
                            <Typography level="body2" bold>
                                2
                            </Typography>
                        </Row>
                        <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground mx-1"></span>
                        <Row spacing={0.5}>
                            <Typography level="body3" secondary>
                                Garden
                            </Typography>
                            <Navigate className="size-3" />
                            <Typography level="body3" secondary>
                                Raised bed
                            </Typography>
                            <Navigate className="size-3" />
                            <Typography level="body3" secondary>
                                Skladište
                            </Typography>
                        </Row>
                    </Row>
                    <IconButton
                        title="Makni s popisa"
                        variant="plain"
                        className="rounded-full p-1 text-red-600"
                        size="sm"
                        onClick={() => alert("Remove item from cart")}>
                        <Delete className="size-4" />
                    </IconButton>
                </Row>
            </Stack>
        </Row>
    );
}

function ShoppingCart() {
    const { data: cart, isLoading, isError } = useShoppingCart();

    // const totalItems = items.reduce((total, item) => total + item.quantity, 0)
    // const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0)

    const handleCheckout = () => {
        alert("Proceeding to checkout!")
    }

    const handleClearCart = () => {
        // TODO: Delete cart
        alert("Cart cleared!")
    }

    return (
        <Stack spacing={4}>
            <Row spacing={2}>
                <div className="rounded-full bg-background p-2 flex items-center justify-center">
                    <ShoppingCartIcon className="size-7" />
                </div>
                <Typography level="h3">Košarica</Typography>
            </Row>
            <Stack>
                {isLoading && <Typography level="body1">Učitavanje...</Typography>}
                {isError && <Typography level="body1">Greška prilikom učitavanja košarice</Typography>}
                {!isLoading && !isError && (
                    <>
                        {cart?.items.length ? (
                            cart.items.map((item) => (
                                <ShoppingCartItem key={item.id} />
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
                    <Typography level="body1" bold>
                        <Row>
                            {(cart?.items.reduce((total, item) => total + item.amount, 0) || 0).toFixed(2)}
                            <Euro className="size-4" />
                        </Row>
                    </Typography>
                </Row>
                <Row spacing={2}>
                    <Button
                        variant="plain"
                        onClick={handleClearCart}
                        fullWidth
                        disabled={!cart?.items.length}>
                        Očisti košaricu
                    </Button>
                    <Button
                        variant="solid"
                        onClick={handleCheckout}
                        fullWidth
                        disabled={!cart?.items.length}>
                        Plačanje
                    </Button>
                </Row>
            </Stack>
        </Stack>
    )
}

export function ShoppingCartHud() {
    const { data: cart, isLoading, isError } = useShoppingCart();

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
                        <Button
                            title="Trenutno vrijeme"
                            variant="plain"
                            className="relative rounded-full px-2 justify-between pr-4 md:pr-2" size="sm">
                            <ShoppingCartIcon className="size-5" />
                            {Boolean(cart?.items.length) && (
                                <div className="absolute right-0 top-0">
                                    <DotIndicator size={16} color={"success"} content={(
                                        <Typography>{cart?.items.length}</Typography>
                                    )} />
                                </div>
                            )}
                        </Button>
                    )}>
                    <ShoppingCart />
                </Modal>
            </Row>
        </HudCard>
    );
}