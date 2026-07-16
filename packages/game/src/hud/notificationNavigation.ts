const DELIVERY_TRACKER_ORIGIN = 'https://dostava.gredice.com';
const GREDICE_OPERATIONS_ORIGIN = 'https://www.gredice.com';
const DELIVERY_SURVEY_TYPEFORM_URL = 'https://form.typeform.com/to/X727vyBk';

type NavigateNotificationLinkOptions = {
    href: string;
    currentOrigin: string;
    assign: (url: string) => void;
    push: (url: string) => void;
};

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

export function navigateNotificationLink({
    href,
    currentOrigin,
    assign,
    push,
}: NavigateNotificationLinkOptions) {
    try {
        const safeHref = href.trim();
        if (!safeHref) return;
        const currentUrl = new URL(currentOrigin);
        const targetUrl = new URL(safeHref, currentUrl);

        if (
            !['https:', 'http:'].includes(targetUrl.protocol) ||
            targetUrl.username ||
            targetUrl.password
        ) {
            return;
        }

        if (targetUrl.origin === currentUrl.origin) {
            push(safeHref);
            return;
        }

        if (
            targetUrl.protocol === 'https:' &&
            !hasExplicitPort(safeHref) &&
            (targetUrl.origin === DELIVERY_TRACKER_ORIGIN ||
                isGrediceOperationsUrl(targetUrl) ||
                isDeliverySurveyTypeformUrl(targetUrl))
        ) {
            assign(targetUrl.toString());
        }
    } catch {
        // Ignore malformed notification links.
    }
}
