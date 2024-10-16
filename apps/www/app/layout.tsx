import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { AxiomWebVitals } from 'next-axiom';
import "./globals.css";
import Head from "next/head";

export const metadata: Metadata = {
  title: "Gredice",
  description: "Gredice - vrt po tvom",
  keywords: ["gredice", "vrt", "opg", "vrtlarstvo", "vrtovi", "vrtlar", "vrtlarica", "vrtlarstvo", "vrtne gredice", "vrtne gredice za povrće", "vrtne gredice za cvijeće", "vrtne gredice za voće", "vrtne gredice za začinsko bilje", "vrtne gredice za povrće i cvijeće", "vrtne gredice za povrće i voće", "vrtne gredice za povrće i začinsko bilje", "vrtne gredice za cvijeće i voće", "vrtne gredice za cvijeće i začinsko bilje", "vrtne gredice za voće i začinsko bilje", "vrtne gredice za povrće, cvijeće i voće", "vrtne gredice za povrće, cvijeće i začinsko bilje", "vrtne gredice za povrće, voće i začinsko bilje", "vrtne gredice za cvijeće, voće i začinsko bilje", "vrtne gredice za povrće, cvijeće, voće i začinsko bilje"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <Head>
        <title>Gredice</title>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#2e6f40" />
        <meta name="msapplication-TileColor" content="#2e6f40" />
        <meta name="theme-color" content="#2e6f40" />
      </Head>
      <body className="antialiased">
        {children}
        <Analytics />
        <AxiomWebVitals />
      </body>
    </html>
  );
}
