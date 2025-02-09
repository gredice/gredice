import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { AxiomWebVitals } from 'next-axiom';
import "./globals.css";
import Head from "next/head";
import { Stack } from "@signalco/ui-primitives/Stack";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "API | Gredice",
  description: "Gredice API - programski pristup podacima",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <Head>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#2e6f40" />
        <meta name="msapplication-TileColor" content="#2e6f40" />
        <meta name="theme-color" content="#ffffff" />
      </Head>
      <body className="antialiased min-h-screen flex">
        <Stack className='w-full'>
          <div className="h-[62px]" />
          <div className='border-b px-4 py-2 fixed top-0 left-0 w-full z-10' style={{ backgroundColor: '#000' }}>
            <Link href="/">
              <Image alt='Logo' src="/Logo - gredice@2x.svg" width={44} height={44} />
            </Link>
          </div>
          {children}
        </Stack>
        <Analytics />
        <AxiomWebVitals />
      </body>
    </html>
  );
}
