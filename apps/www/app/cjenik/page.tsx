import { minimumShoppingCartAmountEur } from '@gredice/js/shoppingCart';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { Container } from '@gredice/ui/Container';
import {
    Hammer,
    Navigate,
    Sprout,
    Sun,
    Truck,
    Warning,
} from '@gredice/ui/icons';
import { OperationImage } from '@gredice/ui/OperationImage';
import { PageHeader } from '@gredice/ui/PageHeader';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { FeedbackModal } from '../../components/shared/feedback/FeedbackModal';
import { formatPrice } from '../../lib/formatPrice';
import { getHqLocationsData } from '../../lib/getHqLocationsData';
import { getOperationsData } from '../../lib/plants/getOperationsData';
import { getPlantSortsData } from '../../lib/plants/getPlantSortsData';
import { getPlantsData } from '../../lib/plants/getPlantsData';
import { getPublicSunflowerPackages } from '../../lib/sunflowerPackages';
import { KnownPages } from '../../src/KnownPages';
import {
    type PricingCatalogItem,
    PricingCatalogList,
} from './PricingCatalogList';
import { getPricingCatalogHistory, pricingHistoryKey } from './pricingHistory';
import {
    buildDeliveryPricingRows,
    buildOperationPricingRows,
    buildPlantPricingRows,
} from './pricingRows';
import { ThirtyDayMinimumPrice } from './ThirtyDayMinimumPrice';

export const metadata: Metadata = {
    title: 'Cjenik',
    description:
        'Pregled cijena i dostupnosti paketa suncokreta, biljaka, sorti, radnji i dostave.',
};

const sunflowerFormatter = new Intl.NumberFormat('hr-HR', {
    maximumFractionDigits: 0,
});

function itemCountLabel(count: number) {
    return count === 1 ? '1 stavka' : `${count} stavki`;
}

function CatalogSectionHeader({
    count,
    description,
    headingId,
    icon,
    title,
}: {
    count: number;
    description: string;
    headingId: string;
    icon: ReactNode;
    title: string;
}) {
    return (
        <CardHeader className="flex-row items-start justify-between gap-4 p-4 pb-2">
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
            <Chip color="neutral" size="sm" variant="soft">
                {itemCountLabel(count)}
            </Chip>
        </CardHeader>
    );
}

function CatalogColumnHeader({ itemLabel }: { itemLabel: string }) {
    return (
        <div
            aria-hidden="true"
            className="hidden grid-cols-[minmax(0,1fr)_20rem_1.25rem] gap-3 border-b bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground md:grid"
        >
            <span>{itemLabel}</span>
            <span className="grid grid-cols-2 gap-6 text-right">
                <span>Cijena</span>
                <span>Najniža u 30 dana</span>
            </span>
            <span />
        </div>
    );
}

