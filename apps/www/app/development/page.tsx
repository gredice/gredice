import { Card, CardContent } from '@gredice/ui/Card';
import { Container } from '@gredice/ui/Container';
import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';

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
                        'Interno aplikacijsko sučelje za prijavljene korisnike i dijeljene značajke proizvoda.',
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

export default function DevelopmentPage() {
    const hosts = getEnvironmentHosts();
    const developmentSections = getDevelopmentSections(hosts);

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
