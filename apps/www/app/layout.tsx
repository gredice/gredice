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
import { memo } from "react";
import { Footer1 } from "@signalco/cms-components-marketing/Footer";
import { SectionData } from "@signalco/cms-core/SectionData";
import { CompanyGitHub, CompanyReddit, CompanyX } from "@signalco/ui-icons";

export const metadata: Metadata = {
    title: "Gredice",
    description: "Gredice - vrt po tvom",
    keywords: ["gredice", "vrt", "opg", "vrtlarstvo", "vrtovi", "vrtlar", "vrtlarica", "vrtlarstvo", "vrtne gredice", "vrtne gredice za povrće", "vrtne gredice za cvijeće", "vrtne gredice za voće", "vrtne gredice za začinsko bilje", "vrtne gredice za povrće i cvijeće", "vrtne gredice za povrće i voće", "vrtne gredice za povrće i začinsko bilje", "vrtne gredice za cvijeće i voće", "vrtne gredice za cvijeće i začinsko bilje", "vrtne gredice za voće i začinsko bilje", "vrtne gredice za povrće, cvijeće i voće", "vrtne gredice za povrće, cvijeće i začinsko bilje", "vrtne gredice za povrće, voće i začinsko bilje", "vrtne gredice za cvijeće, voće i začinsko bilje", "vrtne gredice za povrće, cvijeće, voće i začinsko bilje"],
};


const sectionsComponentRegistry = {
    'Footer1': memo(Footer1)
}

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
        ],
        ctas: [
            { label: 'X', href: 'https://x.com/gredicecom', icon: <CompanyX /> },
            { label: 'reddit', href: 'https://www.reddit.com/r/gredice/', icon: <CompanyReddit /> },
            { label: 'GitHub', href: 'https://github.com/gredice', icon: <CompanyGitHub /> },
        ]
    }
];

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
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
            <body className="antialiased">
                <Stack>
                    <PageNav
                        logo={(
                            <Image src="/Logotype - gredice@2x.svg" width={180} height={40} alt="Gredice" quality={100} priority />
                        )}
                        links={[
                            { href: KnownPages.Plants, text: 'Biljke' },
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
        </html>
    );
}
