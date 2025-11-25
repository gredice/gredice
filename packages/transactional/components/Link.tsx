import { Link as RELink } from '@react-email/components';
import type { PropsWithChildren } from 'react';

export function Link({ children, href }: PropsWithChildren<{ href: string }>) {
    return (
        <RELink href={href} className="text-[#684B31] no-underline">
            {children}
        </RELink>
    );
}
