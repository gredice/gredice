import {
    getEntitiesFormatted,
    getInventory,
    getRaisedBed,
    getShoppingCart,
} from '@gredice/storage';
import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
    EntityDetailsPanelCard,
    EntityDetailsPropertiesLayout,
    EntityDetailsPropertiesPanel,
    EntityDetailsPropertiesProvider,
    EntityDetailsPropertiesToggle,
    EntityDetailsPropertyList,
    type EntityDetailsPropertyListItem,
} from '../../../../components/admin/details';
import { AdminPageHeader } from '../../../../components/admin/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { AdminPageTitle } from '../../../../components/admin/navigation/AdminPageTitle';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import type { EntityStandardized } from '../../../../lib/@types/EntityStandardized';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';

export const dynamic = 'force-dynamic';

export default async function ShoppingCartDetailsPage({
    params,
}: PageProps<'/admin/shopping-carts/[cartId]'>) {
    const { cartId } = await params;
    const cartIdNumber = Number(cartId);
    if (Number.isNaN(cartIdNumber)) {
        notFound();
    }
    await auth(['admin']);
    const cart = await getShoppingCart(cartIdNumber);
    if (!cart) {
        notFound();
    }

    const inventory = cart.accountId ? await getInventory(cart.accountId) : [];
    const inventoryLookup = new Map(
        inventory.map((item) => [
            `${item.entityTypeName}-${item.entityId}`,
            item.amount,
        ]),
    );

    // Get unique entity types from cart items
    const entityTypes = [
        ...new Set(cart.items.map((item) => item.entityTypeName)),
    ];

    // Fetch entities for each type
    const entitiesPromises = entityTypes.map(async (entityTypeName) => {
        const entities = await getEntitiesFormatted(entityTypeName);
        return { entityTypeName, entities };
    });

    const entitiesResults = await Promise.all(entitiesPromises);

    // Create a lookup map
    const entitiesLookup: Record<string, EntityStandardized[]> = {};
    entitiesResults.forEach(({ entityTypeName, entities }) => {
        entitiesLookup[entityTypeName] = entities as EntityStandardized[];
    });

    const raisedBedIds = [
        ...new Set(
            cart.items
                .map((item) => item.raisedBedId)
                .filter(
                    (raisedBedId): raisedBedId is number =>
                        typeof raisedBedId === 'number',
                ),
        ),
    ];
    const raisedBeds = await Promise.all(
        raisedBedIds.map(async (raisedBedId) => ({
            raisedBedId,
            raisedBed: await getRaisedBed(raisedBedId),
        })),
    );
    const raisedBedPhysicalIdLookup = new Map(
        raisedBeds.map(({ raisedBedId, raisedBed }) => [
            raisedBedId,
            raisedBed?.physicalId,
        ]),
    );

    // Enhance cart items with entity names
    const enhancedItems = cart.items.map((item) => {
        const entities = entitiesLookup[item.entityTypeName] || [];
        const entity = entities.find((e) => e.id?.toString() === item.entityId);

        const usesInventory = item.currency === 'inventory';
        const inventoryAvailable = usesInventory
            ? (inventoryLookup.get(`${item.entityTypeName}-${item.entityId}`) ??
              0)
            : 0;

        // Calculate price based on entity type and amount
        let unitPrice =
            entity?.prices?.perPlant ||
            entity?.prices?.perOperation ||
            entity?.information?.plant?.prices?.perPlant ||
            0;
        let totalPrice = unitPrice * item.amount;

        if (item.currency === 'sunflower') {
            unitPrice = unitPrice * 1000;
            totalPrice = totalPrice * 1000;
        }

        if (usesInventory) {
            unitPrice = 0;
            totalPrice = 0;
        }

        return {
            ...item,
            usesInventory,
            inventoryAvailable,
            entityName:
                entity?.information?.label ||
                entity?.information?.name ||
                `${item.entityTypeName} ${item.entityId}`,
            unitPrice,
            totalPrice,
        };
    });

    // Helper function to format currency
    const formatCurrency = (amount: number, currency: string) => {
        if (currency.toLowerCase() === 'inventory') {
            return 'Ruksak';
        }

        const currencyMap: Record<string, { symbol: string; code?: string }> = {
            eur: { symbol: '€', code: 'EUR' },
            usd: { symbol: '$', code: 'USD' },
            sunflower: { symbol: '🌻' },
        };

        const currencyInfo = currencyMap[currency.toLowerCase()];
        if (!currencyInfo?.code) {
            return `${amount} ${currencyInfo?.symbol ?? ''}`; // Fallback if currency is unknown
        }

        return new Intl.NumberFormat('hr-HR', {
            style: 'currency',
            currency: currencyInfo.code,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    };

    // Calculate totals by currency
    const currencyTotals = enhancedItems.reduce(
        (totals, item) => {
            if (item.totalPrice > 0) {
                const currency = item.currency;
                totals[currency] = (totals[currency] || 0) + item.totalPrice;
            }
            return totals;
        },
        {} as Record<string, number>,
    );

    const inventoryItems = enhancedItems.filter((item) => item.usesInventory);
    const propertyItems: EntityDetailsPropertyListItem[] = [
        {
            id: 'status',
            label: 'Status',
            value: (
                <Chip
                    className="w-fit"
                    color={cart.status === 'paid' ? 'success' : 'neutral'}
                >
                    {cart.status === 'paid'
                        ? 'Plaćena'
                        : cart.status === 'new'
                          ? 'Nova'
                          : cart.status}
                </Chip>
            ),
        },
        { id: 'account-id', label: 'Account ID', value: cart.accountId },
        {
            id: 'created-at',
            label: 'Datum kreiranja',
            value: cart.createdAt,
        },
        ...(Object.keys(currencyTotals).length > 0
            ? [
                  {
                      id: 'items-count',
                      label: 'Broj stavki',
                      value: cart.items?.length || 0,
                  },
                  ...(inventoryItems.length > 0
                      ? [
                            {
                                id: 'inventory-items-count',
                                label: 'Stavke ruksaka',
                                value: inventoryItems.length,
                            },
                        ]
                      : []),
                  ...Object.entries(currencyTotals).map(
                      ([currency, total]) => ({
                          id: `total-${currency}`,
                          label:
                              currency === 'eur'
                                  ? 'Ukupno (€)'
                                  : currency === 'sunflower'
                                    ? 'Ukupno (🌻)'
                                    : `Ukupno (${currency.toUpperCase()})`,
                          value: formatCurrency(total, currency),
                      }),
                  ),
              ]
            : []),
    ];
    const propertiesPanel = (
        <EntityDetailsPropertiesPanel>
            <EntityDetailsPanelCard title="Detalji">
                <EntityDetailsPropertyList items={propertyItems} />
            </EntityDetailsPanelCard>
        </EntityDetailsPropertiesPanel>
    );

    return (
        <EntityDetailsPropertiesProvider>
            <Stack spacing={8}>
                <AdminPageTitle title={`Košarica ${cartIdNumber}`} />
                <AdminPageHeader
                    breadcrumbs={
                        <Breadcrumbs
                            items={[
                                {
                                    label: <AdminBreadcrumbLevelSelector />,
                                    href: KnownPages.ShoppingCarts,
                                },
                                { label: `Košarica ${cartIdNumber}` },
                            ]}
                        />
                    }
                    actions={
                        <Row className="items-center" spacing={2}>
                            <EntityDetailsPropertiesToggle />
                        </Row>
                    }
                    heading="Detalji košarice"
                />

                {/* Cart Items */}
                <EntityDetailsPropertiesLayout properties={propertiesPanel}>
                    <Card>
                        <CardOverflow>
                            {enhancedItems.length === 0 ? (
                                <div className="p-4">
                                    <NoDataPlaceholder>
                                        Nema stavki u košarici
                                    </NoDataPlaceholder>
                                </div>
                            ) : (
                                <ul className="divide-y">
                                    {enhancedItems.map((item) => (
                                        <li
                                            key={item.id}
                                            className="px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                                        >
                                            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                <Stack
                                                    spacing={1}
                                                    className="min-w-0"
                                                >
                                                    <Typography
                                                        level="body2"
                                                        semiBold
                                                        className="min-w-0 break-words"
                                                    >
                                                        {item.entityName}
                                                    </Typography>
                                                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                                                        {item.gardenId ? (
                                                            <Link
                                                                href={KnownPages.Garden(
                                                                    item.gardenId,
                                                                )}
                                                                className="text-primary underline-offset-4 hover:underline"
                                                            >
                                                                Vrt{' '}
                                                                {item.gardenId}
                                                            </Link>
                                                        ) : (
                                                            ''
                                                        )}
                                                        {item.raisedBedId ? (
                                                            <>
                                                                <span>|</span>
                                                                <Link
                                                                    href={KnownPages.RaisedBed(
                                                                        item.raisedBedId,
                                                                    )}
                                                                    className="text-primary underline-offset-4 hover:underline"
                                                                >
                                                                    Gr{' '}
                                                                    {raisedBedPhysicalIdLookup.get(
                                                                        item.raisedBedId,
                                                                    ) ??
                                                                        item.raisedBedId}
                                                                </Link>
                                                            </>
                                                        ) : (
                                                            ''
                                                        )}
                                                        {typeof item.positionIndex ===
                                                        'number' ? (
                                                            <>
                                                                <span>|</span>
                                                                <span>
                                                                    Pozicija{' '}
                                                                    {item.positionIndex +
                                                                        1}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            ''
                                                        )}
                                                    </div>
                                                </Stack>
                                                <div className="flex min-w-0 flex-col gap-3 lg:items-end">
                                                    <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
                                                        {item.usesInventory ? (
                                                            <Chip
                                                                className="w-fit"
                                                                color={
                                                                    item.inventoryAvailable >=
                                                                    item.amount
                                                                        ? 'success'
                                                                        : 'warning'
                                                                }
                                                            >
                                                                {`Ruksak (${item.inventoryAvailable}/${item.amount})`}
                                                            </Chip>
                                                        ) : (
                                                            <Typography
                                                                level="body2"
                                                                className="text-gray-500"
                                                            >
                                                                Nije
                                                            </Typography>
                                                        )}
                                                        <Chip
                                                            className="w-fit"
                                                            color={
                                                                item.status ===
                                                                'paid'
                                                                    ? 'success'
                                                                    : 'warning'
                                                            }
                                                        >
                                                            {item.status ===
                                                            'paid'
                                                                ? 'Plaćena'
                                                                : 'Nova'}
                                                        </Chip>
                                                    </div>
                                                    <dl className="grid min-w-0 gap-x-4 gap-y-2 text-sm sm:grid-cols-3 lg:text-right">
                                                        <div className="min-w-0">
                                                            <dt className="text-xs font-medium uppercase text-muted-foreground">
                                                                Količina
                                                            </dt>
                                                            <dd className="mt-1 font-medium">
                                                                {item.amount}
                                                            </dd>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <dt className="text-xs font-medium uppercase text-muted-foreground">
                                                                Cijena/kom
                                                            </dt>
                                                            <dd className="mt-1 font-medium">
                                                                {item.unitPrice >
                                                                0 ? (
                                                                    formatCurrency(
                                                                        item.unitPrice,
                                                                        item.currency,
                                                                    )
                                                                ) : (
                                                                    <span className="text-gray-400">
                                                                        N/A
                                                                    </span>
                                                                )}
                                                            </dd>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <dt className="text-xs font-medium uppercase text-muted-foreground">
                                                                Ukupno
                                                            </dt>
                                                            <dd className="mt-1 font-semibold">
                                                                {item.totalPrice >
                                                                0 ? (
                                                                    formatCurrency(
                                                                        item.totalPrice,
                                                                        item.currency,
                                                                    )
                                                                ) : (
                                                                    <span className="text-gray-400">
                                                                        N/A
                                                                    </span>
                                                                )}
                                                            </dd>
                                                        </div>
                                                    </dl>
                                                    <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-left lg:justify-end lg:text-right">
                                                        <Typography
                                                            component="div"
                                                            level="body3"
                                                            className="whitespace-nowrap text-muted-foreground"
                                                        >
                                                            Stvoreno:{' '}
                                                            <LocalDateTime
                                                                time={false}
                                                            >
                                                                {item.createdAt}
                                                            </LocalDateTime>
                                                        </Typography>
                                                        <Typography
                                                            component="div"
                                                            level="body3"
                                                            className="whitespace-nowrap text-muted-foreground"
                                                        >
                                                            Ažurirano:{' '}
                                                            <LocalDateTime
                                                                time={false}
                                                            >
                                                                {item.updatedAt}
                                                            </LocalDateTime>
                                                        </Typography>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardOverflow>
                    </Card>
                </EntityDetailsPropertiesLayout>
            </Stack>
        </EntityDetailsPropertiesProvider>
    );
}
