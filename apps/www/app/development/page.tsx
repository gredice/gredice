import { Card, CardContent } from '@gredice/ui/Card';
import { Container } from '@gredice/ui/Container';
import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import {
    type DeploymentDayStats,
    type DeploymentStatsSnapshot,
    getLiveDeploymentStats,
    may2026DeploymentStats,
} from './deploymentStats';

export const revalidate = 300;

export const metadata: Metadata = {
    title: 'Razvojni centar',
    description:
        'Središnje mjesto za razvojne alate, dijagnostiku, API i timsku suradnju u Gredicama.',
};

type DevelopmentResource = {
    title: string;
    description: string;
    href: string;
    icon: string;
};

type DevelopmentSection = {
    title: string;
    description: string;
    resources: DevelopmentResource[];
};

type EnvironmentHosts = {
    app: string;
    api: string;
    farm: string;
    garden: string;
    status: string;
    storybook: string;
    www: string;
};

function getEnvironmentHosts(): EnvironmentHosts {
    const domain =
        process.env.NEXT_PUBLIC_VERCEL_ENV === 'production'
            ? 'gredice.com'
            : 'gredice.test';
    const storybookDomain =
        process.env.NEXT_PUBLIC_VERCEL_ENV === 'production'
            ? 'dev.gredice.com'
            : 'dev.gredice.test';

    return {
        app: `https://app.${domain}`,
        api: `https://api.${domain}`,
        farm: `https://farma.${domain}`,
        garden: `https://vrt.${domain}`,
        status: `https://status.${domain}`,
        storybook: `https://storybook.${storybookDomain}`,
        www: `https://www.${domain}`,
    };
}

function getDevelopmentSections(hosts: EnvironmentHosts): DevelopmentSection[] {
    return [
        {
            title: 'Dijagnostika i učinkovitost',
            description:
                'Brzi pristup vrtnim alatima za pregled elemenata i provjeru učinkovitosti iscrtavanja.',
            resources: [
                {
                    title: 'Dijagnostika vrtnih elemenata',
                    description:
                        'Mrežni prikaz za pregled vrtnih elemenata, blokova i prikazanih stanja.',
                    href: `${hosts.garden}/debug/entities`,
                    icon: '🐞',
                },
                {
                    title: 'Učinkovitost prikaza biljaka',
                    description:
                        'Gusti prikaz biljnih predložaka za uočavanje zastoja pri iscrtavanju i pada učinkovitosti.',
                    href: `${hosts.garden}/debug/plants`,
                    icon: '📈',
                },
            ],
        },
        {
            title: 'Sučelja proizvoda',
            description:
                'Otvori glavna sučelja Gredica koja se koriste tijekom razvoja i provjere kvalitete.',
            resources: [
                {
                    title: 'WWW',
                    description:
                        'Marketinška web-stranica za odredišne, SEO i javne stranice.',
                    href: hosts.www,
                    icon: '🌐',
                },
                {
                    title: 'Vrt',
                    description:
                        'Glavna aplikacija za korisničke tijekove i radnje upravljanja vrtom.',
                    href: hosts.garden,
                    icon: '🌱',
                },
                {
                    title: 'Farma',
                    description:
                        'Operativno sučelje za partnere i radne tijekove farme.',
                    href: hosts.farm,
                    icon: '🚜',
                },
                {
                    title: 'Aplikacija',
                    description:
                        'Interno aplikacijsko sučelje za prijavu i dijeljene značajke proizvoda.',
                    href: hosts.app,
                    icon: '🧩',
                },
            ],
        },
        {
            title: 'Platforma i API',
            description:
                'Pozadinski sustav i platformne krajnje točke za rješavanje integracija i incidenata.',
            resources: [
                {
                    title: 'API',
                    description:
                        'Primarna API ulazna točka za zahtjeve, integracije i provjere stanja sustava.',
                    href: hosts.api,
                    icon: '🔌',
                },
                {
                    title: 'Status',
                    description:
                        'Stranica operativnog statusa za incidente, dostupnost i najave održavanja.',
                    href: hosts.status,
                    icon: '🟢',
                },
            ],
        },
        {
            title: 'Dizajn, analitika i suradnja',
            description:
                'Dijeljeni alati za razvoj komponenti, analitiku proizvoda i timsku suradnju.',
            resources: [
                {
                    title: 'Storybook',
                    description:
                        'Preglednik komponenti za razvoj korisničkog sučelja i vizualnu dokumentaciju.',
                    href: hosts.storybook,
                    icon: '📚',
                },
                {
                    title: 'PostHog',
                    description:
                        'Analitika proizvoda i uvidi u oznake značajki na cijeloj platformi.',
                    href: 'https://eu.posthog.com',
                    icon: '📊',
                },
                {
                    title: 'GitHub',
                    description:
                        'Kontrola izvornog koda, pregledi promjena, praćenje zadataka i CI provjere.',
                    href: 'https://github.com/gredice',
                    icon: '🐙',
                },
            ],
        },
    ];
}

