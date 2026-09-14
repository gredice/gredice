import { minimumShoppingCartAmountEur } from '@gredice/js/shoppingCart';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { Container } from '@gredice/ui/Container';
import {
    ArrowDownToLine,
    Hammer,
    History,
    Navigate,
    Sprout,
    Sun,
    Truck,
    Warning,
} from '@gredice/ui/icons';
import { OperationImage } from '@gredice/ui/OperationImage';
import { PageHeader } from '@gredice/ui/PageHeader';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { FeedbackModal } from '../../components/shared/feedback/FeedbackModal';
import { formatPrice } from '../../lib/formatPrice';
import { getHqLocationsData } from '../../lib/getHqLocationsData';
import { getOperationsData } from '../../lib/plants/getOperationsData';
import { getPlantSortsData } from '../../lib/plants/getPlantSortsData';
import { getPlantsData } from '../../lib/plants/getPlantsData';
import { createPublicMetadata } from '../../lib/seo/publicMetadata';
import { getPublicSunflowerPackages } from '../../lib/sunflowerPackages';
import { KnownPages } from '../../src/KnownPages';
import { CatalogRow } from './CatalogRow';
import {
    type PricingCatalogItem,
    PricingCatalogList,
} from './PricingCatalogList';
import { PricingHistoryReference } from './PricingHistoryReference';
import { getPricingCatalogHistory, pricingHistoryKey } from './pricingHistory';
import {
    buildDeliveryPricingRows,
    buildOperationPricingRows,
    buildPlantPricingRows,
} from './pricingRows';

export const metadata = createPublicMetadata({
    title: 'Cjenik',
    description:
        'Pregled cijena i dostupnosti paketa suncokreta, biljaka, sorti, radnji i dostave.',
    path: KnownPages.Pricing,
    eyebrow: 'Ponuda Gredica',
});

const sunflowerFormatter = new Intl.NumberFormat('hr-HR', {
    maximumFractionDigits: 0,
});

