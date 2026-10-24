import { PumpkinTrailViewer } from '@gredice/game/pumpkin-trail';
import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
};
export const metadata: Metadata = {
    title: 'Staza bundeva | Gredice',
    description:
        'Osvijetli pet bundeva u kratkoj, dobrovoljnoj igri svjetla. Bez kupnje i promjena u tvom vrtu.',
    alternates: { canonical: 'https://vrt.gredice.com/staza-bundeva' },
};
export default function PumpkinTrailPage() {
    return (
        <>
            <PumpkinTrailViewer />
            <nav className="mx-auto max-w-4xl px-4 pb-6">
                <Link href="/" prefetch={false} className="underline">
                    Otvori vrt
                </Link>
                <Link
                    href="/kestenijada"
                    prefetch={false}
                    className="ml-4 underline"
                >
                    Posjeti Kestenijadu
                </Link>
            </nav>
        </>
    );
}
