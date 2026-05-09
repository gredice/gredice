import type { PropsWithChildren } from 'react';
import { Link as RELink } from 'react-email';

export function Link({ children, href }: PropsWithChildren<{ href: string }>) {
    return (
        <RELink href={href} className="text-[#684B31] no-underline">
            {children}
        </RELink>
    );
}
