import { ImpersonationBanner } from '@gredice/ui/ImpersonationBanner';
import { Analytics } from '@vercel/analytics/react';
import type { Metadata } from 'next';
import './globals.css';
import { PublicFooter, PublicHeader } from '@gredice/ui/PublicChrome';
import { Stack } from '@gredice/ui/Stack';
import { PostHogPageView, PostHogProvider } from '@posthog/next';
import { VercelToolbar } from '@vercel/toolbar/next';
import { Montserrat } from 'next/font/google';
import Head from 'next/head';
import type { ReactNode } from 'react';
import { PageViewTracker } from '../components/analytics/PageViewTracker';
import { ClientAppProvider } from '../components/providers/ClientAppProvider';
import { LayoutContainer } from './LayoutContainer';

const montserrat = Montserrat({
    subsets: ['latin'],
    variable: '--font-montserrat',
});

const gardenModelPreloadUrls = [
    'BlockGround',
    'BlockGroundAngle',
    'BlockGrass',
    'BlockGrassAngle',
    'BlockSand',
    'BlockSandAngle',
    'BlockTerrainCorner',
    'BlockTerrainReverseCorner',
].map((assetName) => `https://vrt.gredice.com/assets/models/${assetName}.glb`);

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
        process.env.NODE_ENV === 'development'
            ? undefined
            : (process.env.NEXT_PUBLIC_POSTHOG_KEY ??
              process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN);
    const postHogApiHost = '/ingest';
    const postHogUiHost =
        process.env.NEXT_PUBLIC_POSTHOG_UI_HOST ??
        process.env.NEXT_PUBLIC_POSTHOG_HOST;
    const content = (
        <ClientAppProvider>
            <ImpersonationBanner />
            <Stack>
                <PublicHeader />
                <main className="mt-16 relative">
                    <LayoutContainer>{children}</LayoutContainer>
                </main>
                <PublicFooter />
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
                {gardenModelPreloadUrls.map((href) => (
                    <link
                        key={href}
                        rel="preload"
                        href={href}
                        as="fetch"
                        type="model/gltf-binary"
                        crossOrigin="anonymous"
                    />
                ))}
            </Head>
            <body className={`${montserrat.variable} antialiased`}>
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
