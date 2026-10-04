'use client';

import { SidePanelLayout } from '@gredice/ui/SidePanelLayout';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { isAdminChromeHiddenPath } from './adminChromeVisibility';
import { DesktopNav } from './DesktopNav';
import { useDesktopNav } from './DesktopNavProvider';

export function AdminDesktopFrame({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const { isExpanded } = useDesktopNav();
    const showChrome = !isAdminChromeHiddenPath(pathname);

    return (
        <SidePanelLayout
            className="min-h-full md:p-4"
            data-gredice-admin-frame
            desktopBreakpoint="md"
            leftOpen={showChrome && isExpanded}
            leftPanel={showChrome ? <DesktopNav /> : null}
            leftPanelClassName="hidden md:block"
            leftWidth="18rem"
        >
            <div className="min-h-full" data-gredice-admin-content>
                {children}
            </div>
        </SidePanelLayout>
    );
}