const numberFormatter = new Intl.NumberFormat('hr-HR');
const decimalFormatter = new Intl.NumberFormat('hr-HR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
});
const updatedAtFormatter = new Intl.DateTimeFormat('hr-HR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Zagreb',
});

function formatNumber(value: number) {
    return numberFormatter.format(value);
}

function formatAverage(value: number) {
    return decimalFormatter.format(value);
}

function formatUpdatedAt(value: string | null) {
    if (!value) {
        return 'Zaključeno razdoblje';
    }

    return `Osvježeno ${updatedAtFormatter.format(new Date(value))}`;
}

function shortDayLabel(date: string) {
    return date.slice(8);
}

function chartTitle(row: DeploymentDayStats) {
    return `${row.date}: ${formatNumber(row.production)} produkcijskih deploymenta, ${formatNumber(row.all)} ukupnih buildova`;
}

function shouldShowDayLabel(index: number, dayCount: number) {
    return index === 0 || index === dayCount - 1 || (index + 1) % 5 === 0;
}

function DeploymentStatsSection({
    liveDeploymentStats,
}: {
    liveDeploymentStats: DeploymentStatsSnapshot;
}) {
    return (
        <section>
            <Stack spacing={4} className="mb-4">
                <Typography level="h4" component="h2">
                    Vercel deployment statistika
                </Typography>
                <Typography level="body2" secondary>
                    Pregled produkcijskih deploymenta po danu i ukupnog broja
                    buildova, uključujući preview deploymente.
                </Typography>
            </Stack>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <DeploymentStatsCard snapshot={may2026DeploymentStats} />
                <DeploymentStatsCard snapshot={liveDeploymentStats} />
            </div>
        </section>
    );
}

