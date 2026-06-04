import {
    PublicChromeProvider,
    PublicFooter,
    PublicHeader,
} from '@gredice/ui/PublicChrome';
import { Analytics } from '@vercel/analytics/react';
import type { Metadata, Viewport } from 'next';
import { Montserrat } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
    metadataBase: new URL('https://www.gredice.com'),
    title: {
        default: 'Novosti | Gredice',
        template: '%s | Novosti | Gredice',
    },
    description:
        'Novosti iz Gredica: blog objave, promjene proizvoda i nove mogućnosti za korisnike.',
    openGraph: {
        title: 'Novosti | Gredice',
        description:
            'Blog objave, promjene proizvoda i nove mogućnosti za korisnike Gredica.',
        siteName: 'Gredice',
        type: 'website',
        url: 'https://www.gredice.com/novosti',
    },
};

export const viewport: Viewport = {
    themeColor: '#2e6f40',
};

const montserrat = Montserrat({
    subsets: ['latin'],
    variable: '--font-montserrat',
});

export default function RootLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return (
        <html lang="hr" translate="no" suppressHydrationWarning>
            <body className={`${montserrat.variable} min-h-dvh antialiased`}>
                <PublicChromeProvider apiBasePath="/novosti/api/gredice">
                    <div className="flex min-h-dvh flex-col">
                        <PublicHeader
                            apiBasePath="/novosti/api/gredice"
                            linkMode="www-origin"
                        />
                        <main className="relative mt-16 flex-1">
                            {children}
                        </main>
                        <PublicFooter linkMode="www-origin" />
                    </div>
                </PublicChromeProvider>
                <Analytics />
            </body>
        </html>
    );
}
