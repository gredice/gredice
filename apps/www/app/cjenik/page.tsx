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
import { getPublicSunflowerPackages } from '../../lib/sunflowerPackages';
import { KnownPages } from '../../src/KnownPages';
import {
    buildDeliveryPricingRows,
    buildOperationPricingRows,
    buildPlantPricingRows,
} from './pricingRows';

export const metadata: Metadata = {
    title: 'Cjenik',
    description:
        'Pregled svih cijena: paketi suncokreta, biljke, radnje i dostava na jednom mjestu.',
};

const sunflowerFormatter = new Intl.NumberFormat('hr-HR', {
    maximumFractionDigits: 0,
});

export default async function PricingPage() {
    const [
        plantsData,
        plantSortsData,
        operationsData,
        hqLocations,
        sunflowerPackages,
    ] = await Promise.all([
        getPlantsData(),
        getPlantSortsData(),
        getOperationsData(),
        getHqLocationsData(),
        getPublicSunflowerPackages(),
    ]);

    const plantPricingRows = buildPlantPricingRows(plantsData, plantSortsData);
    const operationPricingRows = buildOperationPricingRows(operationsData);
    const deliveryPricingRows = buildDeliveryPricingRows(
        hqLocations,
        KnownPages.Delivery,
    );

    return (
        <Container maxWidth="lg">
            <Stack spacing={4}>
                <PageHeader
                    padded
                    header="💶 Cjenik"
                    subHeader="Sve cijene na jednom mjestu: paketi suncokreta, biljke, sorte, radnje i dostava"
                />

                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle>Paketi suncokreta</CardTitle>
                        <FeedbackModal topic="www/pricing/sunflowers" />
                    </CardHeader>
                    <CardContent>
                        <Stack spacing={3}>
                            <Typography level="body2" secondary>
                                Suncokreti su prepaid Gredice bodovi za vrtne
                                akcije. Kod korištenja salda vrijedi
                                orijentacijski odnos 1 EUR ≈ 1.000 suncokreta, a
                                bonus se dodaje kao dodatni broj suncokreta.
                            </Typography>
                            {sunflowerPackages.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="py-2 pr-4 text-left">
                                                    Paket
                                                </th>
                                                <th className="py-2 pr-4 text-right">
                                                    Suncokreti
                                                </th>
                                                <th className="py-2 pr-4 text-right">
                                                    Bonus
                                                </th>
                                                <th className="py-2 text-right">
                                                    Cijena
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sunflowerPackages.map((pkg) => (
                                                <tr
                                                    key={pkg.code}
                                                    className="border-b last:border-b-0"
                                                >
                                                    <td className="py-2 pr-4 align-middle">
                                                        <span className="block font-medium">
                                                            {pkg.name}
                                                        </span>
                                                        <span className="block text-xs text-muted-foreground">
                                                            {pkg.isOneTime
                                                                ? 'Jednokratna ponuda'
                                                                : pkg.role ===
                                                                    'upsell'
                                                                  ? 'Najveći paket'
                                                                  : (pkg.tag ??
                                                                    'Glavni paket')}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 pr-4 text-right font-medium tabular-nums">
                                                        {sunflowerFormatter.format(
                                                            pkg.sunflowers,
                                                        )}
                                                    </td>
                                                    <td className="py-2 pr-4 text-right tabular-nums">
                                                        {pkg.bonusSunflowers > 0
                                                            ? `+${sunflowerFormatter.format(pkg.bonusSunflowers)}`
                                                            : '-'}
                                                    </td>
                                                    <td className="py-2 text-right font-medium">
                                                        {formatPrice(
                                                            pkg.priceEur,
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <Typography level="body2" secondary>
                                    Paketi se trenutno ne mogu učitati. Aktualni
                                    saldo i kupnja dostupni su u vrtu.
                                </Typography>
                            )}
                            <Typography level="body2" secondary>
                                Detalje o korištenju salda pročitaj na stranici{' '}
                                <Link
                                    className="underline"
                                    href={KnownPages.Sunflowers}
                                >
                                    Suncokreti
                                </Link>
                                .
                            </Typography>
                        </Stack>
                    </CardContent>
                </Card>

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
                                    {plantPricingRows.map((row) => (
                                        <tr
                                            key={row.id}
                                            className="border-b last:border-b-0"
                                        >
                                            <td className="py-2 pr-4 align-middle">
                                                <div className="flex min-w-56 items-center gap-3">
                                                    {row.kind === 'plant' ? (
                                                        <PlantOrSortImage
                                                            plant={row.plant}
                                                            alt={`Slika biljke ${row.label}`}
                                                            width={40}
                                                            height={40}
                                                            className="size-10 rounded-md object-cover"
                                                        />
                                                    ) : (
                                                        <PlantOrSortImage
                                                            plantSort={
                                                                row.plantSort
                                                            }
                                                            alt={`Slika sorte ${row.label}`}
                                                            width={40}
                                                            height={40}
                                                            className="size-10 rounded-md object-cover"
                                                        />
                                                    )}
                                                    <span className="min-w-0">
                                                        <Link
                                                            className="block truncate font-medium underline underline-offset-2"
                                                            href={row.href}
                                                        >
                                                            {row.label}
                                                        </Link>
                                                        <span className="block truncate text-xs text-muted-foreground">
                                                            {row.kind ===
                                                            'plant'
                                                                ? 'Biljka'
                                                                : `Sorta - ${row.parentLabel}`}
                                                        </span>
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-2 text-right font-medium">
                                                {formatPrice(row.price)}
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
                                    {operationPricingRows.map((row) => (
                                        <tr
                                            key={row.id}
                                            className="border-b last:border-b-0"
                                        >
                                            <td className="py-2 pr-4 align-middle">
                                                <div className="flex min-w-56 items-center gap-3">
                                                    <OperationImage
                                                        operation={
                                                            row.operation
                                                        }
                                                        size={40}
                                                        className="rounded-md bg-muted text-muted-foreground"
                                                    />
                                                    <Link
                                                        className="block min-w-0 truncate font-medium underline underline-offset-2"
                                                        href={row.href}
                                                    >
                                                        {row.label}
                                                    </Link>
                                                </div>
                                            </td>
                                            <td className="py-2 text-right font-medium">
                                                {formatPrice(row.price)}
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
                                    {deliveryPricingRows.map((row) => (
                                        <tr
                                            key={row.id}
                                            className="border-b last:border-b-0"
                                        >
                                            <td className="py-2 pr-4">
                                                <Link
                                                    className="font-medium underline underline-offset-2"
                                                    href={row.href}
                                                >
                                                    {row.label}
                                                </Link>
                                            </td>
                                            <td className="py-2 text-right pr-4">
                                                {row.freeRadius} km
                                            </td>
                                            <td className="py-2 text-right pr-4">
                                                {row.zoneRadius} km
                                            </td>
                                            <td className="py-2 text-right font-medium">
                                                {formatPrice(
                                                    row.pricePerKilometer,
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
