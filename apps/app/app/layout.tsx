import { Analytics } from '@vercel/analytics/react';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import Head from 'next/head';
import type { ReactNode } from 'react';
import { ClientAppProvider } from '../components/providers/ClientAppProvider';

export const metadata: Metadata = {
    title: 'Admin | Gredice',
    description: 'Gredice admin - upravljanje gredicama',
};

export const viewport: Viewport = {
    initialScale: 1,
    width: 'device-width',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return (
        <html lang="hr" translate="no" suppressHydrationWarning={true}>
            <Head>
                <meta name="apple-mobile-web-app-title" content="Gredice" />
                <meta name="theme-color" content="#2e6f40" />
                <title>Admin | Gredice</title>
            </Head>
            <body className="antialiased min-h-screen flex bg-muted">
                <ClientAppProvider>{children}</ClientAppProvider>
                <Analytics />
            </body>
        </html>
    );
}
