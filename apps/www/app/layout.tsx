import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { AxiomWebVitals } from 'next-axiom';
import "./globals.css";
import Head from "next/head";
import { Container } from "@signalco/ui-primitives/Container";
import { Stack } from "@signalco/ui-primitives/Stack";
import { PageNav } from "@signalco/ui/Nav";
import { KnownPages } from "../src/KnownPages";
import Link from "next/link";
import { NavigatingButton } from "@signalco/ui/NavigatingButton";
import { SectionsView } from "@signalco/cms-core/SectionsView";
import { SectionData } from "@signalco/cms-core/SectionData";
import { CompanyGitHub, CompanyReddit, CompanyX } from "@signalco/ui-icons";
import { sectionsComponentRegistry } from "../components/shared/sectionsComponentRegistry";
import { ClientAppProvider } from "../components/providers/ClientAppProvider";
import { ReactNode } from "react";
import { Logotype } from "../components/Logotype";

export const metadata: Metadata = {
    title: "Gredice - vrt po tvom",
    description: "Tvoj digitalni vrt s pravim povrćem i beplatnom dostavom. Postavi gredice, zasadi svoje omiljeno povrće, održavaj vrt i uberi plodove a mi ćemo se pobrinuti o brzoj dostavi i besplatnoj na tvoj kućni prag.",
    keywords: [
        "gredice", "gredica",
        "digitalni", "vrt",
        "dostava", "besplatna dostava",
        "sadnja", "sijanje", "berba",
        "najam", "iznajmljivanje",
        "opg", "mali proizvođači",
        "vrtlarstvo", "vrtovi", "vrtlar", "vrtlarica", "vrtlarstvo", "vrtne gredice",
        "povrce", "povrće",
        "biljke", "biljka",
        "virtualni vrt", "virtualno",
    ],
    openGraph: {
        type: "website",
        title: "Gredice - vrt po tvom",
        url: "https://www.gredice.com",
        siteName: "Gredice - vrt po tvom",
        images: [
            {
                url: "/og",
                width: 1200,
                height: 630,
                alt: "Gredice - vrt po tvom",
            },
        ],
    }
};

const sectionsData: SectionData[] = [
    {
        component: 'Footer1',
        tagline: 'Gredice',
        asset: <Logotype className="w-[320px] h-[87px]" />,
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

export default async function RootLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return (
        <html lang="hr">
            <Head>
                <title>Gredice</title>
                <meta name="apple-mobile-web-app-title" content="Gredice" />
                <meta name="theme-color" content="#2e6f40" />
            </Head>
            <ClientAppProvider>
                <body className="antialiased">
                    <Stack>
                        <PageNav
                            logo={(
                                <Logotype className="w-[140px] h-[38px]" aria-label="Gredice" />
                            )}
                            links={[
                                { href: KnownPages.Plants, text: 'Biljke' },
                                { href: KnownPages.Blocks, text: 'Blokovi' },
                                { href: KnownPages.FAQ, text: 'Česta pitanja' },
                            ]}>

                            <Link href={KnownPages.GardenApp}>
                                <NavigatingButton className="bg-green-800 hover:bg-green-700">
                                    Vrt
                                </NavigatingButton>
                            </Link>
                        </PageNav>
                        <main className="mt-16 relative">
                            <Container>
                                {children}
                            </Container>
                        </main>
                        <footer>
                            <SectionsView
                                sectionsData={sectionsData}
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
