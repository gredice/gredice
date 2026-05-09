import { PostHogPageView, PostHogProvider } from '@posthog/next';
import { Analytics } from '@vercel/analytics/react';
import { VercelToolbar } from '@vercel/toolbar/next';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import Head from 'next/head';
import type { ReactNode } from 'react';
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
    const postHogApiHost = '/ingest';
    const postHogUiHost =
        process.env.NEXT_PUBLIC_POSTHOG_UI_HOST ??
        process.env.NEXT_PUBLIC_POSTHOG_HOST;
    const content = (
        <>
            <ClientAppProvider>
                <AuthAppProvider>{children}</AuthAppProvider>
            </ClientAppProvider>
            <Analytics />
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
            <body className="antialiased min-h-screen flex bg-muted">
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
