import { Analytics } from '@vercel/analytics/react';
import type { Metadata } from 'next';
import './globals.css';
import * as Sentry from '@sentry/nextjs';
import { Stack } from '@signalco/ui-primitives/Stack';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function generateMetadata(): Metadata {
    return {
        title: 'API | Gredice',
        description: 'Gredice API - programski pristup podacima',
        other: {
            ...Sentry.getTraceData(),
        },
    };
}

export default function RootLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return (
        <html lang="en" className="dark">
            <Head>
                <meta name="apple-mobile-web-app-title" content="Gredice" />
                <meta name="theme-color" content="#2e6f40" />
                <title>API | Gredice</title>
            </Head>
            <body className="antialiased min-h-screen flex bg-[#0f0f0f]">
                <Stack className="w-full">
                    <div className="h-[62px]" />
                    <div className="border-b px-4 py-2 fixed top-0 left-0 w-full z-10 bg-[#0f0f0f]">
                        <Link href="/">
                            <Image
                                alt="Gredice Logotype"
                                src="https://cdn.gredice.com/Logotype-gredice_2x.png"
                                width={163}
                                height={44}
                            />
                        </Link>
                    </div>
                    {children}
                </Stack>
                <Analytics />
            </body>
        </html>
    );
}
