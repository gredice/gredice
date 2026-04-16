import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Container } from '@signalco/ui-primitives/Container';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { Metadata } from 'next';
import { FeedbackModal } from '../../components/shared/feedback/FeedbackModal';
import { PageHeader } from '../../components/shared/PageHeader';
import { getHqLocationsData } from '../../lib/getHqLocationsData';
import { getOperationsData } from '../../lib/plants/getOperationsData';
import { getPlantsData } from '../../lib/plants/getPlantsData';

export const metadata: Metadata = {
    title: 'Cjenik',
    description:
        'Pregled svih cijena: biljke, radnje i dostava na jednom mjestu.',
};

function formatPrice(price: number): string {
    return `${price.toFixed(2).replace('.', ',')} €`;
}

export default async function PricingPage() {
    const [plantsData, operationsData, hqLocations] = await Promise.all([
        getPlantsData(),
        getOperationsData(),
        getHqLocationsData(),
    ]);

    const plantsWithPrices = plantsData
        .filter((plant) => typeof plant.prices?.perPlant === 'number')
        .sort((a, b) =>
            a.information.name.localeCompare(b.information.name, 'hr-HR'),
        );

    const operationsWithPrices = operationsData
        .filter(
            (operation) => typeof operation.prices?.perOperation === 'number',
        )
        .sort((a, b) =>
            a.information.label.localeCompare(b.information.label, 'hr-HR'),
        );

    const sortedHqLocations = hqLocations.sort((a, b) =>
        a.information.label.localeCompare(b.information.label, 'hr-HR'),
    );

    return (
        <Container maxWidth="lg">
            <Stack spacing={2}>
                <PageHeader
                    padded
                    header="💶 Cjenik"
                    subHeader="Sve cijene na jednom mjestu: biljke, radnje i dostava"
                />

                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle>Cijene biljaka (po biljci)</CardTitle>
                        <FeedbackModal topic="www/pricing/plants" />
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-2 pr-4">
                                            Biljka
                                        </th>
                                        <th className="text-right py-2">
                                            Cijena
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {plantsWithPrices.map((plant) => (
                                        <tr
                                            key={plant.id}
                                            className="border-b last:border-b-0"
                                        >
                                            <td className="py-2 pr-4">
                                                {plant.information.name}
                                            </td>
                                            <td className="py-2 text-right font-medium">
                                                {formatPrice(
                                                    plant.prices.perPlant,
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
                                            <td className="py-2 pr-4">
                                                {operation.information.label}
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
