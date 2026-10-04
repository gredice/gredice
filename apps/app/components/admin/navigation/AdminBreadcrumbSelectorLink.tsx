'use client';

import { Link } from '@gredice/ui/Link';
import type { ReactNode } from 'react';
import { adminBreadcrumbSelectorLinkClassName } from './adminBreadcrumbStyles';

export function AdminBreadcrumbSelectorLink({
    children,
    href,
}: {
    children: ReactNode;
    href: string;
}) {
    return (
        <Link className={adminBreadcrumbSelectorLinkClassName} href={href}>
            <span className="min-w-0 truncate">{children}</span>
        </Link>
    );
}
