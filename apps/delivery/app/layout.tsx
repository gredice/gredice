import { Analytics } from '@vercel/analytics/react';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { AuthAppProvider } from '../components/providers/AuthAppProvider';
import { ClientAppProvider } from '../components/providers/ClientAppProvider';
import './globals.css';

export const metadata: Metadata = {
    title: {
        default: 'Gredice dostava',
        template: '%s | Gredice dostava',
    },
    description: 'Preuzimanje, dostava i praćenje Gredice uroda.',
    manifest: '/manifest.json',
    robots: { index: false, follow: false },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    themeColor: '#166534',
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="hr" translate="no">
            <body className="min-h-screen min-w-0 overflow-x-hidden bg-background antialiased">
                <ClientAppProvider>
                    <AuthAppProvider>{children}</AuthAppProvider>
                </ClientAppProvider>
                <Analytics />
            </body>
        </html>
    );
}
