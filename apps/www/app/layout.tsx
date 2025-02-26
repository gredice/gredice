import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { AxiomWebVitals } from 'next-axiom';
import "./globals.css";
import Head from "next/head";
import { Container } from "@signalco/ui-primitives/Container";
import { Stack } from "@signalco/ui-primitives/Stack";
import { PageNav } from "@signalco/ui/Nav";
import Image from "next/image";
import { KnownPages } from "../src/KnownPages";
import Link from "next/link";
import { NavigatingButton } from "@signalco/ui/NavigatingButton";
import { SectionsView } from "@signalco/cms-core/SectionsView";
import { SectionData } from "@signalco/cms-core/SectionData";
import { CompanyGitHub, CompanyReddit, CompanyX } from "@signalco/ui-icons";
import { sectionsComponentRegistry } from "../components/shared/sectionsComponentRegistry";
import { ClientAppProvider } from "../components/providers/ClientAppProvider";
import { getFlags } from "../lib/flags/getFlags";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Popper } from "@signalco/ui-primitives/Popper";
import {ReactNode} from "react";

export const metadata: Metadata = {
    title: "Gredice",
    description: "Gredice - vrt po tvom",
    keywords: ["gredice", "vrt", "opg", "vrtlarstvo", "vrtovi", "vrtlar", "vrtlarica", "vrtlarstvo", "vrtne gredice", "vrtne gredice za povrće", "vrtne gredice za cvijeće", "vrtne gredice za voće", "vrtne gredice za začinsko bilje", "vrtne gredice za povrće i cvijeće", "vrtne gredice za povrće i voće", "vrtne gredice za povrće i začinsko bilje", "vrtne gredice za cvijeće i voće", "vrtne gredice za cvijeće i začinsko bilje", "vrtne gredice za voće i začinsko bilje", "vrtne gredice za povrće, cvijeće i voće", "vrtne gredice za povrće, cvijeće i začinsko bilje", "vrtne gredice za povrće, voće i začinsko bilje", "vrtne gredice za cvijeće, voće i začinsko bilje", "vrtne gredice za povrće, cvijeće, voće i začinsko bilje"],
};

const sectionsData: SectionData[] = [
    {
        component: 'Footer1',
        tagline: 'Gredice',
        asset: <Image src="/Logotype - gredice@2x.svg" width={320} height={87} alt="Gredice" quality={100} />,
        features: [
            {
                header: 'Informacije',
                ctas: [
                    { label: 'Biljke', href: KnownPages.Plants },
                    { label: 'Blokovi', href: KnownPages.Blocks },
                    { label: 'Suncokreti', href: KnownPages.Sunflowers },
                    { label: 'Česta pitanja', href: KnownPages.FAQ },
                    { label: 'O nama', href: KnownPages.AboutUs },
                ]
            },
            {
                header: 'Zajednice',
                ctas: [
                    { label: 'r/gredice', href: 'https://www.reddit.com/r/gredice/' },
                    { label: 'Razgovori na GitHub-u', href: 'https://github.com/gredice/gredice/discussions' },
                ]
            },
            {
                header: 'Legalno',
                ctas: [
                    { label: 'Politika privatnosti', href: KnownPages.LegalPrivacy },
                    { label: 'Uvjeti korištenja', href: KnownPages.LegalTerms },
                    { label: 'Politika kolačića', href: KnownPages.LegalCookies },
                    { label: 'Licenca izvnornog koda', href: KnownPages.LegalLicense },
                ]
            }
        ],
        ctas: [
            { label: 'X', href: 'https://x.com/gredicecom', icon: <CompanyX /> },
            { label: 'reddit', href: 'https://www.reddit.com/r/gredice/', icon: <CompanyReddit /> },
            { label: 'GitHub', href: 'https://github.com/gredice', icon: <CompanyGitHub /> },
        ]
    }
];

const preSeasonSectionsData: SectionData[] = [
    {
        component: 'Footer1',
        tagline: 'Gredice',
        asset: <Image src="/Logotype - gredice@2x.svg" width={320} height={87} alt="Gredice" quality={100} />,
        features: [
            {
                header: 'Informacije',
                ctas: [
                    { label: 'Biljke', href: KnownPages.Plants },
                    { label: 'Blokovi', href: KnownPages.Blocks },
                    { label: 'Suncokreti', href: KnownPages.Sunflowers },
                    { label: 'Česta pitanja', href: KnownPages.FAQ },
                ]
            },
            {
                header: 'Zajednice',
                ctas: [
                    { label: 'r/gredice', href: 'https://www.reddit.com/r/gredice/' },
                    { label: 'Razgovori na GitHub-u', href: 'https://github.com/gredice/gredice/discussions' },
                ]
            },
        ],
        ctas: [
            // { label: 'X', href: 'https://x.com/gredicecom', icon: <CompanyX /> },
            { label: 'reddit', href: 'https://www.reddit.com/r/gredice/', icon: <CompanyReddit /> },
            { label: 'GitHub', href: 'https://github.com/gredice', icon: <CompanyGitHub /> },
        ]
    }
];

export default async function RootLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    const flags = await getFlags();
    const preSeason = flags.preSeason({ fallback: true });

    return (
        <html lang="en">
            <Head>
                <title>Gredice</title>
                <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
                <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
                <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
                <link rel="manifest" href="/site.webmanifest" />
                <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#2e6f40" />
                <meta name="msapplication-TileColor" content="#2e6f40" />
                <meta name="theme-color" content="#2e6f40" />
            </Head>
            <ClientAppProvider>
                <body className="antialiased">
                    <Stack>
                        <PageNav
                            logo={(
                                <Image src="/Logotype - gredice@2x.svg" width={140} height={38} alt="Gredice" quality={100} priority />
                            )}
                            links={preSeason ? [] : [
                                { href: KnownPages.Plants, text: 'Biljke' },
                                { href: KnownPages.Blocks, text: 'Blokovi' },
                                { href: KnownPages.FAQ, text: 'Česta pitanja' },
                            ]}>
                            {preSeason ? (
                                <Popper trigger={(
                                    <NavigatingButton className="bg-green-800/30 hover:bg-green-800/30">
                                        Vrt
                                    </NavigatingButton>
                                )}
                                    className="p-4">
                                    <Stack spacing={2}>
                                        <Typography level="body2" semiBold>
                                            Dostupno uskoro
                                        </Typography>
                                        <Typography>
                                            Vrt je trenutno zatvoren.
                                        </Typography>
                                    </Stack>
                                </Popper>
                            ) : (
                                    <Link href={KnownPages.GardenApp}>
                                        <NavigatingButton className="bg-green-800 hover:bg-green-700">
                                            Vrt
                                        </NavigatingButton>
                                    </Link>
                            )}
                        </PageNav>
                        <main className="mt-16 relative">
                            <Container>
                                {children}
                            </Container>
                        </main>
                        <footer>
                            <SectionsView
                                sectionsData={preSeason ? preSeasonSectionsData : sectionsData}
                                componentsRegistry={sectionsComponentRegistry} />
                        </footer>
                    </Stack>
                    <Analytics />
                    <AxiomWebVitals />
                </body>
            </ClientAppProvider>
        </html>
    );
}
