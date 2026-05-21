import NextLink from 'next/link';
import type { ComponentProps } from 'react';

export type LinkProps = Omit<ComponentProps<typeof NextLink>, 'href'> & {
    href: ComponentProps<typeof NextLink>['href'] | string;
};

export function Link({ href, ...rest }: LinkProps) {
    return (
        <NextLink
            href={href as ComponentProps<typeof NextLink>['href']}
            {...rest}
        />
    );
}
