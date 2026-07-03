'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MouseEvent, ReactNode } from 'react';
import { startPublicGardenViewTransition } from './PublicGardenViewTransitionProvider';

type PublicGardenTransitionLinkProps = {
    ariaLabel: string;
    children: ReactNode;
    className?: string;
    href: Route;
};

function shouldUseViewTransition(event: MouseEvent<HTMLAnchorElement>) {
    if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.altKey ||
        event.ctrlKey ||
        event.shiftKey
    ) {
        return false;
    }

    const anchor = event.currentTarget;
    return (
        anchor.target !== '_blank' && anchor.origin === window.location.origin
    );
}

export function PublicGardenTransitionLink({
    ariaLabel,
    children,
    className,
    href,
}: PublicGardenTransitionLinkProps) {
    const router = useRouter();

    function handleClick(event: MouseEvent<HTMLAnchorElement>) {
        if (!shouldUseViewTransition(event)) {
            return;
        }

        event.preventDefault();
        startPublicGardenViewTransition(() => {
            router.push(href);
        });
    }

    return (
        <Link
            aria-label={ariaLabel}
            className={className}
            href={href}
            onClick={handleClick}
        >
            {children}
        </Link>
    );
}
