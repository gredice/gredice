import { BackpackIcon } from '@gredice/ui/BackpackIcon';
import { Chip } from '@gredice/ui/Chip';
import { IconButton } from '@gredice/ui/IconButton';
import { Input } from '@gredice/ui/Input';
import {
    Close,
    Delete,
    Euro,
    Hammer,
    Navigate,
    Timer,
} from '@gredice/ui/icons';
import { ModalConfirm } from '@gredice/ui/ModalConfirm';
import { Popper } from '@gredice/ui/Popper';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { RaisedBedIcon } from '@gredice/ui/RaisedBedIcon';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useQueryClient } from '@tanstack/react-query';
import { type CSSProperties, useEffect, useState } from 'react';
import { useGameAnalytics } from '../../../analytics/GameAnalyticsContext';
import { useCurrentAccount } from '../../../hooks/useCurrentAccount';
import { useCurrentGarden } from '../../../hooks/useCurrentGarden';
import { useInventory } from '../../../hooks/useInventory';
import { useSetShoppingCartItem } from '../../../hooks/useSetShoppingCartItem';
import {
    type ShoppingCartItemData,
    useShoppingCartQueryKey,
} from '../../../hooks/useShoppingCart';
import { ButtonPricePickPaymentMethod } from './ButtonPricePickPaymentMethod';

const outletReservationCountdownIntervalMs = 1000;
const outletReservationRefetchBufferMs = 500;
const urgentOutletReservationThresholdMs = 5 * 60 * 1000;

