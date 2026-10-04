import type { Route } from 'next';
import type { ReactNode } from 'react';

type PublicGardenTransitionLinkProps = {
    ariaLabel: string;
    children: ReactNode;
    className?: string;
    href: Route;
};

export function PublicGardenTransitionLink({
    ariaLabel,
    children,
    className,
    href,
}: PublicGardenTransitionLinkProps) {
    return (
        <a aria-label={ariaLabel} className={className} href={href}>
            {children}
        </a>
    );
}