function DeploymentStatsCard({
    snapshot,
}: {
    snapshot: DeploymentStatsSnapshot;
}) {
    if (snapshot.status === 'unavailable') {
        return (
            <Card className="h-full border-dashed">
                <CardContent noHeader>
                    <Stack spacing={4}>
                        <Stack spacing={1}>
                            <Typography level="h5" component="h3">
                                {snapshot.title}
                            </Typography>
                            <Typography level="body3" tertiary>
                                {snapshot.description}
                            </Typography>
                        </Stack>
                        <div className="rounded-md border bg-muted/30 p-4">
                            <Typography level="body2" secondary>
                                {snapshot.reason}
                            </Typography>
                        </div>
                    </Stack>
                </CardContent>
            </Card>
        );
    }

    const maxProduction = snapshot.dayRows.reduce(
        (max, row) => Math.max(max, row.production),
        0,
    );
    const busiestDay = snapshot.dayRows.reduce(
        (busiest, row) => (row.production > busiest.production ? row : busiest),
        snapshot.dayRows[0],
    );
    const metrics = [
        {
            label: 'Svi buildovi',
            value: formatNumber(snapshot.totals.all),
        },
        {
            label: 'Produkcija',
            value: formatNumber(snapshot.totals.production),
        },
        {
            label: 'Preview',
            value: formatNumber(snapshot.totals.preview),
        },
        {
            label: 'Prosjek / dan',
            value: formatAverage(snapshot.totals.productionAverage),
        },
        {
            label: 'Ready prod',
            value: formatNumber(snapshot.totals.readyProduction),
        },
    ];

    return (
        <Card className="h-full">
            <CardContent noHeader>
                <Stack spacing={5}>
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <Stack spacing={1}>
                            <Typography level="h5" component="h3">
                                {snapshot.title}
                            </Typography>
                            <Typography level="body3" tertiary>
                                {snapshot.description}
                            </Typography>
                        </Stack>
                        <Typography
                            level="body3"
                            tertiary
                            className="md:text-right"
                        >
                            {formatUpdatedAt(snapshot.updatedAt)}
                        </Typography>
                    </div>

                    <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                        {metrics.map((metric) => (
                            <div
                                className="min-w-0 rounded-md border bg-muted/30 p-3"
                                key={metric.label}
                            >
                                <Typography
                                    level="body3"
                                    tertiary
                                    className="truncate"
                                >
                                    {metric.label}
                                </Typography>
                                <Typography
                                    level="h5"
                                    component="p"
                                    className="mt-1"
                                >
                                    {metric.value}
                                </Typography>
                            </div>
                        ))}
                    </div>

                    <Stack spacing={2}>
                        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                            <Typography level="body2" semiBold>
                                Produkcijski deploymenti po danu
                            </Typography>
                            <Typography level="body3" tertiary>
                                Najviše: {busiestDay.date} ·{' '}
                                {formatNumber(busiestDay.production)} prod /{' '}
                                {formatNumber(busiestDay.all)} ukupno
                            </Typography>
                        </div>
                        <DeploymentBars
                            dayRows={snapshot.dayRows}
                            maxProduction={maxProduction}
                        />
                        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                            <Typography level="body3" tertiary>
                                Ukupno uključuje produkcijske, preview i
                                neuspjele build zapise.
                            </Typography>
                            <Typography level="body3" tertiary>
                                Error:{' '}
                                {formatNumber(
                                    snapshot.totals.erroredProduction,
                                )}
                                , canceled:{' '}
                                {formatNumber(
                                    snapshot.totals.canceledProduction,
                                )}
                            </Typography>
                        </div>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}

function DeploymentBars({
    dayRows,
    maxProduction,
}: {
    dayRows: DeploymentDayStats[];
    maxProduction: number;
}) {
    return (
        <div className="rounded-md border bg-muted/20 px-3 pb-3 pt-4">
            <div className="flex h-28 items-end gap-1">
                {dayRows.map((row, index) => {
                    const percentage =
                        maxProduction > 0
                            ? (row.production / maxProduction) * 100
                            : 0;
                    const height =
                        row.production > 0
                            ? `${Math.max(8, percentage).toFixed(2)}%`
                            : '2px';
                    return (
                        <div
                            className="flex min-w-0 flex-1 flex-col items-center gap-2"
                            key={row.date}
                        >
                            <div className="flex h-24 w-full items-end rounded-sm bg-background/80 px-px">
                                <div
                                    className="w-full rounded-t-sm bg-primary"
                                    style={{ height }}
                                    title={chartTitle(row)}
                                />
                            </div>
                            {shouldShowDayLabel(index, dayRows.length) ? (
                                <span className="text-[10px] leading-none text-tertiary-foreground">
                                    {shortDayLabel(row.date)}
                                </span>
                            ) : (
                                <span className="h-2" aria-hidden />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default async function DevelopmentPage() {
    const hosts = getEnvironmentHosts();
    const developmentSections = getDevelopmentSections(hosts);
    const liveDeploymentStats = await getLiveDeploymentStats();

    return (
        <Container className="py-10">
            <Stack spacing={6} className="mb-8">
                <Typography level="h2" component="h1">
                    Razvojni centar
                </Typography>
                <Typography level="body1" secondary>
                    Svi dijagnostički, razvojni i platformni resursi na jednom
                    mjestu.
                </Typography>
            </Stack>

            <Stack spacing={16}>
                <DeploymentStatsSection
                    liveDeploymentStats={liveDeploymentStats}
                />

                {developmentSections.map((section) => (
                    <section key={section.title}>
                        <Stack spacing={4} className="mb-4">
                            <Typography level="h4" component="h2">
                                {section.title}
                            </Typography>
                            <Typography level="body2" secondary>
                                {section.description}
                            </Typography>
                        </Stack>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {section.resources.map((resource) => (
                                <Card
                                    key={resource.title}
                                    className="border-tertiary border-b-4 h-full"
                                >
                                    <CardContent noHeader>
                                        <Stack
                                            spacing={4}
                                            className="h-full justify-between"
                                        >
                                            <Stack spacing={4}>
                                                <span
                                                    className="text-3xl"
                                                    role="img"
                                                    aria-label={`${resource.title} ikona`}
                                                >
                                                    {resource.icon}
                                                </span>
                                                <Typography
                                                    level="h5"
                                                    component="h3"
                                                >
                                                    {resource.title}
                                                </Typography>
                                                <Typography
                                                    level="body2"
                                                    secondary
                                                >
                                                    {resource.description}
                                                </Typography>
                                            </Stack>
                                            <NavigatingButton
                                                href={resource.href}
                                                className="w-fit"
                                            >
                                                Otvori resurs
                                            </NavigatingButton>
                                        </Stack>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </section>
                ))}
            </Stack>
        </Container>
    );
}
