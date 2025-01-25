import * as React from 'react';
import { PropsWithChildren } from 'react';
import { Link as RELink } from '@react-email/components';

export function Link({ children, href }: PropsWithChildren<{ href: string; }>) {
    return (
        <RELink
            href={href}
            className="text-[#684B31] no-underline"
        >
            {children}
        </RELink>
    );
}