function formatCountdown(remainingMs: number) {
    const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseAdditionalData(additionalData?: string | null) {
    if (!additionalData) {
        return {};
    }

    try {
        const parsed = JSON.parse(additionalData);
        return isRecord(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function dateFromUnknown(value: unknown) {
    if (typeof value !== 'string' && !(value instanceof Date)) {
        return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function getTomorrowDate() {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
}

function formatDateInput(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseDateInput(date: string) {
    const [year, month, day] = date.split('-').map(Number);
    if (!year || !month || !day) {
        return null;
    }

    const parsedDate = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function formatCartDate(date: Date) {
    return date.toLocaleDateString('hr-HR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
}

type CartItemScheduledDateInfo = {
    date: Date;
    source: 'scheduled' | 'outlet' | 'default';
};

function getCartItemScheduledDateInfo(
    item: ShoppingCartItemData,
): CartItemScheduledDateInfo {
    const outletSowingDate = dateFromUnknown(item.outlet?.sowingDate);
    if (outletSowingDate) {
        return {
            date: outletSowingDate,
            source: 'outlet',
        };
    }

    const additionalData = parseAdditionalData(item.additionalData);
    const scheduledDate = dateFromUnknown(additionalData.scheduledDate);
    if (scheduledDate) {
        return {
            date: scheduledDate,
            source: 'scheduled',
        };
    }

    return {
        date: getTomorrowDate(),
        source: 'default',
    };
}

export function ShoppingCartItem({ item }: { item: ShoppingCartItemData }) {
    const { data: garden } = useCurrentGarden();
    const { data: account } = useCurrentAccount();
    const { data: inventory } = useInventory();
    const { track } = useGameAnalytics();
    const queryClient = useQueryClient();
    const [countdownNowMs, setCountdownNowMs] = useState(() => Date.now());
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const [datePickerError, setDatePickerError] = useState<string | null>(null);

    const hasDiscount = typeof item.shopData.discountPrice === 'number';
    const hasRaisedBed = Boolean(item.raisedBedId);
    const hasPosition = typeof item.positionIndex === 'number';
    const isProcessed = item.status === 'paid';

    const raisedBed = hasRaisedBed
        ? garden?.raisedBeds.find((rb) => rb.id === item.raisedBedId)
        : null;
    const scheduledDateInfo = getCartItemScheduledDateInfo(item);
    const scheduledDate = scheduledDateInfo.date;
    const scheduledDateLabel = formatCartDate(scheduledDate);
    const outletHoldExpiresAt = item.outlet?.holdExpiresAt
        ? new Date(item.outlet.holdExpiresAt)
        : null;
    const hasOutletReservation = Boolean(item.outlet);
    const outletReservationExpiredFromApi = item.outlet?.expired ?? false;
    const outletHoldExpiresAtMs = outletHoldExpiresAt?.getTime() ?? null;
    const outletReservationRemainingMs =
        outletHoldExpiresAtMs != null
            ? outletHoldExpiresAtMs - countdownNowMs
            : null;
    const outletReservationExpired =
        outletReservationExpiredFromApi ||
        (outletReservationRemainingMs != null &&
            outletReservationRemainingMs <= 0);
    const outletReservationText = outletReservationExpired
        ? 'Rezervacija istekla'
        : outletReservationRemainingMs != null
          ? `Istječe za ${formatCountdown(outletReservationRemainingMs)}`
          : 'Rezervirano';
    const outletReservationTitle = outletReservationExpired
        ? 'Outlet cijena više nije rezervirana.'
        : outletHoldExpiresAt
          ? `Outlet cijena čuva se do ${outletHoldExpiresAt.toLocaleTimeString(
                'hr-HR',
                {
                    hour: '2-digit',
                    minute: '2-digit',
                },
            )}.`
          : undefined;
    const outletReservationChipClassName = outletReservationExpired
        ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-100'
        : (outletReservationRemainingMs ?? Number.POSITIVE_INFINITY) <=
            urgentOutletReservationThresholdMs
          ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100'
          : 'bg-muted';
    const changeCurrencyShoppingCartItem = useSetShoppingCartItem();
    const removeShoppingCartItem = useSetShoppingCartItem();
    const changeScheduledDateShoppingCartItem = useSetShoppingCartItem();
    const canChangeScheduledDate = !isProcessed && !hasOutletReservation;

    useEffect(() => {
        if (
            !hasOutletReservation ||
            outletReservationExpiredFromApi ||
            !outletHoldExpiresAtMs
        ) {
            return;
        }

        setCountdownNowMs(Date.now());
        const interval = window.setInterval(() => {
            setCountdownNowMs(Date.now());
        }, outletReservationCountdownIntervalMs);

        return () => window.clearInterval(interval);
    }, [
        hasOutletReservation,
        outletReservationExpiredFromApi,
        outletHoldExpiresAtMs,
    ]);

    useEffect(() => {
        if (
            !hasOutletReservation ||
            outletReservationExpiredFromApi ||
            !outletHoldExpiresAtMs
        ) {
            return;
        }

        const delayMs = Math.max(outletHoldExpiresAtMs - Date.now(), 0);
        const timeout = window.setTimeout(() => {
            setCountdownNowMs(Date.now());
            void queryClient.invalidateQueries({
                queryKey: useShoppingCartQueryKey,
            });
        }, delayMs + outletReservationRefetchBufferMs);

        return () => window.clearTimeout(timeout);
    }, [
        hasOutletReservation,
        outletReservationExpiredFromApi,
        outletHoldExpiresAtMs,
        queryClient,
    ]);

    const usesInventory = item.currency === 'inventory';
    const availableFromInventory = inventory?.items?.find(
        (invItem) =>
            invItem.entityTypeName === item.entityTypeName &&
            invItem.entityId === item.entityId,
    )?.amount;

    async function handleChangePaymentType(isSunflower: boolean) {
        track('game_cart_payment_method_changed', {
            entity_id: item.entityId,
            entity_type: item.entityTypeName,
            payment_method: isSunflower ? 'sunflower' : 'eur',
        });
        await changeCurrencyShoppingCartItem.mutateAsync({
            id: item.id,
            amount: item.amount,
            entityId: item.entityId,
            entityTypeName: item.entityTypeName,
            currency: isSunflower ? 'sunflower' : 'eur',
            additionalData: item.additionalData,
            positionIndex: item.positionIndex ?? undefined,
            gardenId: item.gardenId ?? undefined,
            raisedBedId: item.raisedBedId ?? undefined,
        });
    }

    async function handleRemoveItem() {
        track('game_cart_item_removed', {
            entity_id: item.entityId,
            entity_type: item.entityTypeName,
            item_id: item.id,
        });
        await removeShoppingCartItem.mutateAsync({
            id: item.id,
            amount: 0,
            entityId: item.entityId,
            entityTypeName: item.entityTypeName,
        });
    }

    async function handleToggleInventory() {
        track('game_cart_item_inventory_toggled', {
            entity_id: item.entityId,
            entity_type: item.entityTypeName,
            item_id: item.id,
            use_inventory: !usesInventory,
        });
        await changeCurrencyShoppingCartItem.mutateAsync({
            id: item.id,
            amount: item.amount,
            entityId: item.entityId,
            entityTypeName: item.entityTypeName,
            currency: usesInventory ? 'eur' : 'inventory',
            additionalData: item.additionalData,
            positionIndex: item.positionIndex ?? undefined,
            gardenId: item.gardenId ?? undefined,
            raisedBedId: item.raisedBedId ?? undefined,
        });
    }

    async function handleScheduledDateChange(date: string) {
        const parsedDate = parseDateInput(date);
        if (!parsedDate) {
            setDatePickerError('Odaberi datum.');
            return;
        }

        const nextScheduledDate = parsedDate.toISOString();
        const additionalData = {
            ...parseAdditionalData(item.additionalData),
            scheduledDate: nextScheduledDate,
        };

        setDatePickerError(null);
        track('game_cart_scheduled_date_changed', {
            entity_id: item.entityId,
            entity_type: item.entityTypeName,
            item_id: item.id,
            scheduled_date: nextScheduledDate,
        });

        try {
            await changeScheduledDateShoppingCartItem.mutateAsync({
                id: item.id,
                amount: item.amount,
                entityId: item.entityId,
                entityTypeName: item.entityTypeName,
                currency: item.currency,
                additionalData: JSON.stringify(additionalData),
                positionIndex: item.positionIndex ?? undefined,
                gardenId: item.gardenId ?? undefined,
                raisedBedId: item.raisedBedId ?? undefined,
            });
            setDatePickerOpen(false);
        } catch {
            setDatePickerError('Promjena datuma nije uspjela.');
        }
    }

    const plantSort =
        item.entityTypeName === 'plantSort' ? item.entityData : null;
    const hasShopImage = Boolean(item.shopData.image);
    const shouldShowOperationFallback =
        item.entityTypeName === 'operation' && !hasShopImage;

    return (
        <Row spacing={4} alignItems="start">
            {plantSort ? (
                <PlantOrSortImage
                    className="rounded-lg border overflow-hidden size-14 aspect-square shrink-0"
                    width={56}
                    height={56}
                    alt={item.shopData.name ?? 'Nepoznato'}
                    plantSort={plantSort}
                />
            ) : shouldShowOperationFallback ? (
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
                />
            )}
            <Stack className="grow">
                <div className="grid grid-cols-[1fr_auto] items-center">
                    <Typography level="body1" noWrap>
                        {item.shopData.name}
                    </Typography>
                    {!hasDiscount && (
                        <Row spacing={2}>
                            {!usesInventory && availableFromInventory && (
                                <IconButton
                                    title="Iskoristi iz ruksaka"
                                    size="sm"
                                    variant="solid"
                                    onClick={handleToggleInventory}
                                >
                                    <BackpackIcon className="size-5 shrink-0" />
                                </IconButton>
                            )}
                            <ButtonPricePickPaymentMethod
                                price={item.shopData.price}
                                isSunflower={item.currency === 'sunflower'}
                                onChange={handleChangePaymentType}
                                availableSunflowers={
                                    account?.sunflowers.amount ?? 0
                                }
                                discountPrice={item.shopData.discountPrice}
                                disabled={
                                    changeCurrencyShoppingCartItem.isPending
                                }
                            />
                        </Row>
                    )}
                    <Row spacing={2} className="flex-wrap justify-end">
                        {usesInventory && (
                            <Row spacing={1}>
                                <BackpackIcon className="size-4 shrink-0" />
                                <Typography level="body2">
                                    Iz ruksaka
                                </Typography>
                                <IconButton
                                    title="Poništi korištenje iz ruksaka"
                                    variant="plain"
                                    size="sm"
                                    onClick={handleToggleInventory}
                                >
                                    <Close className="size-4 shrink-0" />
                                </IconButton>
                            </Row>
                        )}
                    </Row>
                </div>
                {hasDiscount &&
                    typeof item.shopData.discountPrice === 'number' &&
                    typeof item.shopData.price === 'number' && (
                        <Row justifyContent="space-between" spacing={2}>
                            <Typography
                                level="body3"
                                secondary
                                className="text-green-600"
                            >
                                {`Popust: ${(100 - (item.shopData.discountPrice / item.shopData.price) * 100).toFixed(0)}% - ${item.shopData.discountDescription}`}
                            </Typography>
                            <Row spacing={1}>
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
                {item.outlet && (
                    <Row className="flex-wrap" spacing={1}>
                        <Chip className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-100">
                            <Typography level="body3">
                                Outlet sadnica
                            </Typography>
                        </Chip>
                        <Chip
                            className={outletReservationChipClassName}
                            title={outletReservationTitle}
                        >
                            <Typography level="body3">
                                {outletReservationText}
                            </Typography>
                        </Chip>
                    </Row>
                )}
                <Row justifyContent="space-between">
                    <Stack spacing={1}>
                        <Row spacing={2}>
                            <Row spacing={1} className="flex-wrap gap-y-0">
                                {hasRaisedBed && (
                                    <Typography
                                        level="body3"
                                        secondary
                                        component="span"
                                    >
                                        {raisedBed?.physicalId ? (
                                            <Row spacing={2}>
                                                <RaisedBedIcon
                                                    physicalId={
                                                        raisedBed.physicalId
                                                    }
                                                    className="size-6"
                                                />
                                                <span>
                                                    {`${raisedBed?.name}`}
                                                </span>
                                            </Row>
                                        ) : (
                                            'Nova gredica'
                                        )}
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
                        <Row>
                            {canChangeScheduledDate ? (
                                <Popper
                                    open={datePickerOpen}
                                    onOpenChange={(open) => {
                                        setDatePickerOpen(open);
                                        if (open) {
                                            setDatePickerError(null);
                                        }
                                    }}
                                    side="bottom"
                                    align="start"
                                    sideOffset={8}
                                    className="w-72 p-3"
                                    trigger={
                                        <Chip
                                            startDecorator={
                                                <Timer className="size-4" />
                                            }
                                            className="bg-muted"
                                            disabled={
                                                changeScheduledDateShoppingCartItem.isPending
                                            }
                                            onClick={() =>
                                                setDatePickerError(null)
                                            }
                                            title={`Promijeni datum: ${scheduledDateLabel}`}
                                        >
                                            <Typography level="body3" secondary>
                                                {scheduledDateLabel}
                                            </Typography>
                                        </Chip>
                                    }
                                >
                                    <Stack spacing={2}>
                                        <Input
                                            type="date"
                                            label="Datum"
                                            name={`cartItemScheduledDate-${item.id}`}
                                            className="w-full bg-card"
                                            value={formatDateInput(
                                                scheduledDate,
                                            )}
                                            min={formatDateInput(
                                                getTomorrowDate(),
                                            )}
                                            disabled={
                                                changeScheduledDateShoppingCartItem.isPending
                                            }
                                            onChange={(event) => {
                                                void handleScheduledDateChange(
                                                    event.target.value,
                                                );
                                            }}
                                            required
                                        />
                                        {datePickerError ? (
                                            <Typography
                                                level="body3"
                                                className="text-red-600"
                                            >
                                                {datePickerError}
                                            </Typography>
                                        ) : null}
                                    </Stack>
                                </Popper>
                            ) : (
                                <Chip
                                    startDecorator={
                                        <Timer className="size-4" />
                                    }
                                    className="bg-muted"
                                    title={
                                        scheduledDateInfo.source === 'outlet'
                                            ? 'Datum sjetve outlet sadnice'
                                            : 'Datum'
                                    }
                                >
                                    <Typography level="body3" secondary>
                                        {scheduledDateLabel}
                                    </Typography>
                                </Chip>
                            )}
                        </Row>
                    </Stack>
                    {!isProcessed && (
                        <ModalConfirm
                            title="Potvrdi brisanje stavke"
                            header="Brisanje stavke iz košare"
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
                                iz košare?
                            </Typography>
                        </ModalConfirm>
                    )}
                </Row>
            </Stack>
        </Row>
    );
}
