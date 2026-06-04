import { Analytics } from '@vercel/analytics/react';
import type { Metadata, Route, Viewport } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logotype } from '../components/Logotype';
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

function NavLink({
    href,
    children,
}: Readonly<{
    href: Route;
    children: ReactNode;
}>) {
    return (
        <Link
            href={href}
            className="inline-flex h-9 items-center rounded-md px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
            {children}
        </Link>
    );
}

export default function RootLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return (
        <html lang="hr" translate="no">
            <body className="min-h-dvh antialiased">
                <div className="flex min-h-dvh flex-col">
                    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
                        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
                            <Link
                                href="/"
                                className="inline-flex min-w-0 items-center gap-3"
                            >
                                <Logotype
                                    className="h-8 w-auto shrink-0"
                                    height={32}
                                    priority
                                />
                                <span className="hidden border-l pl-3 text-sm font-semibold text-muted-foreground sm:inline">
                                    Novosti
                                </span>
                            </Link>
                            <nav className="flex shrink-0 items-center gap-1">
                                <NavLink href="/">Blog</NavLink>
                                <NavLink href="/sto-je-novo">
                                    Što je novo
                                </NavLink>
                                <a
                                    href="https://www.gredice.com"
                                    className="inline-flex h-9 items-center rounded-md px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    Gredice
                                </a>
                            </nav>
                        </div>
                    </header>
                    <main className="flex-1">{children}</main>
                    <footer className="border-t">
                        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
                            <span>Gredice Novosti</span>
                            <div className="flex gap-4">
                                <Link href="/">Blog</Link>
                                <Link href="/sto-je-novo">Što je novo</Link>
                                <a href="https://www.gredice.com/kontakt">
                                    Kontakt
                                </a>
                            </div>
                        </div>
                    </footer>
                </div>
                <Analytics />
            </body>
        </html>
    );
}
