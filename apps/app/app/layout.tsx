import { PostHogPageView, PostHogProvider } from '@posthog/next';
import { Analytics } from '@vercel/analytics/react';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import Head from 'next/head';
import type { ReactNode } from 'react';
import { ImpersonationBanner } from '../components/ImpersonationBanner';
import { ClientAppProvider } from '../components/providers/ClientAppProvider';

export function generateMetadata(): Metadata {
    return {
        title: 'Gredice Admin',
        description: 'Gredice admin - upravljanje gredicama',
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
                <ImpersonationBanner />
                {children}
            </ClientAppProvider>
            <Analytics />
        </>
    );

    return (
        <html lang="hr" translate="no" suppressHydrationWarning={true}>
            <Head>
                <meta
                    name="apple-mobile-web-app-title"
                    content="Gredice Admin"
                />
                <meta name="theme-color" content="#111111" />
                <title>Gredice Admin</title>
            </Head>
            <body className="antialiased min-h-screen flex bg-background text-foreground">
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
