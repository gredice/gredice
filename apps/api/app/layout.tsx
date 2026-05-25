import { Stack } from '@gredice/ui/Stack';
import { PostHogPageView, PostHogProvider } from '@posthog/next';
import { Analytics } from '@vercel/analytics/react';
import type { Metadata, Viewport } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import './globals.css';

export function generateMetadata(): Metadata {
    return {
        title: 'Gredice API',
        description: 'Gredice API - programski pristup podacima',
        appleWebApp: {
            title: 'Gredice API',
        },
    };
}

export const viewport: Viewport = {
    initialScale: 1,
    themeColor: '#111111',
    width: 'device-width',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
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
            <Stack className="w-full">
                <div className="h-[62px]" />
                <div className="fixed top-0 left-0 z-10 w-full border-white/10 border-b bg-[#111111] px-4 py-2">
                    <Link href="/">
                        <Image
                            alt="Gredice Logotype"
                            className="brightness-0 invert"
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
