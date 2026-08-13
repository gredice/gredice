import { getRaisedBedCloseupUrl } from '@gredice/js/urls';

const DELIVERY_TRACKER_ORIGIN = 'https://dostava.gredice.com';
const GREDICE_OPERATIONS_ORIGIN = 'https://www.gredice.com';
const DELIVERY_SURVEY_TYPEFORM_URL = 'https://form.typeform.com/to/X727vyBk';
const GARDEN_APP_ORIGINS = new Set([
    'https://vrt.gredice.com',
    'https://vrt.gredice.test',
]);

type NavigateNotificationLinkOptions = {
    href: string;
    currentOrigin: string;
    assign: (url: string) => void;
    push: (url: string) => void;
};

export function resolveRaisedBedNotificationHref({
    currentOrigin,
    fieldTab,
    linkUrl,
    raisedBedName,
}: {
    currentOrigin: string;
    fieldTab?: 'diary' | 'lifecycle' | 'operations';
    linkUrl: string | null | undefined;
    raisedBedName: string | null | undefined;
}) {
    const notificationHref = linkUrl?.trim();
    if (notificationHref) {
        const resolvedNotificationHref = resolveRaisedBedLinkForCurrentGarden(
            notificationHref,
            currentOrigin,
        );
        if (resolvedNotificationHref) {
            return addRaisedBedFieldTab(
                resolvedNotificationHref,
                currentOrigin,
                fieldTab,
            );
        }
    }

    return raisedBedName
        ? resolveRaisedBedLinkForCurrentGarden(
              getRaisedBedCloseupUrl(raisedBedName),
              currentOrigin,
          )
        : null;
}

function addRaisedBedFieldTab(
    href: string,
    currentOrigin: string,
    fieldTab: 'diary' | 'lifecycle' | 'operations' | undefined,
) {
    if (!fieldTab) return href;

    try {
        const targetUrl = new URL(href, currentOrigin);
        const fieldNumber = Number(targetUrl.searchParams.get('polje'));
        if (!Number.isSafeInteger(fieldNumber) || fieldNumber <= 0) {
            return href;
        }
        targetUrl.searchParams.set('polje-kartica', fieldTab);
        return href.startsWith('http')
            ? targetUrl.toString()
            : `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
    } catch {
        return href;
    }
}

function hasExplicitPort(rawUrl: string) {
    const authority = rawUrl.match(
        /^(?:[a-z][a-z\d+.-]*:)?\/\/([^/?#]*)/i,
    )?.[1];
    if (!authority) return false;
    const host = authority.split('@').at(-1);
    return typeof host === 'string' && /:\d+$/.test(host);
}

function isGrediceOperationsUrl(url: URL) {
    return (
        url.origin === GREDICE_OPERATIONS_ORIGIN &&
        (url.pathname === '/radnje' || url.pathname.startsWith('/radnje/'))
    );
}

function isDeliverySurveyTypeformUrl(url: URL) {
    return url.toString() === DELIVERY_SURVEY_TYPEFORM_URL;
}

function resolveRaisedBedLinkForCurrentGarden(
    href: string,
    currentOrigin: string,
) {
    if (resolveNotificationNavigationTarget(href, currentOrigin)) {
        return href.trim();
    }

    try {
        const targetUrl = new URL(href.trim());
        if (
            targetUrl.username ||
            targetUrl.password ||
            hasExplicitPort(href) ||
            !GARDEN_APP_ORIGINS.has(targetUrl.origin)
        ) {
            return null;
        }
        return `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
    } catch {
        return null;
    }
}

function resolveNotificationNavigationTarget(
    href: string,
    currentOrigin: string,
): { kind: 'assign' | 'push'; url: string } | null {
    try {
        const safeHref = href.trim();
        if (!safeHref) return null;
        const currentUrl = new URL(currentOrigin);
        const targetUrl = new URL(safeHref, currentUrl);

        if (
            !['https:', 'http:'].includes(targetUrl.protocol) ||
            targetUrl.username ||
            targetUrl.password
        ) {
            return null;
        }

        if (targetUrl.origin === currentUrl.origin) {
            return { kind: 'push', url: safeHref };
        }

        if (
            targetUrl.protocol === 'https:' &&
            !hasExplicitPort(safeHref) &&
            (targetUrl.origin === DELIVERY_TRACKER_ORIGIN ||
                isGrediceOperationsUrl(targetUrl) ||
                isDeliverySurveyTypeformUrl(targetUrl))
        ) {
            return { kind: 'assign', url: targetUrl.toString() };
        }
    } catch {
        // Ignore malformed notification links.
    }

    return null;
}

export function navigateNotificationLink({
    href,
    currentOrigin,
    assign,
    push,
}: NavigateNotificationLinkOptions) {
    const target = resolveNotificationNavigationTarget(href, currentOrigin);
    if (!target) {
        return false;
    }

    if (target.kind === 'push') {
        push(target.url);
    } else {
        assign(target.url);
    }
    return true;
}
