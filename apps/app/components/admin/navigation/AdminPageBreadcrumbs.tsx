'use client';

import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { ArrowDown } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@signalco/ui-primitives/Menu';
import { usePathname } from 'next/navigation';
import { KnownPages } from '../../../src/KnownPages';
import { adminBreadcrumbPages } from './adminPages';

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
                                    {adminBreadcrumbPages.map((page) => (
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
        </>
    );
}
