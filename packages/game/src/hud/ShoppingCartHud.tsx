import { Delete, Info, Navigate, ShoppingCart as ShoppingCartIcon } from "@signalco/ui-icons";
import { Button } from "@signalco/ui-primitives/Button";
import { Row } from "@signalco/ui-primitives/Row";
import { DotIndicator } from "@signalco/ui-primitives/DotIndicator";
import { HudCard } from "./components/HudCard";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Modal } from "@signalco/ui-primitives/Modal";
import { Stack } from "@signalco/ui-primitives/Stack";
import { NoDataPlaceholder } from "@signalco/ui/NoDataPlaceholder";
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { useShoppingCart } from "../hooks/useShoppingCart";
import { ModalConfirm } from "@signalco/ui/ModalConfirm";
import { useCheckout } from "../hooks/useCheckout";
import { Alert } from "@signalco/ui/Alert";
import { ShoppingCartItem } from "./components/shopping-cart/ShoppingCartItem";
import { useCurrentAccount } from "../hooks/useCurrentAccount";
import { cx } from "@signalco/ui-primitives/cx";
import { useShoppingCartDelete } from "../hooks/useShoppingCartDelete";

export function ShoppingCart() {
    const { data: account } = useCurrentAccount();
    const { data: cart, isLoading, isError } = useShoppingCart();
    const deleteCart = useShoppingCartDelete();
    const checkout = useCheckout();
    const showSunflowersSuggestion =
        !cart?.items.some(item => item.currency === 'sunflower') &&
        cart?.items.some(item => (account?.sunflowers.amount ?? 0) > (item.shopData.price ?? 0) * 100);

    function handleCheckout() {
        if (!cart || !cart.id) {
            console.error("No cart available for checkout");
            return;
        }

        checkout.mutate(cart?.id);
    }

    function handleDeleteCart() {
        deleteCart.mutate();
    }

    return (
        <Stack spacing={2}>
            <Row spacing={2}>
                <div className="rounded-full bg-tertiary/40 p-3 flex items-center justify-center">
                    <ShoppingCartIcon className="size-7 shrink-0" />
                </div>
                <Typography level="h3">Košarica</Typography>
            </Row>
            <Stack>
                <div className={cx(
                    'opacity-0 h-0 transition-all duration-150',
                    showSunflowersSuggestion && "opacity-100 h-auto mb-4"
                )}>
                    <Alert color="primary">
                        Dio košarice moćeš platiti u <span className="text-yellow-500">🌻</span>. Odaberi željeni način plaćanja desno od cijene.
                    </Alert>
                </div>
                <Stack>
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
                    <Stack className="border-t mt-4 pt-2" spacing={1}>
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
                                        <Alert
                                            key={note}
                                            color="info"
                                            startDecorator={<Info className="opacity-80 stroke-blue-900 dark:stroke-blue-100 mt-px" />}>
                                            <Typography level="body2" className="text-blue-900 dark:text-blue-100">
                                                {note}
                                            </Typography>
                                        </Alert>
                                    ))}
                                </Stack>
                            )}
                            <div className="flex flex-row gap-2 justify-between flex-wrap">
                                {/* TODO: Localize */}
                                <ModalConfirm
                                    title="Potvrdi brisanje košarice"
                                    header="Brisanje košarice"
                                    onConfirm={handleDeleteCart}
                                    trigger={
                                        <Button
                                            variant="plain"
                                            disabled={!cart?.items.length || deleteCart.isPending}
                                            loading={deleteCart.isPending}
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
                                                disabled={!cart?.items.length || checkout.isPending || !cart.allowPurchase}
                                                loading={checkout.isPending}
                                                startDecorator={!cart?.allowPurchase ? <Info className="size-5 shrink-0" /> : undefined}
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
                                        disabled={!cart?.items.length || checkout.isPending || !cart.allowPurchase}
                                        loading={checkout.isPending}
                                        startDecorator={!cart?.allowPurchase ? <Info className="size-5 shrink-0" /> : undefined}
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