import type { Route } from 'next';
import type { FarmNavigationDestination } from '../analytics/farmAnalytics';

export type FarmPrimaryNavigationDestination = Extract<
    FarmNavigationDestination,
    'greenhouse' | 'notifications' | 'raised_beds' | 'schedule' | 'today'
>;

export type FarmPrimaryNavigationItem = {
    destination: FarmPrimaryNavigationDestination;
    href: Route;
    label: string;
};

type FarmRouteMatch = {
    href: Route;
    match: 'exact' | 'segment';
};

export const farmPrimaryNavigationItems = [
    {
        destination: 'today',
        href: '/',
        label: 'Danas',
    },
    {
        destination: 'raised_beds',
        href: '/raised-beds',
        label: 'Gredice',
    },
    {
        destination: 'greenhouse',
        href: '/greenhouse',
        label: 'Staklenik',
    },
    {
        destination: 'notifications',
        href: '/notifications',
        label: 'Obavijesti',
    },
    {
        destination: 'schedule',
        href: '/schedule',
        label: 'Raspored',
    },
] satisfies readonly FarmPrimaryNavigationItem[];

const farmSecondaryNavigationRoutes = [
    { href: '/more', match: 'exact' },
    { href: '/operations', match: 'segment' },
    { href: '/plants', match: 'segment' },
    { href: '/payouts', match: 'exact' },
    { href: '/settings', match: 'exact' },
] satisfies readonly FarmRouteMatch[];

const farmPrimaryNavigationRoutes = {
    greenhouse: { href: '/greenhouse', match: 'exact' },
    notifications: { href: '/notifications', match: 'exact' },
    raised_beds: { href: '/raised-beds', match: 'segment' },
    schedule: { href: '/schedule', match: 'exact' },
    today: { href: '/', match: 'exact' },
} satisfies Record<FarmPrimaryNavigationDestination, FarmRouteMatch>;

export const farmWorkspaceRoutes = [
    { href: '/', match: 'exact' },
    { href: '/raised-beds', match: 'segment' },
    { href: '/greenhouse', match: 'exact' },
    { href: '/notifications', match: 'exact' },
    { href: '/schedule', match: 'exact' },
    ...farmSecondaryNavigationRoutes,
] satisfies readonly FarmRouteMatch[];

function matchesFarmRoute(pathname: string, route: FarmRouteMatch) {
    if (pathname === route.href) {
        return true;
    }

    return route.match === 'segment' && pathname.startsWith(`${route.href}/`);
}

export function isFarmWorkspacePath(pathname: string) {
    return farmWorkspaceRoutes.some((route) =>
        matchesFarmRoute(pathname, route),
    );
}

export function isFarmPrimaryNavigationItemActive(
    pathname: string,
    destination: FarmPrimaryNavigationDestination,
) {
    return matchesFarmRoute(pathname, farmPrimaryNavigationRoutes[destination]);
}
