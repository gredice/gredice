import { Analytics } from '@vercel/analytics/react';
import type { Metadata } from 'next';
import './globals.css';
import { PostHogPageView, PostHogProvider } from '@posthog/next';
import { PageNav } from '@signalco/ui/Nav';
import { Stack } from '@signalco/ui-primitives/Stack';
import { VercelToolbar } from '@vercel/toolbar/next';
import Head from 'next/head';
import type { ReactNode } from 'react';
import { PageViewTracker } from '../components/analytics/PageViewTracker';
import { Logotype } from '../components/Logotype';
import { NavUserButton } from '../components/NavUserButton';
import { ClientAppProvider } from '../components/providers/ClientAppProvider';
import { KnownPages } from '../src/KnownPages';
import { Footer } from './Footer';
import { LayoutContainer } from './LayoutContainer';

export function generateMetadata(): Metadata {
    return {
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
}

export default async function RootLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    const shouldInjectToolbar = process.env.NODE_ENV === 'development';
    const postHogApiKey =
        process.env.NEXT_PUBLIC_POSTHOG_KEY ??
        process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    const postHogApiHost = '/ingest';
    const postHogUiHost =
        process.env.NEXT_PUBLIC_POSTHOG_UI_HOST ??
        process.env.NEXT_PUBLIC_POSTHOG_HOST;
    const content = (
        <ClientAppProvider>
            <Stack>
                <div className="z-20">
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
                            {
                                href: KnownPages.Plants,
                                text: 'Biljke',
                            },
                            {
                                href: KnownPages.FAQ,
                                text: 'Česta pitanja',
                            },
                        ]}
                    >
                        <div className="absolute bg-background/80 w-full inset-0 -z-10" />
                        <NavUserButton href={KnownPages.GardenApp} />
                    </PageNav>
                </div>
                <main className="mt-16 relative">
                    <LayoutContainer>{children}</LayoutContainer>
                </main>
                <Footer />
            </Stack>
            <Analytics />
            <PageViewTracker />
            {shouldInjectToolbar && <VercelToolbar />}
        </ClientAppProvider>
    );

    return (
        <html lang="hr" translate="no" suppressHydrationWarning>
            <Head>
                <title>Gredice</title>
                <meta name="apple-mobile-web-app-title" content="Gredice" />
                <meta name="theme-color" content="#2e6f40" />
                <link rel="preconnect" href="https://vrt.gredice.com" />
                <link
                    rel="preload"
                    href="https://vrt.gredice.com/assets/models/GameAssets.glb"
                    as="fetch"
                    type="model/gltf-binary"
                    crossOrigin="anonymous"
                />
            </Head>
            <body className="antialiased">
                {postHogApiKey ? (
                    <PostHogProvider
                        apiKey={postHogApiKey}
                        clientOptions={{
                            api_host: postHogApiHost,
                            capture_exceptions: true,
                            debug: process.env.NODE_ENV === 'development',
                            defaults: '2026-01-30',
                            ui_host: postHogUiHost ?? null,
                        }}
                    >
                        <PostHogPageView />
                        {content}
                    </PostHogProvider>
                ) : (
                    content
                )}
            </body>
        </html>
    );
}
