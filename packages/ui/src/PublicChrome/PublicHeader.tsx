'use client';

import type { ReactNode } from 'react';
import { Button } from '../Button';
import { PageNav } from '../Nav';
import { Logotype } from './Logotype';
import {
    type PublicChromeLinkMode,
    PublicPagePaths,
    publicChromeHref,
} from './links';
import { NavSearch } from './NavSearch';
import { NavUserButton } from './NavUserButton';

function NavLinkButton({
    href,
    children,
    className,
}: Readonly<{
    href: string;
    children: ReactNode;
    className?: string;
}>) {
    return (
        <Button
            href={href}
            variant="plain"
            size="sm"
            className={[
                'h-10 w-full shrink-0 justify-start whitespace-nowrap px-4 text-sm md:h-9 md:w-auto md:justify-center md:px-2.5',
                className,
            ]
                .filter(Boolean)
                .join(' ')}
        >
            {children}
        </Button>
    );
}

export function PublicHeader({
    linkMode = 'relative',
    apiBasePath = '/api/gredice',
}: {
    linkMode?: PublicChromeLinkMode;
    apiBasePath?: string;
}) {
    return (
        <div className="z-20">
            <PageNav
                logo={
                    <Logotype
                        className="h-[38px] w-[128px] sm:w-[140px]"
                        aria-label="Gredice"
                    />
                }
                logoHref={publicChromeHref(PublicPagePaths.Landing, linkMode)}
                links={[
                    <NavLinkButton
                        key="raised-beds"
                        href={publicChromeHref(
                            PublicPagePaths.RaisedBeds,
                            linkMode,
                        )}
                    >
                        Gredica
                    </NavLinkButton>,
                    <NavLinkButton
                        key="plants"
                        href={publicChromeHref(
                            PublicPagePaths.Plants,
                            linkMode,
                        )}
                    >
                        Biljke
                    </NavLinkButton>,
                    <NavLinkButton
                        key="news"
                        href={publicChromeHref(PublicPagePaths.News, linkMode)}
                    >
                        Novosti
                    </NavLinkButton>,
                    <NavLinkButton
                        key="faq"
                        href={publicChromeHref(PublicPagePaths.FAQ, linkMode)}
                    >
                        Česta pitanja
                    </NavLinkButton>,
                ]}
            >
                <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                    <NavSearch
                        className="shrink-0 md:-ml-1 xl:absolute xl:left-1/2 xl:top-1/2 xl:ml-0 xl:-translate-x-1/2 xl:-translate-y-1/2"
                        linkMode={linkMode}
                        apiBasePath={apiBasePath}
                    />
                    <NavUserButton
                        href={PublicPagePaths.GardenApp}
                        apiBasePath={apiBasePath}
                    />
                </div>
            </PageNav>
        </div>
    );
}
