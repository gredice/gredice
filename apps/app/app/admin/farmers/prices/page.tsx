import { getAllOperationPrices, getFarms } from '@gredice/storage';
import { getEntitiesFormatted } from '@gredice/storage';
import type { OperationData } from '@gredice/directory-types';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@gredice/ui/Card';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { auth } from '../../../../lib/auth/auth';
import { PriceRow } from './PriceForm';

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

export default async function AdminFarmerPricesPage() {
    await auth(['admin']);

    const [farms, operations, allPrices] = await Promise.all([
        getFarms(),
        getEntitiesFormatted<OperationData>('operation').catch(() => [] as OperationData[]),
        getAllOperationPrices(),
    ]);

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

            {farms.length === 0 && (
                <Card>
                    <CardContent>
                        <Typography level="body2" className="text-muted-foreground">
                            Nema farmâ u sustavu.
                        </Typography>
                    </CardContent>
                </Card>
            )}

            {farms.map((farm) => (
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
                                    farm={farm}
                                    entityTypeName={row.entityTypeName}
                                    entityId={row.entityId}
                                    label={row.label}
                                    sublabel={row.sublabel}
                                    currentPrice={priceMap.get(
                                        `${farm.id}:${row.entityTypeName}:null`,
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
                                        farm={farm}
                                        entityTypeName="operation"
                                        entityId={op.id}
                                        label={op.information.label}
                                        sublabel={op.information.name}
                                        currentPrice={priceMap.get(
                                            `${farm.id}:operation:${op.id}`,
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
