import { KestenijadaViewer } from '@gredice/game/kestenijada';
import {
    kestenijadaCanonicalUrl,
    parseKestenijadaEventConfig,
} from '@gredice/js/kestenijada';
import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
};

export const metadata: Metadata = {
    title: 'Kestenijada | Gredice',
    description:
        'Primjer jesenskog vrtnog kutka s kolicima s kestenima, čajem i dekom. Pogledaj pet ukrasa i aktualnu ponudu.',
    alternates: { canonical: kestenijadaCanonicalUrl },
    openGraph: {
        title: 'Kestenijada | Gredice',
        description: 'Inspiracija za mali jesenski kutak u virtualnom vrtu.',
        url: kestenijadaCanonicalUrl,
    },
};
export default function KestenijadaPage() {
    return (
        <Suspense
            fallback={
                <main className="p-6" role="status">
                    Pripremamo primjer vrta…
                </main>
            }
        >
            <KestenijadaContent />
        </Suspense>
    );
}
async function KestenijadaContent() {
    await connection();
    return (
        <>
            <KestenijadaViewer
                appBaseUrl=""
                referenceInstant={new Date().toISOString()}
                eventWindow={parseKestenijadaEventConfig(
                    process.env.GREDICE_KESTENIJADA_EVENT_CONFIG,
                )}
            />
            <nav className="mx-auto max-w-4xl px-4 pb-6">
                <Link href="/" prefetch={false} className="underline">
                    Otvori vrt
                </Link>
                <Link
                    href="/staza-bundeva"
                    prefetch={false}
                    className="ml-4 underline"
                >
                    Posjeti stazu bundeva
                </Link>
            </nav>
        </>
    );
}
