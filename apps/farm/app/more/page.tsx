import { AuthProtectedSection, SignedOut } from '@gredice/ui/auth/server';
import {
    Calendar,
    FileText,
    Navigate,
    Settings,
    Sprout,
    Wallet,
} from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import LoginDialog from '../../components/auth/LoginDialog';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';

export const dynamic = 'force-dynamic';

const moreDestinations = [
    {
        destination: 'schedule',
        href: KnownPages.Schedule,
        icon: Calendar,
        label: 'Raspored',
    },
    {
        destination: 'operations',
        href: KnownPages.Operations,
        icon: FileText,
        label: 'Priručnik radnji',
    },
    {
        destination: 'plants',
        href: KnownPages.Plants,
        icon: Sprout,
        label: 'Biljke',
    },
    {
        destination: 'payouts',
        href: KnownPages.Payouts,
        icon: Wallet,
        label: 'Isplate',
    },
    {
        destination: 'settings',
        href: KnownPages.Settings,
        icon: Settings,
        label: 'Postavke',
    },
] as const;

export default function FarmMorePage() {
    const authFarmer = auth.bind(null, ['farmer', 'admin']);

    return (
        <div className="min-h-[100dvh] w-full bg-background">
            <AuthProtectedSection auth={authFarmer}>
                <main
                    aria-labelledby="farm-more-heading"
                    className="mx-auto w-full max-w-5xl space-y-4 p-4"
                >
                    <Typography
                        id="farm-more-heading"
                        component="h1"
                        level="h5"
                        semiBold
                    >
                        Više
                    </Typography>
                    <nav aria-label="Dodatne mogućnosti">
                        <div className="grid gap-2 sm:grid-cols-2">
                            {moreDestinations.map(
                                ({ destination, href, icon: Icon, label }) => (
                                    <Link
                                        key={destination}
                                        href={href}
                                        data-farm-analytics="navigation"
                                        data-farm-navigation-destination={
                                            destination
                                        }
                                        data-farm-navigation-source="more_page"
                                        className="flex min-h-11 min-w-0 items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-card-foreground transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                                    >
                                        <Icon
                                            aria-hidden="true"
                                            className="size-5 shrink-0 text-primary"
                                        />
                                        <span className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">
                                            {label}
                                        </span>
                                        <Navigate
                                            aria-hidden="true"
                                            className="size-4 shrink-0 text-muted-foreground"
                                        />
                                    </Link>
                                ),
                            )}
                        </div>
                    </nav>
                </main>
            </AuthProtectedSection>
            <SignedOut auth={authFarmer}>
                <LoginDialog />
            </SignedOut>
        </div>
    );
}
