import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Container } from '@gredice/ui/Container';
import { OperationImage } from '@gredice/ui/OperationImage';
import { PageHeader } from '@gredice/ui/PageHeader';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import Link from 'next/link';
import { FeedbackModal } from '../../components/shared/feedback/FeedbackModal';
import { formatPrice } from '../../lib/formatPrice';
import { getHqLocationsData } from '../../lib/getHqLocationsData';
import { getOperationsData } from '../../lib/plants/getOperationsData';
import { getPlantSortsData } from '../../lib/plants/getPlantSortsData';
import { getPlantsData } from '../../lib/plants/getPlantsData';
import { KnownPages } from '../../src/KnownPages';
import {
    getPlantSortParentName,
    getPricedOperationRows,
    getPricedPlantRows,
    getPricedPlantSortRows,
} from './pricingRows';

export const metadata: Metadata = {
    title: 'Cjenik',
    description:
        'Pregled svih cijena: biljke, radnje i dostava na jednom mjestu.',
};

export default async function PricingPage() {
    const [plantsData, plantSortsData, operationsData, hqLocations] =
        await Promise.all([
            getPlantsData(),
            getPlantSortsData(),
            getOperationsData(),
            getHqLocationsData(),
        ]);

    const plantsWithPrices = getPricedPlantRows(plantsData);
    const plantSortsWithPrices = getPricedPlantSortRows(plantSortsData);
    const operationsWithPrices = getPricedOperationRows(operationsData);

    const sortedHqLocations = [...hqLocations].sort((a, b) =>
        a.information.label.localeCompare(b.information.label, 'hr-HR'),
    );

    return (
        <Container maxWidth="lg">
            <Stack spacing={4}>
                <PageHeader
                    padded
                    header="💶 Cjenik"
                    subHeader="Sve cijene na jednom mjestu: biljke, sorte, radnje i dostava"
                />

                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle>
                            Cijene biljaka i sorti (po biljci)
                        </CardTitle>
                        <FeedbackModal topic="www/pricing/plants" />
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-2 pr-4">
                                            Biljka ili sorta
                                        </th>
                                        <th className="text-right py-2">
                                            Cijena
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {plantsWithPrices.map((plant) => (
                                        <tr
                                            key={`plant-${plant.id}`}
                                            className="border-b last:border-b-0"
                                        >
                                            <td className="py-2 pr-4 align-middle">
                                                <div className="flex min-w-56 items-center gap-3">
                                                    <PlantOrSortImage
                                                        plant={plant}
                                                        alt={`Slika biljke ${plant.information.name}`}
                                                        width={40}
                                                        height={40}
                                                        className="size-10 rounded-md object-cover"
                                                    />
                                                    <span className="min-w-0">
                                                        <span className="block truncate font-medium">
                                                            {
                                                                plant
                                                                    .information
                                                                    .name
                                                            }
                                                        </span>
                                                        <span className="block text-xs text-muted-foreground">
                                                            Biljka
                                                        </span>
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-2 text-right font-medium">
                                                {formatPrice(
                                                    plant.prices.perPlant,
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {plantSortsWithPrices.map((sort) => (
                                        <tr
                                            key={`plant-sort-${sort.id}`}
                                            className="border-b last:border-b-0"
                                        >
                                            <td className="py-2 pr-4 align-middle">
                                                <div className="flex min-w-56 items-center gap-3">
                                                    <PlantOrSortImage
                                                        plantSort={sort}
                                                        alt={`Slika sorte ${sort.information.name}`}
                                                        width={40}
                                                        height={40}
                                                        className="size-10 rounded-md object-cover"
                                                    />
                                                    <span className="min-w-0">
                                                        <span className="block truncate font-medium">
                                                            {
                                                                sort.information
                                                                    .name
                                                            }
                                                        </span>
                                                        <span className="block truncate text-xs text-muted-foreground">
                                                            Sorta -{' '}
                                                            {getPlantSortParentName(
                                                                sort,
                                                            )}
                                                        </span>
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-2 text-right font-medium">
                                                {formatPrice(
                                                    sort.prices.perPlant,
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Typography level="body2" secondary className="mt-3">
                            Za biljke i sorte vrijedi{' '}
                            <Link
                                className="underline"
                                href={KnownPages.Refunds}
                            >
                                30-dnevna politika povrata novca
                            </Link>
                            .
                        </Typography>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle>Cijene radnji (po radnji)</CardTitle>
                        <FeedbackModal topic="www/pricing/operations" />
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-2 pr-4">
                                            Radnja
                                        </th>
                                        <th className="text-right py-2">
                                            Cijena
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {operationsWithPrices.map((operation) => (
                                        <tr
                                            key={operation.id}
                                            className="border-b last:border-b-0"
                                        >
                                            <td className="py-2 pr-4 align-middle">
                                                <div className="flex min-w-56 items-center gap-3">
                                                    <OperationImage
                                                        operation={operation}
                                                        size={40}
                                                        className="rounded-md bg-muted text-muted-foreground"
                                                    />
                                                    <span className="block min-w-0 truncate font-medium">
                                                        {
                                                            operation
                                                                .information
                                                                .label
                                                        }
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-2 text-right font-medium">
                                                {formatPrice(
                                                    operation.prices
                                                        .perOperation,
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Typography level="body2" secondary className="mt-3">
                            Za radnje vrijedi{' '}
                            <Link
                                className="underline"
                                href={KnownPages.Refunds}
                            >
                                30-dnevna politika povrata novca
                            </Link>
                            .
                        </Typography>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle>Cijene dostave</CardTitle>
                        <FeedbackModal topic="www/pricing/delivery" />
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-2 pr-4">
                                            Lokacija
                                        </th>
                                        <th className="text-right py-2 pr-4">
                                            Besplatna zona
                                        </th>
                                        <th className="text-right py-2 pr-4">
                                            Maks. zona
                                        </th>
                                        <th className="text-right py-2">
                                            Cijena po km
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedHqLocations.map((location) => (
                                        <tr
                                            key={location.id}
                                            className="border-b last:border-b-0"
                                        >
                                            <td className="py-2 pr-4">
                                                {location.information.label}
                                            </td>
                                            <td className="py-2 text-right pr-4">
                                                {location.delivery.freeRadius}{' '}
                                                km
                                            </td>
                                            <td className="py-2 text-right pr-4">
                                                {location.delivery.zoneRadius}{' '}
                                                km
                                            </td>
                                            <td className="py-2 text-right font-medium">
                                                {formatPrice(
                                                    location.prices
                                                        .pricePerKilometer,
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Podijeli povratnu informaciju</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between gap-4">
                        <Typography level="body2" secondary>
                            Nedostaje li cijena ili želiš predložiti poboljšanje
                            cjenika?
                        </Typography>
                        <FeedbackModal topic="www/pricing" />
                    </CardContent>
                </Card>
            </Stack>
        </Container>
    );
}