function CatalogRow({
    badge,
    currentValue,
    href,
    minimumValue,
    subtitle,
    title,
    visual,
}: {
    badge?: ReactNode;
    currentValue: ReactNode;
    href: Route;
    minimumValue?: ReactNode;
    subtitle: string;
    title: string;
    visual: ReactNode;
}) {
    return (
        <Link
            className="group grid grid-cols-[minmax(0,1fr)_minmax(7rem,auto)] items-center gap-3 bg-card p-3 transition-colors hover:bg-primary/5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:grid-cols-[minmax(0,1fr)_20rem_1.25rem]"
            href={href}
        >
            <span className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
                    {visual}
                </span>
                <span className="min-w-0">
                    <span className="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
                        <span className="line-clamp-2 min-w-0 font-medium group-hover:underline group-hover:underline-offset-2 md:truncate">
                            {title}
                        </span>
                        {badge}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                        {subtitle}
                    </span>
                </span>
            </span>
            <span className="grid min-w-0 gap-1 text-right md:grid-cols-2 md:items-center md:gap-6">
                <span className="font-medium tabular-nums">{currentValue}</span>
                {minimumValue ? (
                    <span>
                        <span className="block text-[11px] font-normal text-muted-foreground md:hidden">
                            Najniža u 30 dana
                        </span>
                        {minimumValue}
                    </span>
                ) : (
                    <span className="hidden text-muted-foreground md:block">
                        —
                    </span>
                )}
            </span>
            <Navigate className="hidden size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground md:block" />
        </Link>
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
                    minimumValue={
                        isAvailable ? (
                            <ThirtyDayMinimumPrice
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
                        minimumValue={
                            isAvailable ? (
                                <ThirtyDayMinimumPrice
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
                <PageHeader
                    header="💶 Cjenik"
                    subHeader="Jasan pregled cijena i dostupnosti paketa suncokreta, biljaka, sorti, radnji i dostave."
                    headerChildren={
                        <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                                <Chip color="warning" size="sm" variant="soft">
                                    Interna radnja
                                </Chip>
                                <Chip
                                    color="neutral"
                                    size="sm"
                                    variant="outlined"
                                >
                                    Nije dostupno
                                </Chip>
                            </div>
                            <Typography level="body3" secondary>
                                Minimalna vrijednost narudžbe iznosi{' '}
                                {formatPrice(minimumShoppingCartAmountEur)}.
                            </Typography>
                            <Typography level="body3" secondary>
                                Interne radnje namijenjene su OPG partnerima i
                                ne naplaćuju se. Cijena 0 € za biljku, sortu ili
                                javnu radnju znači da trenutačno nije dostupna.
                            </Typography>
                        </div>
                    }
                />

                <nav
                    aria-label="Dijelovi cjenika"
                    className="sticky top-16 z-20 -mx-2 flex gap-2 overflow-x-auto rounded-lg border bg-background/95 p-2 shadow-xs backdrop-blur-sm"
                >
                    <Chip color="neutral" href="#suncokreti" variant="soft">
                        Suncokreti
                    </Chip>
                    <Chip color="neutral" href="#biljke-i-sorte" variant="soft">
                        Biljke i sorte
                    </Chip>
                    <Chip color="neutral" href="#radnje" variant="soft">
                        Radnje
                    </Chip>
                    <Chip color="neutral" href="#dostava" variant="soft">
                        Dostava
                    </Chip>
                </nav>

                <Card className="scroll-mt-28" id="suncokreti">
                    <CatalogSectionHeader
                        count={sunflowerPackages.length}
                        description="Prepaid Gredice bodovi za radnje u vrtu. Orijentacijski odnos je 1 EUR ≈ 1.000 suncokreta."
                        headingId="suncokreti-naslov"
                        icon={<Sun />}
                        title="Paketi suncokreta"
                    />
                    <CardContent className="p-4 pt-2">
                        {sunflowerPackages.length > 0 ? (
                            <div className="overflow-hidden rounded-lg border">
                                <CatalogColumnHeader itemLabel="Paket" />
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
                                            minimumValue={
                                                <ThirtyDayMinimumPrice
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
                        count={plantPricingRows.length}
                        description="Cijena po posađenoj biljci, uz zasebne cijene sorti kada su definirane."
                        headingId="biljke-i-sorte-naslov"
                        icon={<Sprout />}
                        title="Biljke i sorte"
                    />
                    <CardContent className="p-4 pt-2">
                        <PricingCatalogList
                            columnHeader={
                                <CatalogColumnHeader itemLabel="Biljka ili sorta" />
                            }
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
                        count={operationPricingRows.length}
                        description="Cijene po radnji, uključujući jasno označene interne i trenutačno nedostupne radnje."
                        headingId="radnje-naslov"
                        icon={<Hammer />}
                        title="Radnje"
                    />
                    <CardContent className="p-4 pt-2">
                        <PricingCatalogList
                            columnHeader={
                                <CatalogColumnHeader itemLabel="Radnja" />
                            }
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
                        count={deliveryPricingRows.length}
                        description="Za svaku lokaciju prikazane su besplatna zona, maksimalna zona i cijena po kilometru."
                        headingId="dostava-naslov"
                        icon={<Truck />}
                        title="Dostava"
                    />
                    <CardContent className="p-4 pt-2">
                        <div className="overflow-hidden rounded-lg border">
                            <CatalogColumnHeader itemLabel="Lokacija" />
                            {deliveryPricingRows.map((row) => (
                                <div
                                    className="border-b last:border-b-0"
                                    key={row.id}
                                >
                                    <CatalogRow
                                        currentValue={`${formatPrice(row.pricePerKilometer)} / km`}
                                        href={row.href}
                                        minimumValue={
                                            <ThirtyDayMinimumPrice
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
                    <CardContent
                        className="flex flex-col items-start justify-between gap-4 p-4 sm:flex-row sm:items-center"
                        noHeader
                    >
                        <div>
                            <Typography level="h5" component="h2">
                                Podijeli povratnu informaciju
                            </Typography>
                            <Typography
                                level="body2"
                                secondary
                                className="mt-1"
                            >
                                Nedostaje li cijena ili želiš predložiti
                                poboljšanje cjenika?
                            </Typography>
                        </div>
                        <FeedbackModal topic="www/pricing" />
                    </CardContent>
                </Card>
            </Stack>
        </Container>
    );
}
