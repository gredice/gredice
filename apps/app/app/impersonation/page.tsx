import { type GrediceAppOrigin, getGrediceAppOrigin } from '@gredice/client';
import {
    ArrowRight,
    Fence,
    Globe,
    Shield,
    Sprout,
    Truck,
} from '@gredice/ui/icons';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ComponentType } from 'react';

const impersonationFlagCookieName = 'gredice_impersonating';

export const metadata: Metadata = {
    title: 'Odabir aplikacije za impersonaciju',
};

type ImpersonationApp = {
    description: string;
    domain: string;
    icon: ComponentType<{ className?: string }>;
    name: string;
    origin: GrediceAppOrigin;
};

const impersonationApps: ImpersonationApp[] = [
    {
        name: 'Gredice',
        description: 'Javna stranica, sadržaj i korisničke funkcije.',
        domain: 'www.gredice.com',
        icon: Globe,
        origin: 'www',
    },
    {
        name: 'Vrt',
        description: 'Digitalni vrt, gredice, sadnja i berbe.',
        domain: 'vrt.gredice.com',
        icon: Sprout,
        origin: 'garden',
    },
    {
        name: 'Dostava',
        description: 'Statusi uroda, termini i praćenje dostava.',
        domain: 'dostava.gredice.com',
        icon: Truck,
        origin: 'delivery',
    },
    {
        name: 'Farma',
        description: 'Operativni poslovi, rasporedi i rad na farmi.',
        domain: 'farma.gredice.com',
        icon: Fence,
        origin: 'farm',
    },
    {
        name: 'Administracija',
        description: 'Interno upravljanje Gredice platformom.',
        domain: 'app.gredice.com',
        icon: Shield,
        origin: 'app',
    },
];

function requestOrigin(host: string | null, forwardedProtocol: string | null) {
    if (!host) {
        return undefined;
    }

    const protocol =
        forwardedProtocol ?? (host.startsWith('localhost') ? 'http' : 'https');
    return `${protocol}://${host}`;
}

export default async function ImpersonationPage() {
    const cookieStore = await cookies();
    if (cookieStore.get(impersonationFlagCookieName)?.value !== '1') {
        redirect('/admin/users');
    }

    const requestHeaders = await headers();
    const currentOrigin = requestOrigin(
        requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host'),
        requestHeaders.get('x-forwarded-proto'),
    );

    return (
        <main className="min-h-dvh w-full bg-secondary/40 px-4 py-10 sm:px-6 sm:py-16">
            <div className="mx-auto max-w-3xl">
                <div className="mb-8 space-y-2">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Impersonacija korisnika
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                        Odaberi aplikaciju
                    </h1>
                    <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
                        Impersonacija je pokrenuta. Odaberi aplikaciju u kojoj
                        želiš nastaviti kao korisnik.
                    </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                    {impersonationApps.map((app) => {
                        const Icon = app.icon;
                        return (
                            <a
                                key={app.origin}
                                href={getGrediceAppOrigin(
                                    app.origin,
                                    currentOrigin,
                                )}
                                className="group flex min-h-36 items-start gap-4 rounded-xl border bg-card p-5 text-card-foreground shadow-xs transition hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                    <Icon className="size-6" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-center justify-between gap-3">
                                        <span className="text-lg font-semibold">
                                            {app.name}
                                        </span>
                                        <ArrowRight className="size-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                                    </span>
                                    <span className="mt-1 block text-sm text-muted-foreground">
                                        {app.description}
                                    </span>
                                    <span className="mt-3 block truncate text-xs font-medium text-muted-foreground/80">
                                        {app.domain}
                                    </span>
                                </span>
                            </a>
                        );
                    })}
                </div>
            </div>
        </main>
    );
}
