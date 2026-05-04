'use client';

import { usePathname } from 'next/navigation';
import { shouldUseInlineBreadcrumbs } from './AdminBreadcrumbLevelSelector';
import { AdminPageBreadcrumbs } from './AdminPageBreadcrumbs';
import { DesktopNavToggle } from './DesktopNavToggle';
import { MobileNav } from './MobileNav';

export function AdminPageCardHeader() {
    const pathname = usePathname();
    const showBreadcrumbs =
        pathname.startsWith('/admin') && !shouldUseInlineBreadcrumbs(pathname);

    return (
        <div className="mb-4 flex min-h-9 items-center gap-2">
            <MobileNav />
            <DesktopNavToggle />
            {showBreadcrumbs && (
                <>
                    <div
                        className="h-4 w-px shrink-0 bg-border"
                        aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1 overflow-hidden">
                        <AdminPageBreadcrumbs />
                    </div>
                </>
            )}
        </div>
    );
}
