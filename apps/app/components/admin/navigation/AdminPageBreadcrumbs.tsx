'use client';

import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { usePathname } from 'next/navigation';
import { KnownPages } from '../../../src/KnownPages';
import {
    AdminBreadcrumbLevelSelector,
    resolveCurrentTopLevel,
} from './AdminBreadcrumbLevelSelector';
import { adminBreadcrumbPages } from './adminPages';

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
                        label: <AdminBreadcrumbLevelSelector />,
                    },
                ]}
            />
        </>
    );
}
