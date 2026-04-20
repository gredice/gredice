'use client';

import { RaisedBedIcon } from '@gredice/ui/RaisedBedIcon';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import {
    AI,
    ArrowDown,
    Bank,
    Calendar,
    Euro,
    Fence,
    File,
    Hammer,
    Home,
    Inbox,
    Mail,
    Map as MapIcon,
    Megaphone,
    Settings,
    ShoppingCart,
    SmileHappy,
    Success,
    Tally3,
    Truck,
    User,
} from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@signalco/ui-primitives/Menu';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { KnownPages } from '../../../src/KnownPages';
import { adminBreadcrumbPages, adminPages } from './adminPages';

function resolveCurrentTopLevel(pathname: string) {
    const exact = adminBreadcrumbPages.find((page) => page.href === pathname);
    if (exact) {
        return exact;
    }

    return adminBreadcrumbPages.reduce<
        (typeof adminBreadcrumbPages)[number] | undefined
    >((bestMatch, page) => {
        if (!pathname.startsWith(`${page.href}/`)) {
            return bestMatch;
        }

        if (!bestMatch || page.href.length > bestMatch.href.length) {
            return page;
        }

        return bestMatch;
    }, undefined);
}

const breadcrumbSections: {
    title: string;
    pages: {
        href: string;
        label: string;
        icon: ReactNode;
    }[];
}[] = [
    {
        title: 'Osnovno',
        pages: [
            {
                ...adminPages.Dashboard,
                icon: <Home className="size-4" />,
            },
        ],
    },
    {
        title: 'Zapisi',
        pages: [
            {
                ...adminPages.Directories,
                icon: <File className="size-4" />,
            },
        ],
    },
    {
        title: 'Administracija',
        pages: [
            { ...adminPages.Accounts, icon: <Bank className="size-4" /> },
            {
                ...adminPages.Achievements,
                icon: <Success className="size-4" />,
            },
            {
                ...adminPages.ShoppingCarts,
                icon: <ShoppingCart className="size-4" />,
            },
            { ...adminPages.Invoices, icon: <File className="size-4" /> },
            {
                ...adminPages.Transactions,
                icon: <Euro className="size-4" />,
            },
            { ...adminPages.Receipts, icon: <File className="size-4" /> },
            { ...adminPages.Users, icon: <User className="size-4" /> },
            { ...adminPages.Farms, icon: <MapIcon className="size-4" /> },
            { ...adminPages.Gardens, icon: <Fence className="size-4" /> },
            {
                ...adminPages.RaisedBeds,
                icon: <RaisedBedIcon className="size-4" physicalId={null} />,
            },
            { ...adminPages.Operations, icon: <Hammer className="size-4" /> },
        ],
    },
    {
        title: 'Upravljanje',
        pages: [
            { ...adminPages.Inventory, icon: <Tally3 className="size-4" /> },
            { ...adminPages.Occasions, icon: <Calendar className="size-4" /> },
            { ...adminPages.Schedule, icon: <Calendar className="size-4" /> },
            { ...adminPages.DeliverySlots, icon: <Truck className="size-4" /> },
            {
                ...adminPages.DeliveryRequests,
                icon: <Truck className="size-4" />,
            },
        ],
    },
    {
        title: 'Komunikacija',
        pages: [
            {
                ...adminPages.CommunicationInbox,
                icon: <Inbox className="size-4" />,
            },
            {
                ...adminPages.CommunicationEmails,
                icon: <Mail className="size-4" />,
            },
            {
                ...adminPages.CommunicationSlack,
                icon: <Mail className="size-4" />,
            },
            {
                ...adminPages.Notifications,
                icon: <Megaphone className="size-4" />,
            },
            { ...adminPages.Feedback, icon: <SmileHappy className="size-4" /> },
        ],
    },
    {
        title: 'Postavke',
        pages: [
            { ...adminPages.Settings, icon: <Settings className="size-4" /> },
        ],
    },
    {
        title: 'Sustavi',
        pages: [
            { ...adminPages.Sensors, icon: <File className="size-4" /> },
            { ...adminPages.Cache, icon: <File className="size-4" /> },
            { ...adminPages.AiAnalytics, icon: <AI className="size-4" /> },
        ],
    },
];

export function AdminPageBreadcrumbs() {
    const pathname = usePathname();

    if (!pathname.startsWith('/admin')) {
        return null;
    }

    const currentTopLevel =
        resolveCurrentTopLevel(pathname) ?? adminBreadcrumbPages[0];

    return (
        <>
            <h1 className="sr-only">{currentTopLevel.label}</h1>
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
                                            <ArrowDown className="size-3" />
                                        }
                                    >
                                        {currentTopLevel.label}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    {breadcrumbSections.map(
                                        (section, index) => (
                                            <div key={section.title}>
                                                <DropdownMenuLabel className="text-muted-foreground text-xs">
                                                    {section.title}
                                                </DropdownMenuLabel>
                                                {section.pages.map((page) => (
                                                    <DropdownMenuItem
                                                        key={page.href}
                                                        href={page.href}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            {page.icon}
                                                            <span>
                                                                {page.label}
                                                            </span>
                                                        </div>
                                                    </DropdownMenuItem>
                                                ))}
                                                {index <
                                                    breadcrumbSections.length -
                                                        1 && (
                                                    <DropdownMenuSeparator />
                                                )}
                                            </div>
                                        ),
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ),
                    },
                ]}
            />
        </>
    );
}
