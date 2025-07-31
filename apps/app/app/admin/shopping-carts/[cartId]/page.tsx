import { getEntitiesFormatted, getShoppingCart } from "@gredice/storage";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import { Table } from "@signalco/ui-primitives/Table";
import { auth } from "../../../../lib/auth/auth";
import { Breadcrumbs } from "@signalco/ui/Breadcrumbs";
import { KnownPages } from "../../../../src/KnownPages";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { NoDataPlaceholder } from "../../../../components/shared/placeholders/NoDataPlaceholder";
import { notFound } from "next/navigation";
import { LocaleDateTime } from "../../../../components/shared/LocaleDateTime";
import { EntityStandardized } from "../../../../lib/@types/EntityStandardized";
import { Chip } from "@signalco/ui-primitives/Chip";
import { Row } from "@signalco/ui-primitives/Row";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function ShoppingCartDetailsPage({ params }: { params: { cartId: number; } }) {
    const { cartId } = params;
    await auth(['admin']);
    const cart = await getShoppingCart(cartId);
    if (!cart) {
        notFound();
    }

    // Get unique entity types from cart items
    const entityTypes = [...new Set(cart.items.map(item => item.entityTypeName))];

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
    const enhancedItems = cart.items.map(item => {
        const entities = entitiesLookup[item.entityTypeName] || [];
        const entity = entities.find(e => e.id?.toString() === item.entityId);

        // Calculate price based on entity type and amount
        const unitPrice = entity?.prices?.perPlant || entity?.prices?.perOperation || 0;
        const totalPrice = unitPrice * item.amount;

        return {
            ...item,
            entityName: entity?.information?.label || entity?.information?.name || `${item.entityTypeName} ${item.entityId}`,
            unitPrice,
            totalPrice
        };
    });

    // Helper function to format currency
    const formatCurrency = (amount: number, currency: string) => {
        const currencyMap: Record<string, { symbol: string; code?: string }> = {
            'euro': { symbol: '€', code: 'EUR' },
            'eur': { symbol: '€', code: 'EUR' },
            'usd': { symbol: '$', code: 'USD' },
            'sunflower': { symbol: '🌻' }
        };

        const currencyInfo = currencyMap[currency.toLowerCase()];
        if (!currencyInfo?.code) {
            return `${amount} ${currencyInfo.symbol}`; // Fallback if currency is unknown
        }

        return new Intl.NumberFormat('hr-HR', {
            style: 'currency',
            currency: currencyInfo.code,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    };

    // Calculate totals by currency
    const currencyTotals = enhancedItems.reduce((totals, item) => {
        if (item.totalPrice > 0) {
            const currency = item.currency;
            totals[currency] = (totals[currency] || 0) + item.totalPrice;
        }
        return totals;
    }, {} as Record<string, number>);

    return (
        <Stack spacing={4}>
            <Stack spacing={2}>
                <Breadcrumbs items={[
                    { label: 'Košarice', href: KnownPages.ShoppingCarts },
                    { label: `Košarica ${cartId}` }
                ]} />
                <Typography level="h1" className="text-2xl" semiBold>Detalji košarice</Typography>
            </Stack>

            {/* Cart Information */}
            <Card>
                <CardOverflow>
                    <div className="p-6">
                        <Stack spacing={3}>
                            <Row spacing={4} alignItems="center">
                                <Stack spacing={1}>
                                    <Typography level="body2">Status košarice</Typography>
                                    <Chip className="w-fit" color={cart.status === 'paid' ? 'success' : 'neutral'}>
                                        {cart.status === 'paid' ? 'Plaćena' : (cart.status === 'new' ? 'Nova' : cart.status)}
                                    </Chip>
                                </Stack>
                                <Stack spacing={1}>
                                    <Typography level="body2">Account ID</Typography>
                                    <Link href={`/admin/accounts/${cart.accountId}`}>
                                        <Typography>{cart.accountId}</Typography>
                                    </Link>
                                </Stack>
                                <Stack spacing={1}>
                                    <Typography level="body2">Datum kreiranja</Typography>
                                    <Typography>
                                        <LocaleDateTime>{cart.createdAt}</LocaleDateTime>
                                    </Typography>
                                </Stack>
                            </Row>
                            {Object.keys(currencyTotals).length > 0 && (
                                <Row spacing={4} alignItems="center">
                                    <Stack spacing={1}>
                                        <Typography level="body2">Broj stavki</Typography>
                                        <Typography>{cart.items?.length || 0}</Typography>
                                    </Stack>
                                    {Object.entries(currencyTotals).map(([currency, total]) => (
                                        <Stack key={currency} spacing={1}>
                                            <Typography level="body2">
                                                {currency === 'euro' || currency === 'eur' ? 'Ukupno (€)' :
                                                    currency === 'sunflower' ? 'Ukupno (🌻)' :
                                                        `Ukupno (${currency.toUpperCase()})`}
                                            </Typography>
                                            <Typography level="h5" semiBold>
                                                {formatCurrency(total, currency)}
                                            </Typography>
                                        </Stack>
                                    ))}
                                </Row>
                            )}
                        </Stack>
                    </div>
                </CardOverflow>
            </Card>

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
                                <Table.Head>Status</Table.Head>
                                <Table.Head>Vrt | Gredica | Pozicija</Table.Head>
                                <Table.Head>Stvoreno</Table.Head>
                                <Table.Head>Ažurirano</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {enhancedItems.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={8}>
                                        <NoDataPlaceholder>
                                            Nema stavki u košarici
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {enhancedItems.map(item => (
                                <Table.Row key={item.id}>
                                    <Table.Cell>
                                        <span>{item.entityName}</span>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <span className="font-medium">{item.amount}</span>
                                    </Table.Cell>
                                    <Table.Cell>
                                        {item.unitPrice > 0 ? (
                                            <span className="font-medium">
                                                {formatCurrency(item.unitPrice, item.currency)}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400">N/A</span>
                                        )}
                                    </Table.Cell>
                                    <Table.Cell>
                                        {item.totalPrice > 0 ? (
                                            <span className="font-semibold">
                                                {formatCurrency(item.totalPrice, item.currency)}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400">N/A</span>
                                        )}
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Chip
                                            className="w-fit"
                                            color={item.status === 'paid' ? 'success' : 'warning'}
                                        >
                                            {item.status === 'paid' ? 'Plaćena' : 'Nova'}
                                        </Chip>
                                    </Table.Cell>
                                    <Table.Cell>
                                        {item.gardenId ? `Vrt ${item.gardenId}` : ''}
                                        {item.raisedBedId ? ` | Gredica ${item.raisedBedId}` : ''}
                                        {typeof item.positionIndex === 'number' ? ` | Pozicija ${item.positionIndex}` : ''}
                                    </Table.Cell>
                                    <Table.Cell>
                                        <LocaleDateTime time={false}>
                                            {item.createdAt}
                                        </LocaleDateTime>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <LocaleDateTime time={false}>
                                            {item.updatedAt}
                                        </LocaleDateTime>
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