function CatalogSectionHeader({
    description,
    headingId,
    icon,
    title,
}: {
    description: string;
    headingId: string;
    icon: ReactNode;
    title: string;
}) {
    return (
        <CardHeader className="p-4 pb-2">
            <div className="flex min-w-0 items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary [&>svg]:size-5">
                    {icon}
                </span>
                <div className="min-w-0">
                    <CardTitle className="text-xl" id={headingId}>
                        {title}
                    </CardTitle>
                    <Typography level="body2" secondary className="mt-1">
                        {description}
                    </Typography>
                </div>
            </div>
        </CardHeader>
    );
}

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
    const pricingHistory = await getPricingCatalogHistory({
        sunflowerPackages,
        plantRows: plantPricingRows,
        operationRows: operationPricingRows,
        deliveryRows: deliveryPricingRows,
    });

    const plantItems: PricingCatalogItem[] = plantPricingRows.map((row) => {
        const isAvailable = row.price > 0;
        return {
            id: row.id,
            filter: row.kind,
            searchText: `${row.label} ${row.kind === 'sort' ? row.parentLabel : 'biljka'}`,
            content: (
                <CatalogRow
                    badge={
                        isAvailable ? undefined : (
                            <Chip color="neutral" size="sm" variant="outlined">
                                Nije dostupno
                            </Chip>
                        )
                    }
                    currentValue={
                        isAvailable ? formatPrice(row.price) : 'Nije dostupno'
                    }
                    href={row.href}
                    historyValue={
                        isAvailable ? (
                            <PricingHistoryReference
                                currentPrice={row.price}
                                history={
                                    pricingHistory[
                                        pricingHistoryKey(
                                            row.kind === 'plant'
                                                ? 'plant'
                                                : 'plantSort',
                                            row.entityId,
                                        )
                                    ]
                                }
                            />
                        ) : undefined
                    }
                    subtitle={
                        row.kind === 'plant'
                            ? 'Biljka'
                            : `Sorta · ${row.parentLabel}`
                    }
                    title={row.label}
                    visual={
                        row.kind === 'plant' ? (
                            <PlantOrSortImage
                                alt={`Slika biljke ${row.label}`}
                                className="size-10 object-cover"
                                height={40}
                                plant={row.plant}
                                width={40}
                            />
                        ) : (
                            <PlantOrSortImage
                                alt={`Slika sorte ${row.label}`}
                                className="size-10 object-cover"
                                height={40}
                                plantSort={row.plantSort}
                                width={40}
                            />
                        )
                    }
                />
            ),
        };
    });

    const operationItems: PricingCatalogItem[] = operationPricingRows.map(
        (row) => {
            const isAvailable = row.availability === 'available';
            const isInternal = row.availability === 'internal';
            return {
                id: row.id,
                filter: row.availability,
                searchText: `${row.label} ${row.stageLabel} ${
                    isInternal
                        ? 'interna radnja bez naplate OPG partneri'
                        : isAvailable
                          ? 'dostupno'
                          : 'nije dostupno'
                }`,
                content: (
                    <CatalogRow
                        badge={
                            isInternal ? (
                                <Chip color="warning" size="sm" variant="soft">
                                    Interna radnja
                                </Chip>
                            ) : isAvailable ? undefined : (
                                <Chip
                                    color="neutral"
                                    size="sm"
                                    variant="outlined"
                                >
                                    Nije dostupno
                                </Chip>
                            )
                        }
                        currentValue={
                            isInternal
                                ? 'Bez naplate'
                                : isAvailable
                                  ? formatPrice(row.price)
                                  : 'Nije dostupno'
                        }
                        href={row.href}
                        historyValue={
                            isAvailable ? (
                                <PricingHistoryReference
                                    currentPrice={row.price}
                                    history={
                                        pricingHistory[
                                            pricingHistoryKey(
                                                'operation',
                                                row.entityId,
                                            )
                                        ]
                                    }
                                />
                            ) : undefined
                        }
                        subtitle={
                            isInternal
                                ? `${row.stageLabel} · Za OPG partnere`
                                : row.stageLabel
                        }
                        title={row.label}
                        visual={
                            <OperationImage
                                className="rounded-md bg-muted text-muted-foreground"
                                operation={row.operation}
                                size={40}
                            />
                        }
                    />
                ),
            };
        },
    );

    return (
        <Container className="pb-12" maxWidth="lg">
            <Stack spacing={6}>
                <Stack spacing={2}>
                    <PageHeader
                        header="💶 Cjenik"
                        padded
                        subHeader="Jasan pregled cijena i dostupnosti paketa suncokreta, biljaka, sorti, radnji i dostave."
                    />
                    <Typography level="body2" secondary>
                        Minimalna vrijednost narudžbe iznosi{' '}
                        {formatPrice(minimumShoppingCartAmountEur)}.
                    </Typography>
                </Stack>

                <Card className="scroll-mt-28" id="suncokreti">
                    <CatalogSectionHeader
                        description="Prepaid Gredice bodovi za radnje u vrtu. Orijentacijski odnos je 1 EUR ≈ 1.000 suncokreta."
                        headingId="suncokreti-naslov"
                        icon={<Sun />}
                        title="Paketi suncokreta"
                    />
                    <CardContent className="p-4 pt-2">
                        {sunflowerPackages.length > 0 ? (
                            <div className="overflow-hidden rounded-lg border">
                                {sunflowerPackages.map((pkg) => (
                                    <div
                                        className="border-b last:border-b-0"
                                        key={pkg.code}
                                    >
                                        <CatalogRow
                                            currentValue={formatPrice(
                                                pkg.priceEur,
                                            )}
                                            href={KnownPages.Sunflowers}
                                            historyValue={
                                                <PricingHistoryReference
                                                    currentPrice={pkg.priceEur}
                                                    history={
                                                        pricingHistory[
                                                            pricingHistoryKey(
                                                                'sunflowerPackage',
                                                                pkg.entityId,
                                                            )
                                                        ]
                                                    }
                                                />
                                            }
                                            subtitle={`${sunflowerFormatter.format(pkg.sunflowers)} suncokreta${
                                                pkg.bonusSunflowers > 0
                                                    ? ` + ${sunflowerFormatter.format(pkg.bonusSunflowers)} bonus`
                                                    : ''
                                            } · ${
                                                pkg.isOneTime
                                                    ? 'Jednokratna ponuda'
                                                    : (pkg.tag ??
                                                      'Paket suncokreta')
                                            }`}
                                            title={pkg.name}
                                            visual={
                                                <Sun className="size-5 text-primary" />
                                            }
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <Alert color="neutral" startDecorator={<Warning />}>
                                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <span>
                                        Paketi se trenutačno ne mogu učitati.
                                        Aktualni saldo i kupnja dostupni su u
                                        vrtu.
                                    </span>
                                    <Button
                                        className="shrink-0"
                                        href={KnownPages.GardenApp}
                                        size="sm"
                                        variant="outlined"
                                    >
                                        Moj vrt
                                    </Button>
                                </div>
                            </Alert>
                        )}
                        <Typography level="body2" secondary className="mt-3">
                            Detalje o saldu, bonusima i korištenju pročitaj na
                            stranici{' '}
                            <Link
                                className="underline underline-offset-2"
                                href={KnownPages.Sunflowers}
                            >
                                Suncokreti
                            </Link>
                            .
                        </Typography>
                    </CardContent>
                </Card>

                <Card className="scroll-mt-28" id="biljke-i-sorte">
                    <CatalogSectionHeader
                        description="Cijena po posađenoj biljci, uz zasebne cijene sorti kada su definirane."
                        headingId="biljke-i-sorte-naslov"
                        icon={<Sprout />}
                        title="Biljke i sorte"
                    />
                    <CardContent className="p-4 pt-2">
                        <PricingCatalogList
                            emptyMessage="Nema biljaka ili sorti koje odgovaraju pretrazi."
                            filters={[
                                { label: 'Sve', value: 'all' },
                                { label: 'Biljke', value: 'plant' },
                                { label: 'Sorte', value: 'sort' },
                            ]}
                            items={plantItems}
                            searchLabel="Pretraži biljke i sorte"
                        />
                        <Typography level="body2" secondary className="mt-3">
                            Za biljke i sorte vrijedi{' '}
                            <Link
                                className="underline underline-offset-2"
                                href={KnownPages.Refunds}
                            >
                                30-dnevna politika povrata novca
                            </Link>
                            .
                        </Typography>
                    </CardContent>
                </Card>

                <Card className="scroll-mt-28" id="radnje">
                    <CatalogSectionHeader
                        description="Cijene po radnji, uključujući jasno označene interne i trenutačno nedostupne radnje."
                        headingId="radnje-naslov"
                        icon={<Hammer />}
                        title="Radnje"
                    />
                    <CardContent className="p-4 pt-2">
                        <PricingCatalogList
                            emptyMessage="Nema radnji koje odgovaraju pretrazi."
                            filters={[
                                { label: 'Sve', value: 'all' },
                                { label: 'Dostupne', value: 'available' },
                                { label: 'Interne', value: 'internal' },
                                {
                                    label: 'Nije dostupno',
                                    value: 'unavailable',
                                },
                            ]}
                            items={operationItems}
                            searchLabel="Pretraži radnje"
                        />
                        <Typography level="body2" secondary className="mt-3">
                            Za dostupne radnje koje se naplaćuju vrijedi{' '}
                            <Link
                                className="underline underline-offset-2"
                                href={KnownPages.Refunds}
                            >
                                30-dnevna politika povrata novca
                            </Link>
                            .
                        </Typography>
                    </CardContent>
                </Card>

                <Card className="scroll-mt-28" id="dostava">
                    <CatalogSectionHeader
                        description="Za svaku lokaciju prikazane su besplatna zona, maksimalna zona i cijena po kilometru."
                        headingId="dostava-naslov"
                        icon={<Truck />}
                        title="Dostava"
                    />
                    <CardContent className="p-4 pt-2">
                        <div className="overflow-hidden rounded-lg border">
                            {deliveryPricingRows.map((row) => (
                                <div
                                    className="border-b last:border-b-0"
                                    key={row.id}
                                >
                                    <CatalogRow
                                        currentValue={`${formatPrice(row.pricePerKilometer)} / km`}
                                        href={row.href}
                                        historyValue={
                                            <PricingHistoryReference
                                                currentPrice={
                                                    row.pricePerKilometer
                                                }
                                                history={
                                                    pricingHistory[
                                                        pricingHistoryKey(
                                                            'hqLocations',
                                                            row.entityId,
                                                        )
                                                    ]
                                                }
                                            />
                                        }
                                        subtitle={`Prvih ${row.freeRadius} km bez naknade · dostupno do ${row.zoneRadius} km`}
                                        title={row.label}
                                        visual={
                                            <Truck className="size-5 text-primary" />
                                        }
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 flex justify-end">
                            <Button
                                endDecorator={<Navigate className="size-4" />}
                                href={KnownPages.Delivery}
                                variant="outlined"
                            >
                                Više o dostavi
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="p-4 pb-2">
                        <div className="flex items-start gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <ArrowDownToLine className="size-5" />
                            </span>
                            <div>
                                <CardTitle className="text-xl">
                                    Preuzmi cjenik
                                </CardTitle>
                                <Typography
                                    level="body2"
                                    secondary
                                    className="mt-1"
                                >
                                    Aktualni CSV cjenik i arhiva prethodno
                                    objavljenih verzija.
                                </Typography>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2 p-4 pt-2 sm:flex-row">
                        <Button
                            href="/cjenik/cjenik.csv"
                            startDecorator={
                                <ArrowDownToLine className="size-4" />
                            }
                        >
                            Preuzmi CSV cjenik
                        </Button>
                        <Button
                            color="neutral"
                            href="/cjenik/preuzimanje"
                            startDecorator={<History className="size-4" />}
                            variant="outlined"
                        >
                            Prethodne verzije
                        </Button>
                    </CardContent>
                </Card>

                <Row spacing={4} className="pt-4">
                    <Typography level="body1">
                        Jesu li ti informacije u cjeniku korisne?
                    </Typography>
                    <FeedbackModal topic="www/pricing" />
                </Row>
            </Stack>
        </Container>
    );
}
