'use client';

import type { PropsWithChildren } from 'react';
import { FarmAuthenticatedNavigation } from './FarmAuthenticatedNavigation';

type FarmAuthenticatedShellProps = PropsWithChildren<{
    authenticated?: boolean;
    pathname: string;
}>;

export function FarmAuthenticatedShell({
    authenticated = true,
    children,
    pathname,
}: FarmAuthenticatedShellProps) {
    return (
        <div className="flex min-w-0 flex-1 flex-col" data-farm-app-shell>
            <div
                className={`min-w-0 flex-1 [padding-top:var(--farm-safe-area-top,0px)] [padding-left:var(--farm-safe-area-left,0px)] [padding-right:var(--farm-safe-area-right,0px)] md:pt-0 ${
                    authenticated
                        ? 'pb-[calc(var(--farm-mobile-navigation-height,3.5rem)+var(--farm-safe-area-bottom,0px)+1px)] md:pb-[var(--farm-safe-area-bottom,0px)]'
                        : 'pb-[var(--farm-safe-area-bottom,0px)]'
                }`}
                data-farm-shell-content
            >
                {children}
            </div>
            {authenticated ? (
                <FarmAuthenticatedNavigation pathname={pathname} />
            ) : null}
        </div>
    );
}
