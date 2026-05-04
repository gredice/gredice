import { PostHogPageView, PostHogProvider } from '@posthog/next';
import { Analytics } from '@vercel/analytics/react';
import type { Metadata } from 'next';
import './globals.css';
import { Stack } from '@signalco/ui-primitives/Stack';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function generateMetadata(): Metadata {
    return {
        title: 'Gredice API',
        description: 'Gredice API - programski pristup podacima',
    };
}

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
            <Stack className="w-full">
                <div className="h-[62px]" />
                <div className="border-b border-blue-700/30 px-4 py-2 fixed top-0 left-0 w-full z-10 bg-[#2563eb]">
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
        </>
    );

    return (
        <html lang="en">
            <Head>
                <meta name="apple-mobile-web-app-title" content="Gredice API" />
                <meta name="theme-color" content="#2563eb" />
                <title>Gredice API</title>
            </Head>
            <body className="antialiased min-h-screen flex bg-[#eff6ff]">
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
