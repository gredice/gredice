export type FarmAnalyticsRouteGroup =
    | 'authentication'
    | 'debug'
    | 'greenhouse'
    | 'more'
    | 'notifications'
    | 'operations'
    | 'other'
    | 'payouts'
    | 'plants'
    | 'raised_beds'
    | 'schedule'
    | 'settings'
    | 'today';

type FarmAnalyticsPage = {
    path: string;
    routeGroup: FarmAnalyticsRouteGroup;
};

function isRouteOrDescendant(pathname: string, route: string) {
    return pathname === route || pathname.startsWith(`${route}/`);
}

export function getFarmAnalyticsPage(pathname: string): FarmAnalyticsPage {
    if (pathname === '/') {
        return { path: '/', routeGroup: 'today' };
    }
    if (isRouteOrDescendant(pathname, '/raised-beds')) {
        return {
            path:
                pathname === '/raised-beds'
                    ? '/raised-beds'
                    : '/raised-beds/:raisedBedId',
            routeGroup: 'raised_beds',
        };
    }
    if (pathname === '/greenhouse') {
        return { path: '/greenhouse', routeGroup: 'greenhouse' };
    }
    if (pathname === '/notifications') {
        return { path: '/notifications', routeGroup: 'notifications' };
    }
    if (pathname === '/more') {
        return { path: '/more', routeGroup: 'more' };
    }
    if (pathname === '/schedule') {
        return { path: '/schedule', routeGroup: 'schedule' };
    }
    if (isRouteOrDescendant(pathname, '/operations')) {
        return {
            path:
                pathname === '/operations'
                    ? '/operations'
                    : '/operations/:operationId',
            routeGroup: 'operations',
        };
    }
    if (isRouteOrDescendant(pathname, '/plants')) {
        return {
            path: pathname === '/plants' ? '/plants' : '/plants/:plantSortId',
            routeGroup: 'plants',
        };
    }
    if (pathname === '/payouts') {
        return { path: '/payouts', routeGroup: 'payouts' };
    }
    if (pathname === '/settings') {
        return { path: '/settings', routeGroup: 'settings' };
    }
    if (isRouteOrDescendant(pathname, '/prijava')) {
        return { path: '/prijava', routeGroup: 'authentication' };
    }
    if (isRouteOrDescendant(pathname, '/debug')) {
        return { path: '/debug', routeGroup: 'debug' };
    }

    return { path: '/other', routeGroup: 'other' };
}
