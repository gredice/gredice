import { Analytics } from '@vercel/analytics/react';
import type { Metadata } from 'next';
import './globals.css';
import { PageNav } from '@signalco/ui/Nav';
import { NavigatingButton } from '@signalco/ui/NavigatingButton';
import { Container } from '@signalco/ui-primitives/Container';
import { Stack } from '@signalco/ui-primitives/Stack';
import { VercelToolbar } from '@vercel/toolbar/next';
import Head from 'next/head';
import type { ReactNode } from 'react';
import { Logotype } from '../components/Logotype';
import { ClientAppProvider } from '../components/providers/ClientAppProvider';
import { KnownPages } from '../src/KnownPages';
import { Footer } from './Footer';

export const metadata: Metadata = {
    metadataBase: new URL('https://www.gredice.com'),
    title: {
        template: '%s | Gredice',
        default: 'Gredice - vrt po tvom',
    },
    description:
        'Tvoj digitalni vrt s pravim povrćem i besplatnom dostavom. Postavi gredice, zasadi svoje omiljeno povrće, održavaj vrt i uberi plodove, a mi ćemo se pobrinuti o brzoj i besplatnoj dostavi na tvoj kućni prag.',
    keywords: [
        'gredice',
        'gredica',
        'digitalni',
        'vrt',
        'dostava',
        'besplatna dostava',
        'sadnja',
        'sijanje',
        'berba',
        'najam',
        'iznajmljivanje',
        'opg',
        'mali proizvođači',
        'vrtlarstvo',
        'vrtovi',
        'vrtlar',
        'vrtlarica',
        'vrtlarstvo',
        'vrtne gredice',
        'povrce',
        'povrće',
        'biljke',
        'biljka',
        'virtualni vrt',
        'virtualno',
    ],
    openGraph: {
        type: 'website',
        title: 'Gredice - vrt po tvom',
        url: 'https://www.gredice.com',
        siteName: 'Gredice - vrt po tvom',
    },
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    const shouldInjectToolbar = process.env.NODE_ENV === 'development';

    return (
        <html lang="hr" translate="no">
            <Head>
                <title>Gredice</title>
                <meta name="apple-mobile-web-app-title" content="Gredice" />
                <meta name="theme-color" content="#2e6f40" />
            </Head>
            <ClientAppProvider>
                <body className="antialiased">
                    <Stack>
                        <PageNav
                            logo={
                                <Logotype
                                    className="w-[140px] h-[38px]"
                                    aria-label="Gredice"
                                />
                            }
                            links={[
                                {
                                    href: KnownPages.RaisedBeds,
                                    text: 'Podignuta gredica',
                                },
                                { href: KnownPages.Plants, text: 'Biljke' },
                                { href: KnownPages.FAQ, text: 'Česta pitanja' },
                            ]}
                        >
                            <NavigatingButton
                                href={KnownPages.GardenApp}
                                className="bg-green-800 hover:bg-green-700 rounded-full"
                            >
                                Moj vrt
                            </NavigatingButton>
                        </PageNav>
                        <main className="mt-16 relative">
                            <Container>{children}</Container>
                        </main>
                        <Footer />
                    </Stack>
                    <Analytics />
                    {shouldInjectToolbar && <VercelToolbar />}
                </body>
            </ClientAppProvider>
        </html>
    );
}
