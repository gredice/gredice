import { NavigatingButton } from '@signalco/ui/NavigatingButton';
import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { Container } from '@signalco/ui-primitives/Container';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Razvojni centar',
    description:
        'Središnje mjesto za razvojne alate, dijagnostiku, profiliranje, API i timsku suradnju Gredice timova.',
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

    return {
        app: `https://app.${domain}`,
        api: `https://api.${domain}`,
        farm: `https://farma.${domain}`,
        garden: `https://vrt.${domain}`,
        status: `https://status.${domain}`,
        storybook: `https://storybook.${domain}`,
        www: `https://www.${domain}`,
    };
}

function getDevelopmentSections(hosts: EnvironmentHosts): DevelopmentSection[] {
    return [
        {
            title: 'Dijagnostika i performanse',
            description:
                'Brzi pristup vrtnim alatima za pregled entiteta i provjeru performansi renderiranja.',
            resources: [
                {
                    title: 'Dijagnostika vrtnih entiteta',
                    description:
                        'Mrežni prikaz za pregled vrtnih entiteta, blokova i prikazanih stanja.',
                    href: `${hosts.garden}/debug/entities`,
                    icon: '🐞',
                },
                {
                    title: 'Performanse prikaza biljaka',
                    description:
                        'Gusti prikaz biljnih predložaka za uočavanje uskih grla u renderiranju i regresija performansi.',
                    href: `${hosts.garden}/debug/plants`,
                    icon: '📈',
                },
            ],
        },
        {
            title: 'Produktna sučelja',
            description:
                'Otvori glavna produktna okruženja koja se koriste tijekom razvoja i provjere kvalitete.',
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
                        'Glavna aplikacija za korisničke tokove i radnje upravljanja vrtom.',
                    href: hosts.garden,
                    icon: '🌱',
                },
                {
                    title: 'Farma',
                    description:
                        'Operativno sučelje za partnere i radne tokove na strani farme.',
                    href: hosts.farm,
                    icon: '🚜',
                },
                {
                    title: 'Aplikacija',
                    description:
                        'Interno aplikacijsko sučelje za autentificirane i dijeljene produktne značajke.',
                    href: hosts.app,
                    icon: '🧩',
                },
            ],
        },
        {
            title: 'Platforma i API',
            description:
                'Pozadinski sustav i platformske krajnje točke za rješavanje integracija i incidenata.',
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
                'Dijeljeni alati za razvoj komponenti, produktnu analitiku i timsku suradnju.',
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
                        'Produktna analitika i uvidi u zastavice značajki na cijeloj platformi.',
                    href: 'https://eu.posthog.com',
                    icon: '📊',
                },
                {
                    title: 'GitHub',
                    description:
                        'Kontrola izvornog koda, pregledi promjena, praćenje zadataka i CI pregled.',
                    href: 'https://github.com/gredice',
                    icon: '🐙',
                },
            ],
        },
    ];
}

export default function DevelopmentPage() {
    const hosts = getEnvironmentHosts();
    const developmentSections = getDevelopmentSections(hosts);

    return (
        <Container className="py-10">
            <Stack spacing={3} className="mb-8">
                <Typography level="h2" component="h1">
                    Razvojni centar
                </Typography>
                <Typography level="body1" secondary>
                    Svi dijagnostički, razvojni i platformski resursi na jednom
                    mjestu.
                </Typography>
            </Stack>

            <Stack spacing={8}>
                {developmentSections.map((section) => (
                    <section key={section.title}>
                        <Stack spacing={2} className="mb-4">
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
                                            spacing={2}
                                            className="h-full justify-between"
                                        >
                                            <Stack spacing={2}>
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
