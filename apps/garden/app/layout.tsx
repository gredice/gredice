import { ImpersonationBanner } from '@gredice/ui/ImpersonationBanner';
import { PostHogPageView, PostHogProvider } from '@posthog/next';
import { Analytics } from '@vercel/analytics/react';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { VercelToolbar } from '@vercel/toolbar/next';
import { Montserrat } from 'next/font/google';
import type { ReactNode } from 'react';
import { ClientAppProvider } from '../components/providers/ClientAppProvider';

const montserrat = Montserrat({
    subsets: ['latin'],
    variable: '--font-montserrat',
});

export function generateMetadata(): Metadata {
    return {
        title: 'Vrt | Gredice',
        description: 'Gredice vrt - vrt po tvom',
        other: {
            'apple-mobile-web-app-title': 'Gredice',
        },
    };
}

export const viewport: Viewport = {
    maximumScale: 1,
    initialScale: 1,
    themeColor: '#2e6f40',
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
                <ImpersonationBanner />
                {children}
            </ClientAppProvider>
            <Analytics />
            {shouldInjectToolbar && <VercelToolbar />}
        </>
    );

    return (
        <html lang="hr" translate="no" suppressHydrationWarning={true}>
            <body className={`${montserrat.variable} antialiased bg-muted`}>
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
