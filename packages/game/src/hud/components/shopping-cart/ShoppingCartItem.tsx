import { PlantOrSortImage } from '@gredice/ui/plants';
import { ModalConfirm } from '@signalco/ui/ModalConfirm';
import { Delete, Euro, Hammer, Navigate, Timer } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Chip } from '@signalco/ui-primitives/Chip';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { CSSProperties } from 'react';
import { useCurrentAccount } from '../../../hooks/useCurrentAccount';
import { useCurrentGarden } from '../../../hooks/useCurrentGarden';
import { useInventory } from '../../../hooks/useInventory';
import { useSetShoppingCartItem } from '../../../hooks/useSetShoppingCartItem';
import type { ShoppingCartItemData } from '../../../hooks/useShoppingCart';
import { ButtonPricePickPaymentMethod } from './ButtonPricePickPaymentMethod';

export function ShoppingCartItem({ item }: { item: ShoppingCartItemData }) {
    const { data: garden } = useCurrentGarden();
    const { data: account } = useCurrentAccount();
    const { data: inventory } = useInventory();

    const hasDiscount = typeof item.shopData.discountPrice === 'number';
    const hasGarden = Boolean(item.gardenId && garden);
    const hasRaisedBed = Boolean(item.raisedBedId);
    const hasPosition = typeof item.positionIndex === 'number';

    const raisedBed = hasRaisedBed
        ? garden?.raisedBeds.find((rb) => rb.id === item.raisedBedId)
        : null;
    const scheduledDateString = item.additionalData
        ? JSON.parse(item.additionalData).scheduledDate
        : null;
    const scheduledDate = scheduledDateString
        ? new Date(scheduledDateString)
        : null;
    const changeCurrencyShoppingCartItem = useSetShoppingCartItem();
    const removeShoppingCartItem = useSetShoppingCartItem();
    const parsedAdditional = item.additionalData
        ? JSON.parse(item.additionalData)
        : {};
    const usesInventory =
        item.currency === 'inventory' || parsedAdditional.useInventory;
    const availableFromInventory = inventory?.items?.find(
        (invItem: any) =>
            invItem.entityTypeName === item.entityTypeName &&
            invItem.entityId === item.entityId,
    )?.amount;

    async function handleChangePaymentType(isSunflower: boolean) {
        await changeCurrencyShoppingCartItem.mutateAsync({
            id: item.id,
            amount: item.amount,
            entityId: item.entityId,
            entityTypeName: item.entityTypeName,
            currency: isSunflower ? 'sunflower' : 'eur',
        });
    }

    async function handleRemoveItem() {
        await removeShoppingCartItem.mutateAsync({
            id: item.id,
            amount: 0,
            entityId: item.entityId,
            entityTypeName: item.entityTypeName,
        });
    }

    async function handleToggleInventory() {
        await changeCurrencyShoppingCartItem.mutateAsync({
            id: item.id,
            amount: item.amount,
            entityId: item.entityId,
            entityTypeName: item.entityTypeName,
            currency: usesInventory ? 'eur' : 'inventory',
            additionalData: JSON.stringify({
                ...parsedAdditional,
                useInventory: !usesInventory,
            }),
        });
    }

    // Hide delete button for paid items
    const isProcessed = item.status === 'paid';

    const hasShopImage = Boolean(item.shopData.image);
    const shouldShowOperationFallback =
        item.entityTypeName === 'operation' && !hasShopImage;

    return (
        <Row spacing={2} alignItems="start">
            {shouldShowOperationFallback ? (
                <div className="rounded-lg border overflow-hidden size-14 aspect-square shrink-0 flex items-center justify-center">
                    <Hammer
                        role="img"
                        aria-label={item.shopData.name ?? 'Nepoznato'}
                        style={
                            {
                                '--imageSize': '32px',
                            } as CSSProperties
                        }
                        className="size-[--imageSize] shrink-0"
                    />
                </div>
            ) : (
                <PlantOrSortImage
                    className="rounded-lg border overflow-hidden size-14 aspect-square shrink-0"
                    width={56}
                    height={56}
                    alt={item.shopData.name ?? 'Nepoznato'}
                    coverUrl={item.shopData.image}
                    baseUrl="https://www.gredice.com"
                />
            )}
            <Stack className="grow">
                <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                    <Typography level="body1" noWrap>
                        {item.shopData.name}
                    </Typography>
                    {!hasDiscount && (
                        <ButtonPricePickPaymentMethod
                            price={item.shopData.price}
                            isSunflower={item.currency === 'sunflower'}
                            onChange={handleChangePaymentType}
                            availableSunflowers={
                                account?.sunflowers.amount ?? 0
                            }
                        />
                    )}
                </div>
                <Row spacing={1} className="flex-wrap justify-end">
                    {(usesInventory || availableFromInventory) && (
                        <Button
                            size="sm"
                            variant={usesInventory ? 'solid' : 'outlined'}
                            disabled={!availableFromInventory}
                            onClick={handleToggleInventory}
                        >
                            {usesInventory
                                ? 'Korištenje ruksaka'
                                : `Iskoristi (${availableFromInventory})`}
                        </Button>
                    )}
                </Row>
                {hasDiscount &&
                    typeof item.shopData.discountPrice === 'number' &&
                    typeof item.shopData.price === 'number' && (
                        <Row justifyContent="space-between" spacing={1}>
                            <Typography
                                level="body3"
                                secondary
                                className="text-green-600"
                            >
                                {`Popust: ${(100 - (item.shopData.discountPrice / item.shopData.price) * 100).toFixed(0)}% - ${item.shopData.discountDescription}`}
                            </Typography>
                            <Row spacing={0.5}>
                                <Typography
                                    level="body1"
                                    bold
                                    className="text-green-600"
                                >
                                    {item.shopData.discountPrice?.toFixed(2) ??
                                        'Nevaljan iznos'}
                                </Typography>
                                <Euro className="size-4 stroke-green-600" />
                            </Row>
                        </Row>
                    )}
                <Row justifyContent="space-between">
                    <Stack spacing={0.5}>
                        <Row spacing={1}>
                            <Row spacing={0.5} className="flex-wrap gap-y-0">
                                {hasGarden && (
                                    <Typography
                                        level="body3"
                                        className="overflow-ellipsis max-w-[200px] overflow-hidden whitespace-nowrap"
                                        secondary
                                    >
                                        {garden?.name || 'Nepoznati vrt'}
                                    </Typography>
                                )}
                                {hasGarden && hasRaisedBed && (
                                    <Navigate className="size-3 shrink-0" />
                                )}
                                {hasRaisedBed && (
                                    <Typography level="body3" secondary>
                                        {item.raisedBedId
                                            ? `${raisedBed?.name}`
                                            : 'Nepoznato'}
                                    </Typography>
                                )}
                                {hasRaisedBed && hasPosition && (
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
                                <Chip
                                    startDecorator={
                                        <Timer className="size-4" />
                                    }
                                    className="bg-muted"
                                >
                                    <Typography level="body3" secondary>
                                        {scheduledDate.toLocaleDateString(
                                            'hr-HR',
                                            {
                                                year: 'numeric',
                                                month: '2-digit',
                                                day: '2-digit',
                                            },
                                        )}
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
                            trigger={
                                <IconButton
                                    title="Makni s popisa"
                                    variant="plain"
                                    loading={removeShoppingCartItem.isPending}
                                    className="rounded-full aspect-square p-1 text-red-600"
                                    size="sm"
                                >
                                    <Delete className="size-4 shrink-0" />
                                </IconButton>
                            }
                        >
                            <Typography>
                                Jeste li sigurni da želite ukloniti ovu stavku
                                iz košarice?
                            </Typography>
                        </ModalConfirm>
                    )}
                </Row>
            </Stack>
        </Row>
    );
}
