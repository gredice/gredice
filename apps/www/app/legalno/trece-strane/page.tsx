import { StyledHtml } from '@gredice/ui/StyledHtml';
import { Container } from '@signalco/ui-primitives/Container';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { Metadata } from 'next';
import { PageHeader } from '../../../components/shared/PageHeader';

export const metadata: Metadata = {
    title: 'Treće strane',
    description: 'Informacije o korištenim izvorima podataka trećih strana.',
};

const thirdPartyPlatforms = [
    {
        title: 'Pružatelji usluga',
        description:
            'Platforma koristi sljedeće pružatelje usluga trećih strana:',
        entries: [
            {
                name: 'Azure',
                category: 'Infrastruktura u oblaku',
                description:
                    'Platforma za upravljanje i distribuciju aplikacija u oblaku.',
                iconUrl: 'https://azure.microsoft.com/favicon.ico',
                website: 'https://azure.microsoft.com',
            },
            {
                name: 'Checkly',
                category: 'Nadzor dostupnosti',
                description:
                    'Platforma za provjeru dostupnosti, performansi i ispravnosti web usluga.',
                iconUrl: 'https://www.checklyhq.com/favicon.ico',
                website: 'https://www.checklyhq.com',
            },
            {
                name: 'Cloudflare DNS',
                category: 'DNS',
                description:
                    'Usluga za upravljanje DNS zapisima i poboljšanje sigurnosti web stranice.',
                iconUrl: 'https://www.cloudflare.com/favicon.ico',
                website: 'https://www.cloudflare.com',
            },
            {
                name: 'Cloudflare Email Routing',
                category: 'E-pošta',
                description:
                    'Usluga za upravljanje e-poštom i zaštitu od neželjene pošte.',
                iconUrl: 'https://www.cloudflare.com/favicon.ico',
                website: 'https://www.cloudflare.com',
            },
            {
                name: 'Cloudflare R2',
                category: 'Pohrana',
                description:
                    'Usluga za brzu isporuku sadržaja i optimizaciju performansi web stranice.',
                iconUrl: 'https://www.cloudflare.com/favicon.ico',
                website: 'https://www.cloudflare.com',
            },
            {
                name: 'Hypertune',
                category: 'Značajke sustava',
                description: 'Platforma za upravljanje značajkama sustava.',
                iconUrl: 'https://www.hypertune.com/favicon.ico',
                website: 'https://www.hypertune.com',
            },
            {
                name: 'PostHog',
                category: 'Analitika proizvoda',
                description:
                    'Platforma za analitiku proizvoda i upravljanje sistemskim zapisima.',
                iconUrl: 'https://posthog.com/favicon-32x32.png',
                website: 'https://posthog.com',
            },
            {
                name: 'Stripe',
                category: 'Plaćanja',
                description: 'Platforma za online plaćanja i naplatu.',
                iconUrl: 'https://stripe.com/favicon.ico',
                website: 'https://stripe.com',
            },
            {
                name: 'Vercel Analytics',
                category: 'Web analitika',
                description:
                    'Alat za analitiku koji nam pomaže razumjeti kako korisnici koriste našu web stranicu.',
                iconUrl: 'https://vercel.com/favicon.ico',
                website: 'https://vercel.com',
            },
            {
                name: 'Vercel Hosting',
                category: 'Hosting',
                description:
                    'Platforma za hosting i distribuciju web stranica.',
                iconUrl: 'https://vercel.com/favicon.ico',
                website: 'https://vercel.com',
            },
        ],
    },
    {
        title: 'Alati koje koristimo',
        description:
            'Za razvoj, dizajn i suradnju koristimo sljedeće alate trećih strana:',
        entries: [
            {
                name: 'Blender',
                category: '3D izrada',
                description: 'Alat za izradu 3D modela i animacija.',
                iconUrl: 'https://www.blender.org/favicon.ico',
                website: 'https://www.blender.org',
            },
            {
                name: 'Figma',
                category: 'Dizajn',
                description:
                    'Alat za dizajniranje korisničkog sučelja i prototipiranje.',
                iconUrl: 'https://static.figma.com/app/icon/2/favicon.svg',
                website: 'https://www.figma.com',
            },
            {
                name: 'GitHub',
                category: 'Razvoj softvera',
                description:
                    'Platforma za upravljanje izvornim kodom i suradnju na projektima.',
                iconUrl: 'https://github.com/favicon.ico',
                website: 'https://github.com',
            },
        ],
    },
];

export default function UvjetiKoristenjaPage() {
    return (
        <Container maxWidth="sm">
            <Stack>
                <PageHeader
                    padded
                    header="Treće strane"
                    subHeader="Informacije o korištenim izvorima podataka trećih strana."
                />
                <StyledHtml>
                    <h2>Uvod</h2>
                    <p>
                        Ovi Uvjeti korištenja (u daljnjem tekstu:
                        &quot;Uvjeti&quot;) primjenjuju se na korištenje
                        Platforme Gredice (
                        <a href="https://www.gredice.com">www.gredice.com</a>) i
                        sve njezine usluge.
                    </p>
                    <h2>Treće strane</h2>
                    {thirdPartyPlatforms.map((section) => (
                        <section key={section.title}>
                            <h3>{section.title}</h3>
                            <p>{section.description}</p>
                            <div className="not-prose overflow-x-auto rounded-md border border-border">
                                <table className="w-full border-collapse text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/60">
                                            <th className="px-3 py-2 text-left font-medium">
                                                Name
                                            </th>
                                            <th className="px-3 py-2 text-left font-medium">
                                                Category
                                            </th>
                                            <th className="px-3 py-2 text-left font-medium">
                                                Description
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...section.entries]
                                            .sort((a, b) =>
                                                a.name.localeCompare(
                                                    b.name,
                                                    'hr',
                                                ),
                                            )
                                            .map((platform) => (
                                                <tr
                                                    key={platform.name}
                                                    className="border-b last:border-b-0"
                                                >
                                                    <td className="px-3 py-3 align-top">
                                                        <a
                                                            href={
                                                                platform.website
                                                            }
                                                            className="inline-flex items-center gap-2 font-medium text-primary underline-offset-4 hover:underline"
                                                            rel="noreferrer"
                                                            target="_blank"
                                                        >
                                                            {/** biome-ignore lint/performance/noImgElement: Favicons come from third-party domains that are not part of Next image config. */}
                                                            <img
                                                                alt=""
                                                                className="size-5 shrink-0 rounded-sm"
                                                                height={20}
                                                                loading="lazy"
                                                                referrerPolicy="no-referrer"
                                                                src={
                                                                    platform.iconUrl
                                                                }
                                                                width={20}
                                                            />
                                                            <span>
                                                                {platform.name}
                                                            </span>
                                                        </a>
                                                    </td>
                                                    <td className="px-3 py-3 align-top text-muted-foreground">
                                                        {platform.category}
                                                    </td>
                                                    <td className="px-3 py-3 align-top">
                                                        {platform.description}
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    ))}
                    <p>
                        Zadržavamo pravo izmjene ovih informacija u bilo kojem
                        trenutku, uključujući dodavanje ili uklanjanje platformi
                        trećih strana. Ukoliko platforma nije navedena na ovoj
                        stranici, molimo kontaktirajte nas na{' '}
                        <a href="mailto:kontakt@gredice.com">
                            kontakt@gredice.com
                        </a>
                        .
                    </p>
                </StyledHtml>
                <Typography level="body2" secondary className="mt-8">
                    Zadnja izmjena: 4. svibnja 2026.
                </Typography>
            </Stack>
        </Container>
    );
}
