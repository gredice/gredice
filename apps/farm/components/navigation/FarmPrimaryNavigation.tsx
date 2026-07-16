import { Inbox, ListTodo, MoreHorizontal, Sprout } from '@gredice/ui/icons';
import { RaisedBedSimpleIcon } from '@gredice/ui/RaisedBedSimpleIcon';
import Link from 'next/link';
import type { ComponentType, SVGProps } from 'react';
import type { FarmNavigationSource } from '../analytics/farmAnalytics';
import {
    type FarmPrimaryNavigationDestination,
    farmPrimaryNavigationItems,
    isFarmPrimaryNavigationItemActive,
} from './farmNavigation';

type FarmPrimaryNavigationProps = {
    hasUnreadNotifications: boolean;
    pathname: string;
};

type FarmNavigationIcon = ComponentType<SVGProps<SVGSVGElement>>;

const farmNavigationIcons = {
    greenhouse: Sprout,
    more: MoreHorizontal,
    notifications: Inbox,
    raised_beds: RaisedBedSimpleIcon,
    today: ListTodo,
} satisfies Record<FarmPrimaryNavigationDestination, FarmNavigationIcon>;

const mobileNavigationSource = 'mobile_bottom' satisfies FarmNavigationSource;
const desktopNavigationSource = 'desktop_top' satisfies FarmNavigationSource;

export function FarmPrimaryNavigation({
    hasUnreadNotifications,
    pathname,
}: FarmPrimaryNavigationProps) {
    return (
        <>
            <nav
                aria-label="Glavna navigacija farme"
                className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden [padding-bottom:var(--farm-safe-area-bottom,0px)] [padding-left:var(--farm-safe-area-left,0px)] [padding-right:var(--farm-safe-area-right,0px)]"
                data-farm-navigation="mobile"
            >
                <ul className="grid min-h-[var(--farm-mobile-navigation-height,3.5rem)] grid-cols-5">
                    {farmPrimaryNavigationItems.map((item) => {
                        const Icon = farmNavigationIcons[item.destination];
                        const isActive = isFarmPrimaryNavigationItemActive(
                            pathname,
                            item.destination,
                        );
                        const hasUnread =
                            item.destination === 'notifications' &&
                            hasUnreadNotifications;

                        return (
                            <li className="min-w-0" key={item.destination}>
                                <Link
                                    aria-current={isActive ? 'page' : undefined}
                                    aria-label={
                                        hasUnread
                                            ? `${item.label}, ima nepročitanih`
                                            : undefined
                                    }
                                    className={`relative flex min-h-[var(--farm-mobile-navigation-height,3.5rem)] min-w-0 flex-col items-center justify-center gap-0.5 outline-hidden transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                                        isActive
                                            ? 'bg-muted font-semibold text-foreground'
                                            : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                                    }`}
                                    data-farm-analytics="navigation"
                                    data-farm-navigation-destination={
                                        item.destination
                                    }
                                    data-farm-navigation-source={
                                        mobileNavigationSource
                                    }
                                    href={item.href}
                                >
                                    <span
                                        aria-hidden
                                        className={`absolute top-0 h-0.5 w-5 rounded-full ${
                                            isActive
                                                ? 'bg-primary'
                                                : 'bg-transparent'
                                        }`}
                                    />
                                    <Icon
                                        aria-hidden
                                        className="size-5 shrink-0"
                                    />
                                    <span className="max-w-full truncate text-[0.6875rem] leading-none tracking-tight">
                                        {item.label}
                                    </span>
                                    {hasUnread ? (
                                        <span
                                            aria-hidden
                                            className="absolute top-1 right-0.5 rounded-full bg-primary px-1 py-0.5 font-semibold text-[0.5rem] text-primary-foreground leading-none"
                                        >
                                            Novo
                                        </span>
                                    ) : null}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            <nav
                aria-label="Glavna navigacija farme"
                className="sticky top-0 z-40 hidden border-b bg-background/95 backdrop-blur [padding-top:var(--farm-safe-area-top,0px)] md:order-first md:block"
                data-farm-navigation="desktop"
            >
                <ul className="mx-auto flex min-h-13 w-full max-w-5xl min-w-0 items-center gap-1 py-1 [padding-left:calc(1rem+var(--farm-safe-area-left,0px))] [padding-right:calc(1rem+var(--farm-safe-area-right,0px))]">
                    {farmPrimaryNavigationItems.map((item) => {
                        const Icon = farmNavigationIcons[item.destination];
                        const isActive = isFarmPrimaryNavigationItemActive(
                            pathname,
                            item.destination,
                        );
                        const hasUnread =
                            item.destination === 'notifications' &&
                            hasUnreadNotifications;

                        return (
                            <li key={item.destination}>
                                <Link
                                    aria-current={isActive ? 'page' : undefined}
                                    aria-label={
                                        hasUnread
                                            ? `${item.label}, ima nepročitanih`
                                            : undefined
                                    }
                                    className={`relative flex min-h-11 items-center gap-2 rounded-md px-3 text-sm outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                                        isActive
                                            ? 'bg-muted font-semibold text-foreground'
                                            : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                                    }`}
                                    data-farm-analytics="navigation"
                                    data-farm-navigation-destination={
                                        item.destination
                                    }
                                    data-farm-navigation-source={
                                        desktopNavigationSource
                                    }
                                    href={item.href}
                                >
                                    <Icon
                                        aria-hidden
                                        className="size-4 shrink-0"
                                    />
                                    <span>{item.label}</span>
                                    {hasUnread ? (
                                        <span
                                            aria-hidden
                                            className="rounded-full bg-primary px-1.5 py-0.5 font-semibold text-[0.625rem] text-primary-foreground leading-none"
                                        >
                                            Novo
                                        </span>
                                    ) : null}
                                    <span
                                        aria-hidden
                                        className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full ${
                                            isActive
                                                ? 'bg-primary'
                                                : 'bg-transparent'
                                        }`}
                                    />
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>
        </>
    );
}
