import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { AxiomWebVitals } from 'next-axiom';
import "./globals.css";
import Head from "next/head";
import { ClientAppProvider } from "../components/providers/ClientAppProvider";
import {ReactNode} from "react";

export const metadata: Metadata = {
  title: "Farma | Gredice",
  description: "Gredice farma - upravljanje farmom.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <Head>
        <meta name="apple-mobile-web-app-title" content="Gredice" />
        <meta name="theme-color" content="#2e6f40" />
        <title>Farma | Gredice</title>
      </Head>
      <body className="antialiased min-h-screen flex">
        <ClientAppProvider>
          {children}
        </ClientAppProvider>
        <Analytics />
        <AxiomWebVitals />
      </body>
    </html>
  );
}
