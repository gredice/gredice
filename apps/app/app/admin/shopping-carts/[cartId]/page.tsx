import {
    getEntitiesFormatted,
    getInventory,
    getShoppingCart,
} from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Field } from '../../../../components/shared/fields/Field';
import { FieldSet } from '../../../../components/shared/fields/FieldSet';
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

    const inventory = cart.accountId
        ? await getInventory(cart.accountId)
        : [];
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

    // Enhance cart items with entity names
    const enhancedItems = cart.items.map((item) => {
        const entities = entitiesLookup[item.entityTypeName] || [];
        const entity = entities.find((e) => e.id?.toString() === item.entityId);

        const parsedAdditional = item.additionalData
            ? JSON.parse(item.additionalData)
            : {};
        const usesInventory =
            item.currency === 'inventory' || parsedAdditional.useInventory;
        const inventoryAvailable = usesInventory
            ? inventoryLookup.get(`${item.entityTypeName}-${item.entityId}`) ?? 0
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
            return 'Inventar';
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

    return (
        <Stack spacing={4}>
            <Stack spacing={2}>
                <Breadcrumbs
                    items={[
                        { label: 'Košarice', href: KnownPages.ShoppingCarts },
                        { label: `Košarica ${cartIdNumber}` },
                    ]}
                />
                <Typography level="h1" className="text-2xl" semiBold>
                    Detalji košarice
                </Typography>
            </Stack>

            {/* Cart Information */}
            <FieldSet>
                <Field
                    name="Status"
                    value={
                        <Chip
                            className="w-fit"
                            color={
                                cart.status === 'paid' ? 'success' : 'neutral'
                            }
                        >
                            {cart.status === 'paid'
                                ? 'Plaćena'
                                : cart.status === 'new'
                                  ? 'Nova'
                                  : cart.status}
                        </Chip>
                    }
                />
                <Field name="Account ID" value={cart.accountId} />
                <Field name="Datum kreiranja" value={cart.createdAt} />
                {Object.keys(currencyTotals).length > 0 && (
                    <>
                        <Field
                            name="Broj stavki"
                            value={cart.items?.length || 0}
                        />
                        {inventoryItems.length > 0 && (
                            <Field
                                name="Inventar stavke"
                                value={inventoryItems.length}
                            />
                        )}
                        {Object.entries(currencyTotals).map(
                            ([currency, total]) => (
                                <Field
                                    key={currency}
                                    name={
                                        currency === 'eur'
                                            ? 'Ukupno (€)'
                                            : currency === 'sunflower'
                                              ? 'Ukupno (🌻)'
                                              : `Ukupno (${currency.toUpperCase()})`
                                    }
                                    value={formatCurrency(total, currency)}
                                />
                            ),
                        )}
                    </>
                )}
            </FieldSet>

            {/* Cart Items */}
            <Card>
                <CardOverflow>
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>Entitet</Table.Head>
                                <Table.Head>Količina</Table.Head>
                                <Table.Head>Cijena/kom</Table.Head>
                                <Table.Head>Ukupno</Table.Head>
                                <Table.Head>Inventar</Table.Head>
                                <Table.Head>Status</Table.Head>
                                <Table.Head>
                                    Vrt | Gredica | Pozicija
                                </Table.Head>
                                <Table.Head>Stvoreno</Table.Head>
                                <Table.Head>Ažurirano</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {enhancedItems.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={9}>
                                        <NoDataPlaceholder>
                                            Nema stavki u košarici
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {enhancedItems.map((item) => (
                                <Table.Row key={item.id}>
                                    <Table.Cell>
                                        <span>{item.entityName}</span>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <span className="font-medium">
                                            {item.amount}
                                        </span>
                                    </Table.Cell>
                                    <Table.Cell>
                                        {item.unitPrice > 0 ? (
                                            <span className="font-medium">
                                                {formatCurrency(
                                                    item.unitPrice,
                                                    item.currency,
                                                )}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400">
                                                N/A
                                            </span>
                                        )}
                                    </Table.Cell>
                                    <Table.Cell>
                                        {item.totalPrice > 0 ? (
                                            <span className="font-semibold">
                                                {formatCurrency(
                                                    item.totalPrice,
                                                    item.currency,
                                                )}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400">
                                                N/A
                                            </span>
                                        )}
                                    </Table.Cell>
                                    <Table.Cell>
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
                                                {`Inventar (${item.inventoryAvailable}/${item.amount})`}
                                            </Chip>
                                        ) : (
                                            <Typography
                                                level="body2"
                                                className="text-gray-500"
                                            >
                                                Nije
                                            </Typography>
                                        )}
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Chip
                                            className="w-fit"
                                            color={
                                                item.status === 'paid'
                                                    ? 'success'
                                                    : 'warning'
                                            }
                                        >
                                            {item.status === 'paid'
                                                ? 'Plaćena'
                                                : 'Nova'}
                                        </Chip>
                                    </Table.Cell>
                                    <Table.Cell>
                                        {item.gardenId ? (
                                            <Link
                                                href={KnownPages.Garden(
                                                    item.gardenId,
                                                )}
                                            >
                                                Vrt {item.gardenId}
                                            </Link>
                                        ) : (
                                            ''
                                        )}
                                        {item.raisedBedId ? (
                                            <>
                                                {' '}
                                                |{' '}
                                                <Link
                                                    href={KnownPages.RaisedBed(
                                                        item.raisedBedId,
                                                    )}
                                                >
                                                    Gr {item.raisedBedId}
                                                </Link>
                                            </>
                                        ) : (
                                            ''
                                        )}
                                        {typeof item.positionIndex === 'number'
                                            ? ` | Pozicija ${item.positionIndex + 1}`
                                            : ''}
                                    </Table.Cell>
                                    <Table.Cell>
                                        <LocalDateTime time={false}>
                                            {item.createdAt}
                                        </LocalDateTime>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <LocalDateTime time={false}>
                                            {item.updatedAt}
                                        </LocalDateTime>
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
                </CardOverflow>
            </Card>
        </Stack>
    );
}
