import { Analytics } from '@vercel/analytics/react';
import type { Metadata } from 'next';
import './globals.css';
import { Button } from '@gredice/ui/Button';
import { PageNav } from '@gredice/ui/Nav';
import { Stack } from '@gredice/ui/Stack';
import { PostHogPageView, PostHogProvider } from '@posthog/next';
import { VercelToolbar } from '@vercel/toolbar/next';
import { Montserrat } from 'next/font/google';
import Head from 'next/head';
import type { ReactNode } from 'react';
import { PageViewTracker } from '../components/analytics/PageViewTracker';
import { Logotype } from '../components/Logotype';
import { NavSearch } from '../components/NavSearch';
import { NavUserButton } from '../components/NavUserButton';
import { ClientAppProvider } from '../components/providers/ClientAppProvider';
import { KnownPages } from '../src/KnownPages';
import { Footer } from './Footer';
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
].map((assetName) => `https://vrt.gredice.com/assets/models/${assetName}.glb`);

function NavLinkButton({
    href,
    children,
    className,
}: Readonly<{
    href: string;
    children: ReactNode;
    className?: string;
}>) {
    return (
        <Button
            href={href}
            variant="plain"
            size="sm"
            className={[
                'h-10 w-full shrink-0 justify-start whitespace-nowrap px-4 text-sm md:mx-1 md:h-9 md:w-auto md:justify-center md:px-3',
                className,
            ]
                .filter(Boolean)
                .join(' ')}
        >
            {children}
        </Button>
    );
}

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
            <Stack>
                <div className="z-20">
                    <PageNav
                        logo={
                            <Logotype
                                className="h-[38px] w-[128px] sm:w-[140px]"
                                aria-label="Gredice"
                            />
                        }
                        links={[
                            <NavLinkButton
                                key="raised-beds"
                                href={KnownPages.RaisedBeds}
                            >
                                Gredica
                            </NavLinkButton>,
                            <NavLinkButton
                                key="plants"
                                href={KnownPages.Plants}
                            >
                                Biljke
                            </NavLinkButton>,
                            <NavLinkButton
                                key="operations"
                                href={KnownPages.Operations}
                            >
                                Radnje
                            </NavLinkButton>,
                            <NavLinkButton key="faq" href={KnownPages.FAQ}>
                                Česta pitanja
                            </NavLinkButton>,
                        ]}
                    >
                        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                            <NavSearch className="shrink-0 md:-ml-1 xl:absolute xl:left-1/2 xl:top-1/2 xl:ml-0 xl:-translate-x-1/2 xl:-translate-y-1/2" />
                            <NavUserButton href={KnownPages.GardenApp} />
                        </div>
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
