import { Card, CardContent } from '@gredice/ui/Card';
import { Container } from '@gredice/ui/Container';
import { CompanyGitHub } from '@gredice/ui/icons';
import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import { DeploymentStatsCard } from './DeploymentStatsCard';

export const revalidate = 300;

export const metadata: Metadata = {
    title: 'Razvojni centar',
    description:
        'Središnje mjesto za razvojne alate, dijagnostiku, API i timsku suradnju u Gredicama.',
};

type DevelopmentResourceIcon =
    | string
    | {
          type: 'github';
      }
    | {
          type: 'image';
          src: string;
      };

type DevelopmentResource = {
    title: string;
    description: string;
    href: string;
    icon: DevelopmentResourceIcon;
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
    farmDebug: string | null;
    garden: string;
    news: string;
    status: string;
    storybook: string;
    www: string;
};

function getEnvironmentHosts(): EnvironmentHosts {
    const vercelEnvironment = process.env.NEXT_PUBLIC_VERCEL_ENV;
    const isProduction = vercelEnvironment === 'production';
    const isLocalDevelopment =
        !vercelEnvironment || vercelEnvironment === 'development';
    const domain = isProduction ? 'gredice.com' : 'gredice.test';
    const storybookDomain = isProduction
        ? 'dev.gredice.com'
        : 'dev.gredice.test';

    return {
        app: `https://app.${domain}`,
        api: `https://api.${domain}`,
        farm: `https://farma.${domain}`,
        farmDebug: isLocalDevelopment ? `https://farma.${domain}` : null,
        garden: `https://vrt.${domain}`,
        news: isProduction
            ? `https://www.${domain}/novosti`
            : `https://novosti.${domain}`,
        status: `https://status.${domain}`,
        storybook: `https://storybook.${storybookDomain}`,
        www: `https://www.${domain}`,
    };
}

