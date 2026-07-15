import { VercelToolbar } from '@vercel/toolbar/next';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import Head from 'next/head';
import type { ReactNode } from 'react';
import { FarmAnalyticsProvider } from '../components/analytics/FarmAnalyticsProvider';
import { FarmPageViewTracker } from '../components/analytics/FarmPageViewTracker';
import { FarmPostHogProvider } from '../components/analytics/FarmPostHogProvider';
import { FarmWebAnalytics } from '../components/analytics/FarmWebAnalytics';
import { FarmAppShell } from '../components/navigation/FarmAppShell';
import { AuthAppProvider } from '../components/providers/AuthAppProvider';
import { ClientAppProvider } from '../components/providers/ClientAppProvider';

export function generateMetadata(): Metadata {
    return {
        title: 'Gredice Farm',
        description: 'Gredice farma - upravljanje farmom.',
    };
}

export const viewport: Viewport = {
    initialScale: 1,
    viewportFit: 'cover',
    width: 'device-width',
};

export default function RootLayout({
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
        <>
            <ClientAppProvider>
                <AuthAppProvider>
                    <FarmAnalyticsProvider>
                        <FarmAppShell>{children}</FarmAppShell>
                    </FarmAnalyticsProvider>
                </AuthAppProvider>
            </ClientAppProvider>
            <FarmWebAnalytics />
            {shouldInjectToolbar && <VercelToolbar />}
        </>
    );

    return (
        <html lang="hr" translate="no">
            <Head>
                <meta
                    name="apple-mobile-web-app-title"
                    content="Gredice Farm"
                />
                <meta name="theme-color" content="#8b5e34" />
                <title>Gredice Farm</title>
            </Head>
            <body className="antialiased min-h-screen flex w-full min-w-0 overflow-x-hidden bg-background">
                {postHogApiKey ? (
                    <FarmPostHogProvider
                        apiKey={postHogApiKey}
                        apiHost={postHogApiHost}
                        uiHost={postHogUiHost}
                    >
                        <FarmPageViewTracker />
                        {content}
                    </FarmPostHogProvider>
                ) : (
                    content
                )}
            </body>
        </html>
    );
}
