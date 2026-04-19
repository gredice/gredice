'use client';

import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { ChevronDown } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@signalco/ui-primitives/Menu';
import { usePathname } from 'next/navigation';
import { KnownPages } from '../../../src/KnownPages';

const topLevelPages = [
    { href: KnownPages.Dashboard, label: 'Nadzorna ploča' },
    { href: KnownPages.Directories, label: 'Direktoriji' },
    { href: KnownPages.Accounts, label: 'Računi' },
    { href: KnownPages.Achievements, label: 'Postignuća' },
    { href: KnownPages.ShoppingCarts, label: 'Košarice' },
    { href: KnownPages.Invoices, label: 'Ponude' },
    { href: KnownPages.Transactions, label: 'Transakcije' },
    { href: KnownPages.Receipts, label: 'Računi fiskalni' },
    { href: KnownPages.Users, label: 'Korisnici' },
    { href: KnownPages.Farms, label: 'Farme' },
    { href: KnownPages.Gardens, label: 'Vrtovi' },
    { href: KnownPages.RaisedBeds, label: 'Gredice' },
    { href: KnownPages.Operations, label: 'Radnje' },
    { href: KnownPages.Inventory, label: 'Inventar' },
    { href: KnownPages.Occasions, label: 'Prigode' },
    { href: KnownPages.Schedule, label: 'Raspored' },
    { href: KnownPages.DeliverySlots, label: 'Dostava termini' },
    { href: KnownPages.DeliveryRequests, label: 'Dostava zahtjevi' },
    { href: KnownPages.CommunicationInbox, label: 'Inbox' },
    { href: KnownPages.CommunicationEmails, label: 'Emailovi' },
    { href: KnownPages.Notifications, label: 'Notifikacije' },
    { href: KnownPages.Feedback, label: 'Povratne informacije' },
    { href: KnownPages.Settings, label: 'Postavke' },
    { href: KnownPages.Sensors, label: 'Senzori' },
    { href: KnownPages.Cache, label: 'Cache' },
    { href: KnownPages.AiAnalytics, label: 'AI analitika' },
] as const;

function resolveCurrentTopLevel(pathname: string) {
    const exact = topLevelPages.find((page) => page.href === pathname);
    if (exact) {
        return exact;
    }

    return topLevelPages.find((page) => pathname.startsWith(`${page.href}/`));
}

export function AdminPageBreadcrumbs() {
    const pathname = usePathname();

    if (!pathname.startsWith('/admin')) {
        return null;
    }

    const currentTopLevel =
        resolveCurrentTopLevel(pathname) ?? topLevelPages[0];

    return (
        <Breadcrumbs
            items={[
                {
                    label: 'Admin',
                    href: KnownPages.Dashboard,
                },
                {
                    label: (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="plain"
                                    className="h-auto p-0 font-medium"
                                    endDecorator={
                                        <ChevronDown className="size-3" />
                                    }
                                >
                                    {currentTopLevel.label}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                {topLevelPages.map((page) => (
                                    <DropdownMenuItem
                                        key={page.href}
                                        href={page.href}
                                    >
                                        {page.label}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ),
                },
            ]}
        />
    );
}