function getDevelopmentSections(hosts: EnvironmentHosts): DevelopmentSection[] {
    const operationalDebugResources: DevelopmentResource[] = [
        ...(hosts.farmDebug
            ? [
                  {
                      title: 'Farma debug indeks',
                      description:
                          'Lokalni razvojni indeks za farm debug alate i operativne provjere.',
                      href: `${hosts.farmDebug}/debug`,
                      icon: '🛠️',
                  },
                  {
                      title: 'Etikete berbe',
                      description:
                          'Lokalni pregled generiranih harvest etiketa s reprezentativnim podacima.',
                      href: `${hosts.farmDebug}/debug/labels`,
                      icon: '🏷️',
                  },
              ]
            : []),
        {
            title: 'Aplikacija debug indeks',
            description:
                'Pregled internog debug alata za dijeljene admin i aplikacijske komponente.',
            href: `${hosts.app}/debug`,
            icon: '🧰',
        },
        {
            title: 'SelectItems mobile debug',
            description:
                'Ručna mobilna provjera otvaranja i zatvaranja SelectItems kontrole.',
            href: `${hosts.app}/debug/select-items`,
            icon: '📱',
        },
        {
            title: 'MCP test konzola',
            description:
                'Sigurna JSON-RPC konzola za provjeru MCP alata, resursa i autorizacije.',
            href: `${hosts.api}/test`,
            icon: '🧾',
        },
    ];

    return [
        {
            title: 'Vrt debug i učinkovitost',
            description:
                'Brzi pristup vrtnim debug scenama, pregledima elemenata i provjerama učinkovitosti iscrtavanja.',
            resources: [
                {
                    title: 'Vrt debug indeks',
                    description:
                        'Početni pregled svih dostupnih debug scena i pomoćnih alata u Vrt aplikaciji.',
                    href: `${hosts.garden}/debug`,
                    icon: '🧪',
                },
                {
                    title: 'Dijagnostika vrtnih elemenata',
                    description:
                        'Mrežni prikaz za pregled vrtnih elemenata, blokova i prikazanih stanja.',
                    href: `${hosts.garden}/debug/entities`,
                    icon: '🐞',
                },
                {
                    title: 'Jedan vrtni element',
                    description:
                        'Izolirani prikaz jednog elementa kroz standardnu sandbox scenu.',
                    href: `${hosts.garden}/debug/entities/FireflyJar`,
                    icon: '🔎',
                },
                {
                    title: 'Učinkovitost prikaza biljaka',
                    description:
                        'Gusti prikaz biljnih predložaka za uočavanje zastoja pri iscrtavanju i pada učinkovitosti.',
                    href: `${hosts.garden}/debug/plants`,
                    icon: '📈',
                },
                {
                    title: 'Lokalni sandbox igre',
                    description:
                        'Igriva scena s lokalnom pohranom za brzu provjeru stanja vrta.',
                    href: `${hosts.garden}/debug/sandbox`,
                    icon: '🎮',
                },
                {
                    title: 'Ponašanje životinja',
                    description:
                        'Scena za provjeru ponašanja, postavljanja i kontrola životinja u vrtu.',
                    href: `${hosts.garden}/debug/animals`,
                    icon: '🐾',
                },
                {
                    title: 'Profili igre',
                    description:
                        'Mock profili vrta za vrijeme, sezonu, kvalitetu prikaza i HUD provjere.',
                    href: `${hosts.garden}/debug/profile/game`,
                    icon: '🧬',
                },
                {
                    title: 'Matrica nagrada radnji',
                    description:
                        'Before/after prikaz podignutih gredica za vizualne nagrade radnji.',
                    href: `${hosts.garden}/debug/profile/game?profile=operation-rewards&details=1&quality=medium`,
                    icon: '✨',
                },
            ],
        },
        {
            title: 'Operativni debug',
            description:
                'Interni debug alati za farmu, admin aplikaciju i provjeru platformnih integracija.',
            resources: operationalDebugResources,
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
                    title: 'Novosti',
                    description:
                        'Aplikacija za novosti, changelog i javne CMS objave.',
                    href: hosts.news,
                    icon: '📰',
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
                    icon: {
                        type: 'image',
                        src: 'https://posthog.com/favicon-32x32.png',
                    },
                },
                {
                    title: 'GitHub',
                    description:
                        'Kontrola izvornog koda, pregledi promjena, praćenje zadataka i CI provjere.',
                    href: 'https://github.com/gredice',
                    icon: {
                        type: 'github',
                    },
                },
            ],
        },
    ];
}

function ResourceIcon({
    icon,
    title,
}: {
    icon: DevelopmentResourceIcon;
    title: string;
}) {
    const label = `${title} ikona`;

    if (typeof icon === 'string') {
        return (
            <span
                className="flex size-8 items-center justify-center text-3xl"
                role="img"
                aria-label={label}
            >
                {icon}
            </span>
        );
    }

    if (icon.type === 'github') {
        return (
            <span
                className="flex size-8 items-center justify-center text-foreground"
                role="img"
                aria-label={label}
            >
                <CompanyGitHub
                    aria-hidden="true"
                    className="size-8"
                    focusable="false"
                />
            </span>
        );
    }

    return (
        <span
            className="flex size-8 items-center justify-center"
            role="img"
            aria-label={label}
        >
            {/** biome-ignore lint/performance/noImgElement: Third-party tool logo is a small favicon outside the Next image config. */}
            <img
                alt=""
                className="size-7 rounded-xs object-contain"
                height={28}
                loading="lazy"
                referrerPolicy="no-referrer"
                src={icon.src}
                width={28}
            />
        </span>
    );
}

function DeploymentStatsSection() {
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

            <DeploymentStatsCard />
        </section>
    );
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
                <DeploymentStatsSection />

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
                                                <ResourceIcon
                                                    icon={resource.icon}
                                                    title={resource.title}
                                                />
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
