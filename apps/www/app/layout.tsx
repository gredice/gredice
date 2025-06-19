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
import { ClientAppProvider } from "../components/providers/ClientAppProvider";
import { ReactNode } from "react";
import { Logotype } from "../components/Logotype";
import { Footer } from "./Footer";
import { VercelToolbar } from '@vercel/toolbar/next';

export const metadata: Metadata = {
    title: {
        template: "%s | Gredice",
        default: "Gredice - vrt po tvom",
    },
    description: "Tvoj digitalni vrt s pravim povrćem i beplatnom dostavom. Postavi gredice, zasadi svoje omiljeno povrće, održavaj vrt i uberi plodove, a mi ćemo se pobrinuti o brzoj i besplatnoj dostavi na tvoj kućni prag.",
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

export default async function RootLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    const shouldInjectToolbar = process.env.NODE_ENV === 'development';

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
                        <Footer />
                    </Stack>
                    <Analytics />
                    <AxiomWebVitals />
                    {shouldInjectToolbar && <VercelToolbar />}
                </body>
            </ClientAppProvider>
        </html>
    );
}
