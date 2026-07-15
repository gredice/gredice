import { expect, test } from '@playwright/test';
import {
    type FarmPrimaryNavigationDestination,
    farmPrimaryNavigationItems,
    isFarmPrimaryNavigationItemActive,
    isFarmWorkspacePath,
} from './farmNavigation';

const workspaceRouteCases = [
    { active: 'today', pathname: '/' },
    { active: 'raised_beds', pathname: '/raised-beds' },
    { active: 'raised_beds', pathname: '/raised-beds/42' },
    { active: 'greenhouse', pathname: '/greenhouse' },
    { active: 'notifications', pathname: '/notifications' },
    { active: 'more', pathname: '/more' },
    { active: 'more', pathname: '/schedule' },
    { active: 'more', pathname: '/operations' },
    { active: 'more', pathname: '/operations/701' },
    { active: 'more', pathname: '/plants' },
    { active: 'more', pathname: '/plants/901' },
    { active: 'more', pathname: '/payouts' },
    { active: 'more', pathname: '/settings' },
] satisfies readonly {
    active: FarmPrimaryNavigationDestination;
    pathname: string;
}[];

for (const routeCase of workspaceRouteCases) {
    test(`${routeCase.pathname} stays inside the shell with ${routeCase.active} active`, () => {
        expect(isFarmWorkspacePath(routeCase.pathname)).toBe(true);

        const activeDestinations = farmPrimaryNavigationItems
            .filter((item) =>
                isFarmPrimaryNavigationItemActive(
                    routeCase.pathname,
                    item.destination,
                ),
            )
            .map((item) => item.destination);

        expect(activeDestinations).toEqual([routeCase.active]);
    });
}

const excludedPaths = [
    '/prijava',
    '/debug',
    '/debug/auth',
    '/raised-beds-extra',
    '/greenhouse/unknown',
    '/notifications/unknown',
    '/more/unknown',
    '/schedule/unknown',
    '/payouts/unknown',
    '/settings/unknown',
    '/operations-extra',
    '/plants-extra',
] as const;

for (const pathname of excludedPaths) {
    test(`${pathname} does not accidentally render or activate the farm shell`, () => {
        expect(isFarmWorkspacePath(pathname)).toBe(false);
        expect(
            farmPrimaryNavigationItems.some((item) =>
                isFarmPrimaryNavigationItemActive(pathname, item.destination),
            ),
        ).toBe(false);
    });
}
