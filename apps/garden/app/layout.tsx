import { Analytics } from '@vercel/analytics/react';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import * as Sentry from '@sentry/nextjs';
import { VercelToolbar } from '@vercel/toolbar/next';
import Head from 'next/head';
import type { ReactNode } from 'react';
import { ClientAppProvider } from '../components/providers/ClientAppProvider';

export function generateMetadata(): Metadata {
    return {
        title: 'Vrt | Gredice',
        description: 'Gredice vrt - vrt po tvom',
        other: {
            ...Sentry.getTraceData(),
        },
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

    return (
        <html lang="hr" translate="no" suppressHydrationWarning={true}>
            <Head>
                <meta name="theme-color" content="#2e6f40" />
                <meta name="apple-mobile-web-app-title" content="Gredice" />
            </Head>
            <body className="antialiased bg-muted">
                <ClientAppProvider>{children}</ClientAppProvider>
                <Analytics />
                {shouldInjectToolbar && <VercelToolbar />}
            </body>
        </html>
    );
}
