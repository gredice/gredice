'use client';

import { usePathname } from 'next/navigation';
import { AdminPageBreadcrumbs } from './AdminPageBreadcrumbs';
import { useAdminPageHeaderContext } from './AdminPageHeaderContext';
import { DesktopNavToggle } from './DesktopNavToggle';
import { MobileNav } from './MobileNav';

export function AdminPageCardHeader() {
    const pathname = usePathname();
    const { activeHeaderId, setSlotElement } = useAdminPageHeaderContext();
    const showHeaderContent = pathname.startsWith('/admin');

    return (
        <div className="mb-4 flex min-h-9 items-center gap-2">
            <MobileNav />
            <DesktopNavToggle />
            {showHeaderContent && (
                <>
                    <div
                        className="h-4 w-px shrink-0 bg-border"
                        aria-hidden="true"
                    />
                    <div
                        className="flex min-w-0 flex-1 items-center justify-between gap-2 overflow-hidden"
                        ref={setSlotElement}
                    >
                        {!activeHeaderId && (
                            <div className="min-w-0 overflow-hidden">
                                <AdminPageBreadcrumbs />
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
