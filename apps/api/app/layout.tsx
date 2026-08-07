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
    viewportFit: 'cover',
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
            <Stack className="w-full [padding-right:env(safe-area-inset-right,0px)] [padding-bottom:env(safe-area-inset-bottom,0px)] [padding-left:env(safe-area-inset-left,0px)]">
                <div className="h-[calc(62px+env(safe-area-inset-top,0px))]" />
                <header className="fixed top-0 left-0 z-10 w-full border-white/10 border-b bg-[#111111] pb-2 [padding-top:calc(env(safe-area-inset-top,0px)+0.5rem)] [padding-right:calc(env(safe-area-inset-right,0px)+1rem)] [padding-left:calc(env(safe-area-inset-left,0px)+1rem)]">
                    <Link href="/">
                        <Image
                            alt="Gredice Logotype"
                            className="brightness-0 invert"
                            src="https://cdn.gredice.com/Logotype-gredice_2x.png"
                            width={163}
                            height={44}
                        />
                    </Link>
                </header>
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
