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
    { active: 'schedule', pathname: '/schedule' },
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

const secondaryWorkspacePaths = [
    '/more',
    '/operations',
    '/operations/701',
    '/plants',
    '/plants/901',
    '/payouts',
    '/settings',
] as const;

for (const pathname of secondaryWorkspacePaths) {
    test(`${pathname} stays inside the shell without selecting an unrelated primary page`, () => {
        expect(isFarmWorkspacePath(pathname)).toBe(true);
        expect(
            farmPrimaryNavigationItems.some((item) =>
                isFarmPrimaryNavigationItemActive(pathname, item.destination),
            ),
        ).toBe(false);
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
