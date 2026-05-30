import type { OperationData } from '@gredice/directory-types';
import {
    getAllOperationPrices,
    getEntitiesFormatted,
    getFarms,
} from '@gredice/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { auth } from '../../../../lib/auth/auth';
import { isMissingPayoutSchemaError } from '../payoutSchemaStatus';
import { type CurrentPrice, PriceRow } from './PriceForm';

export const dynamic = 'force-dynamic';

// Synthetic price rows for sowing (not CMS entities)
const SOWING_ROWS = [
    {
        entityTypeName: 'sowing',
        entityId: null as null,
        label: 'Sijanje (direktno)',
        sublabel: 'sowing',
    },
    {
        entityTypeName: 'sowingGreenhouse',
        entityId: null as null,
        label: 'Sijanje (staklenički rasad)',
        sublabel: 'sowingGreenhouse',
    },
];

function toCurrentPrice(
    price:
        | Awaited<ReturnType<typeof getAllOperationPrices>>[number]
        | undefined,
): CurrentPrice | undefined {
    if (!price) return undefined;
    return {
        id: price.id,
        pricePerUnit: price.pricePerUnit,
        currency: price.currency,
    };
}

async function getOperationPricesForPage() {
    try {
        return {
            prices: await getAllOperationPrices(),
            schemaAvailable: true,
        };
    } catch (error) {
        if (!isMissingPayoutSchemaError(error)) {
            throw error;
        }

        console.warn(
            'Operation price tables are not available in this database.',
        );
        return {
            prices: [],
            schemaAvailable: false,
        };
    }
}

export default async function AdminFarmerPricesPage() {
    await auth(['admin']);

    const [farms, operations, pricesResult] = await Promise.all([
        getFarms(),
        getEntitiesFormatted<OperationData>('operation').catch(
            () => [] as OperationData[],
        ),
        getOperationPricesForPage(),
    ]);
    const allPrices = pricesResult.prices;

    // Key: `${farmId}:${entityTypeName}:${entityId ?? 'null'}`
    const priceMap = new Map(
        allPrices.map((p) => [
            `${p.farmId}:${p.entityTypeName}:${p.entityId ?? 'null'}`,
            p,
        ]),
    );

    return (
        <Stack spacing={6}>
            <Stack spacing={2}>
                <Typography level="h4" component="h1">
                    Cijene radnji
                </Typography>
                <Typography level="body2" className="text-muted-foreground">
                    Postavi cijenu po radnji za svaku farmu. Ove cijene koriste
                    se za izračun stanja farmera i isplate.
                </Typography>
            </Stack>

            {!pricesResult.schemaAvailable && (
                <Card>
                    <CardContent>
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            Tablice za cijene radnji nisu dostupne u ovoj bazi.
                            Nakon migracije cijene će se moći uređivati ovdje.
                        </Typography>
                    </CardContent>
                </Card>
            )}

            {farms.length === 0 && (
                <Card>
                    <CardContent>
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            Nema farmâ u sustavu.
                        </Typography>
                    </CardContent>
                </Card>
            )}

            {pricesResult.schemaAvailable &&
                farms.map((farm) => (
                    <Card key={farm.id}>
                        <CardHeader>
                            <CardTitle>{farm.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Stack spacing={0}>
                                {/* Sowing flat prices */}
                                {SOWING_ROWS.map((row) => (
                                    <PriceRow
                                        key={row.entityTypeName}
                                        farmId={farm.id}
                                        entityTypeName={row.entityTypeName}
                                        entityId={row.entityId}
                                        label={row.label}
                                        sublabel={row.sublabel}
                                        currentPrice={toCurrentPrice(
                                            priceMap.get(
                                                `${farm.id}:${row.entityTypeName}:null`,
                                            ),
                                        )}
                                    />
                                ))}

                                {/* Per-operation prices */}
                                {operations.length === 0 ? (
                                    <Typography
                                        level="body3"
                                        className="text-muted-foreground py-2"
                                    >
                                        Nema definiranih vrsta radnji u CMS-u.
                                    </Typography>
                                ) : (
                                    operations.map((op) => (
                                        <PriceRow
                                            key={op.id}
                                            farmId={farm.id}
                                            entityTypeName="operation"
                                            entityId={op.id}
                                            label={op.information.label}
                                            sublabel={op.information.name}
                                            currentPrice={toCurrentPrice(
                                                priceMap.get(
                                                    `${farm.id}:operation:${op.id}`,
                                                ),
                                            )}
                                        />
                                    ))
                                )}
                            </Stack>
                        </CardContent>
                    </Card>
                ))}
        </Stack>
    );
}
