import type { Route } from 'next';
import type { FarmNotification } from './notificationTypes';

export type FarmNotificationNavigationTarget =
    | {
          href: Route;
          kind: 'internal';
      }
    | {
          href: string;
          kind: 'external';
      };

const farmRoutePrefixes = [
    '/',
    '/greenhouse',
    '/notifications',
    '/operations',
    '/payouts',
    '/plants',
    '/raised-beds',
    '/schedule',
    '/settings',
];

const farmHostnames = new Set([
    'farma.gredice.com',
    'farma.gredice.test',
    'localhost',
    '127.0.0.1',
]);

const gardenHostnames = new Set(['vrt.gredice.com', 'vrt.gredice.test']);

function isFarmPath(pathname: string) {
    return farmRoutePrefixes.some((prefix) => {
        if (prefix === '/') {
            return pathname === '/';
        }

        return pathname === prefix || pathname.startsWith(`${prefix}/`);
    });
}

function internalTarget(href: string): FarmNotificationNavigationTarget {
    return {
        href: href as Route,
        kind: 'internal',
    };
}

function normalizeFarmRelativeUrl(url: URL) {
    const href = `${url.pathname}${url.search}${url.hash}`;
    return internalTarget(href);
}

function resolveUrlTarget(value: string | null) {
    if (!value) {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed || trimmed.startsWith('//')) {
        return null;
    }

    try {
        const url = new URL(trimmed, 'https://farma.gredice.com');

        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return null;
        }

        if (gardenHostnames.has(url.hostname)) {
            return null;
        }

        if (farmHostnames.has(url.hostname) && isFarmPath(url.pathname)) {
            return normalizeFarmRelativeUrl(url);
        }

        if (url.origin === 'https://farma.gredice.com') {
            return isFarmPath(url.pathname)
                ? normalizeFarmRelativeUrl(url)
                : null;
        }

        return {
            href: url.toString(),
            kind: 'external',
        } satisfies FarmNotificationNavigationTarget;
    } catch {
        return null;
    }
}

export function resolveFarmNotificationNavigationTarget(
    notification: Pick<
        FarmNotification,
        'actionUrl' | 'linkUrl' | 'raisedBedId'
    >,
): FarmNotificationNavigationTarget | null {
    if (
        typeof notification.raisedBedId === 'number' &&
        Number.isInteger(notification.raisedBedId) &&
        notification.raisedBedId > 0
    ) {
        return internalTarget(`/raised-beds/${notification.raisedBedId}`);
    }

    return (
        resolveUrlTarget(notification.linkUrl) ??
        resolveUrlTarget(notification.actionUrl)
    );
}
