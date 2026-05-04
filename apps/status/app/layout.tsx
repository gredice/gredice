import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
    metadataBase: new URL('https://status.gredice.com'),
    title: {
        default: 'Gredice Status',
        template: '%s | Gredice Status',
    },
    description: 'Trenutna dostupnost Gredice servisa.',
    openGraph: {
        title: 'Gredice Status',
        description: 'Trenutna dostupnost Gredice servisa.',
        siteName: 'Gredice Status',
        type: 'website',
        url: 'https://status.gredice.com',
    },
};

export const viewport: Viewport = {
    themeColor: '#2e6f40',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return (
        <html lang="hr">
            <body className="antialiased">{children}</body>
        </html>
    );
}
