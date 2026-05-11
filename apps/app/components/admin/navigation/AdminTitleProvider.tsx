'use client';

import { usePathname } from 'next/navigation';
import {
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { formatAdminDocumentTitle } from '../../../src/adminDocumentTitle';
import { AdminTitleContext } from './AdminTitleContext';
import { resolveAdminRouteTitle } from './adminRouteTitle';
import { NavContext } from './NavContext';

export function AdminTitleProvider({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const navContext = useContext(NavContext);
    const [titleOverride, setTitleOverride] = useState<{
        pathname: string;
        title: string | null;
    } | null>(null);

    const routeTitle = useMemo(
        () => resolveAdminRouteTitle(pathname, navContext),
        [pathname, navContext],
    );
    const scopedTitleOverride =
        titleOverride?.pathname === pathname ? titleOverride.title : null;
    const title = scopedTitleOverride ?? routeTitle;

    const setCurrentPageTitle = useCallback(
        (nextTitle: string | null) => {
            setTitleOverride({ pathname, title: nextTitle });
        },
        [pathname],
    );

    useEffect(() => {
        document.title = formatAdminDocumentTitle(title);
    }, [title]);

    return (
        <AdminTitleContext.Provider value={setCurrentPageTitle}>
            {children}
        </AdminTitleContext.Provider>
    );
}
