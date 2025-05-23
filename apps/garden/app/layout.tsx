import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { AxiomWebVitals } from 'next-axiom';
import "./globals.css";
import Head from "next/head";
import { ClientAppProvider } from "../components/providers/ClientAppProvider";
import { ReactNode } from "react";
import { VercelToolbar } from '@vercel/toolbar/next';

export const metadata: Metadata = {
  title: "Vrt | Gredice",
  description: "Gredice vrt - vrt po tvom",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const shouldInjectToolbar = process.env.NODE_ENV === 'development';

  return (
    <html lang="hr" suppressHydrationWarning={true}>
      <Head>
        <meta name="theme-color" content="#2e6f40" />
        <meta name="apple-mobile-web-app-title" content="Gredice" />
      </Head>
      <body className="antialiased bg-muted">
        <ClientAppProvider>
          {children}
        </ClientAppProvider>
        <Analytics />
        <AxiomWebVitals />
        {shouldInjectToolbar && <VercelToolbar />}
      </body>
    </html>
  );
}
