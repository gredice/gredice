import { expect, test } from '@playwright/test';
import { getFarmAnalyticsPage } from './farmAnalyticsPage';

const currentIndexRoutes = [
    ['/', '/', 'today'],
    ['/raised-beds', '/raised-beds', 'raised_beds'],
    ['/greenhouse', '/greenhouse', 'greenhouse'],
    ['/notifications', '/notifications', 'notifications'],
    ['/more', '/more', 'more'],
    ['/schedule', '/schedule', 'schedule'],
    ['/operations', '/operations', 'operations'],
    ['/plants', '/plants', 'plants'],
    ['/payouts', '/payouts', 'payouts'],
    ['/settings', '/settings', 'settings'],
] as const;

for (const [pathname, path, routeGroup] of currentIndexRoutes) {
    test(`normalizes the current ${pathname} route`, () => {
        expect(getFarmAnalyticsPage(pathname)).toEqual({ path, routeGroup });
    });
}

test('redacts identifiers from raised-bed, operation, and plant detail routes', () => {
    expect(getFarmAnalyticsPage('/raised-beds/north-field-42')).toEqual({
        path: '/raised-beds/:raisedBedId',
        routeGroup: 'raised_beds',
    });
    expect(getFarmAnalyticsPage('/operations/private-operation-17')).toEqual({
        path: '/operations/:operationId',
        routeGroup: 'operations',
    });
    expect(getFarmAnalyticsPage('/plants/heirloom-tomato-8')).toEqual({
        path: '/plants/:plantSortId',
        routeGroup: 'plants',
    });
});

test('redacts every descendant segment instead of leaking it into analytics', () => {
    expect(getFarmAnalyticsPage('/operations/17/private-proof')).toEqual({
        path: '/operations/:operationId',
        routeGroup: 'operations',
    });
});

test('uses a URL pathname so search values and fragments never reach analytics', () => {
    const url = new URL(
        'https://farma.gredice.com/raised-beds/north-field-42?note=private#photos',
    );

    expect(url.pathname).toBe('/raised-beds/north-field-42');
    expect(getFarmAnalyticsPage(url.pathname)).toEqual({
        path: '/raised-beds/:raisedBedId',
        routeGroup: 'raised_beds',
    });
});

test('normalizes authentication and debug descendants', () => {
    expect(getFarmAnalyticsPage('/prijava/google-prijava/povratak')).toEqual({
        path: '/prijava',
        routeGroup: 'authentication',
    });
    expect(getFarmAnalyticsPage('/debug/labels')).toEqual({
        path: '/debug',
        routeGroup: 'debug',
    });
});

test('normalizes unknown and non-page routes without exposing their path', () => {
    for (const pathname of [
        '/.well-known/security.txt',
        '/api/users/current',
        '/not-a-farm-page/private-value',
    ]) {
        expect(getFarmAnalyticsPage(pathname)).toEqual({
            path: '/other',
            routeGroup: 'other',
        });
    }
});

test('matches complete route segments instead of look-alike prefixes', () => {
    for (const pathname of [
        '/debugger',
        '/greenhouses',
        '/more-options',
        '/notifications-archive',
        '/operations-log',
        '/payouts-report',
        '/plants-and-seeds',
        '/prijava-extra',
        '/raised-beds-private',
        '/scheduled',
        '/settings-old',
    ]) {
        expect(getFarmAnalyticsPage(pathname)).toEqual({
            path: '/other',
            routeGroup: 'other',
        });
    }
});
