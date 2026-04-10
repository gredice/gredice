import { Analytics } from '@vercel/analytics/react';
import { PostHogPageView, PostHogProvider } from '@posthog/next';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { VercelToolbar } from '@vercel/toolbar/next';
import Head from 'next/head';
import type { ReactNode } from 'react';
import { ImpersonationBanner } from '../components/ImpersonationBanner';
import { ClientAppProvider } from '../components/providers/ClientAppProvider';

export function generateMetadata(): Metadata {
    return {
        title: 'Vrt | Gredice',
        description: 'Gredice vrt - vrt po tvom',
    };
}

export const viewport: Viewport = {
    maximumScale: 1,
    initialScale: 1,
    userScalable: false,
    width: 'device-width',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    const shouldInjectToolbar = process.env.NODE_ENV === 'development';
    const postHogApiKey =
        process.env.NEXT_PUBLIC_POSTHOG_KEY ??
        process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    const content = (
        <>
            <ClientAppProvider>
                <ImpersonationBanner />
                {children}
            </ClientAppProvider>
            <Analytics />
            {shouldInjectToolbar && <VercelToolbar />}
        </>
    );

    return (
        <html lang="hr" translate="no" suppressHydrationWarning={true}>
            <Head>
                <meta name="theme-color" content="#2e6f40" />
                <meta name="apple-mobile-web-app-title" content="Gredice" />
            </Head>
            <body className="antialiased bg-muted">
                {postHogApiKey ? (
                    <PostHogProvider
                        apiKey={postHogApiKey}
                        clientOptions={{
                            api_host: '/ingest',
                            capture_exceptions: true,
                            debug: process.env.NODE_ENV === 'development',
                            defaults: '2026-01-30',
                            ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
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
