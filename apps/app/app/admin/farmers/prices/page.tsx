import { getAllOperationPrices, getEntityTypes, getFarms } from '@gredice/storage';
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

export default async function AdminFarmerPricesPage() {
    await auth(['admin']);

    const [farms, entityTypes, allPrices] = await Promise.all([
        getFarms(),
        getEntityTypes(),
        getAllOperationPrices(),
    ]);

    const priceMap = new Map(
        allPrices.map((p) => [`${p.farmId}:${p.entityTypeName}`, p]),
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
                        {entityTypes.length === 0 ? (
                            <Typography
                                level="body2"
                                className="text-muted-foreground"
                            >
                                Nema definiranih vrsta radnji.
                            </Typography>
                        ) : (
                            <Stack spacing={0}>
                                {entityTypes.map((et) => (
                                    <PriceRow
                                        key={et.name}
                                        farm={farm}
                                        entityType={et}
                                        currentPrice={priceMap.get(
                                            `${farm.id}:${et.name}`,
                                        )}
                                    />
                                ))}
                            </Stack>
                        )}
                    </CardContent>
                </Card>
            ))}
        </Stack>
    );
}
