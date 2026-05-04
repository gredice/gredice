'use client';

import { useDesktopNav } from './DesktopNavProvider';
import { Nav } from './Nav';

export function DesktopNav() {
    const { isExpanded } = useDesktopNav();

    if (!isExpanded) {
        return null;
    }

    return (
        <aside className="hidden md:block md:w-72 md:shrink-0">
            <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border bg-background/95 p-3 shadow-sm">
                <Nav idPrefix="desktop-admin-nav" />
            </div>
        </aside>
    );
}
