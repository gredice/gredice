const DEFAULT_ICON = '/web-app-manifest-192x192.png';
const DEFAULT_BADGE = '/notification-badge-96x96.png';
const ALLOWED_PROTOCOLS = new Set(['https:', 'http:']);

function isObject(value) {
    return typeof value === 'object' && value !== null;
}

function safeString(value) {
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : undefined;
}

function safePositiveInteger(value) {
    const numberValue =
        typeof value === 'number'
            ? value
            : typeof value === 'string'
              ? Number(value)
              : Number.NaN;
    return Number.isSafeInteger(numberValue) && numberValue > 0
        ? numberValue
        : undefined;
}

function normalizeUrl(rawUrl) {
    const safe = safeString(rawUrl);
    if (!safe) return undefined;
    try {
        const url = new URL(safe, self.location.origin);
        if (!ALLOWED_PROTOCOLS.has(url.protocol)) return undefined;
        if (url.origin !== self.location.origin) return undefined;
        return url.toString();
    } catch {
        return undefined;
    }
}

function normalizeActions(actions) {
    if (!Array.isArray(actions)) {
        return { actions: undefined, actionUrls: undefined };
    }
    const normalized = actions
        .filter((action) => isObject(action))
        .map((action) => ({
            action: safeString(action.action),
            title: safeString(action.title),
            icon: normalizeUrl(action.icon),
            url: normalizeUrl(action.url),
        }))
        .filter((action) => action.action && action.title)
        .slice(0, Number(self.Notification?.maxActions ?? 2));

    if (normalized.length === 0) {
        return { actions: undefined, actionUrls: undefined };
    }

    const actionUrls = normalized.reduce((urls, action) => {
        if (action.action && action.url) {
            urls[action.action] = action.url;
        }
        return urls;
    }, {});

    return {
        actions: normalized.map((action) => ({
            action: action.action,
            title: action.title,
            icon: action.icon,
        })),
        actionUrls: Object.keys(actionUrls).length > 0 ? actionUrls : undefined,
    };
}

function readPushData(event) {
    if (!event.data || typeof event.data.json !== 'function') {
        return {};
    }

    try {
        const raw = event.data.json();
        return isObject(raw) ? raw : {};
    } catch {
        return {};
    }
}

function createPayload(rawData) {
    const source = isObject(rawData) ? rawData : {};
    const data = isObject(source.data) ? source.data : {};

    const title = safeString(source.title) ?? 'Gredice';
    const body = safeString(source.body) ?? '';
    const icon =
        normalizeUrl(source.icon) ?? normalizeUrl(source.image) ?? DEFAULT_ICON;
    const image = normalizeUrl(source.image);
    const badge = normalizeUrl(source.badge) ?? DEFAULT_BADGE;
    const url = normalizeUrl(source.url) ?? self.location.origin;
    const tag =
        safeString(source.tag) ??
        safeString(source.collapseKey) ??
        safeString(source.threadKey);
    const actions = normalizeActions(source.actions);

    return {
        title,
        options: {
            body,
            icon,
            image,
            badge,
            tag,
            renotify: Boolean(source.renotify && tag),
            requireInteraction: Boolean(source.requireInteraction),
            silent: Boolean(source.silent),
            actions: actions.actions,
            data: {
                url,
                actionUrls: actions.actionUrls,
                analytics: {
                    notificationId: safeString(source.notificationId),
                    deliveryAttemptId: safePositiveInteger(
                        source.deliveryAttemptId,
                    ),
                    campaignId: safeString(source.campaignId),
                    category: safeString(source.category),
                },
                payload: data,
            },
        },
    };
}

async function emitAnalytics(type, notificationData, action) {
    const analytics = notificationData?.analytics;
    if (!analytics?.notificationId) return;
    const body = {
        type,
        action: safeString(action),
        notificationId: analytics.notificationId,
        deliveryAttemptId: safePositiveInteger(analytics.deliveryAttemptId),
        campaignId: analytics.campaignId,
        category: analytics.category,
        at: new Date().toISOString(),
    };

    try {
        await fetch('/api/notifications/events', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
            keepalive: true,
            credentials: 'include',
        });
    } catch {
        // swallow analytics transport failures in service worker
    }
}

self.addEventListener('push', (event) => {
    const raw = readPushData(event);
    const payload = createPayload(raw);
    event.waitUntil(
        self.registration.showNotification(payload.title, payload.options),
    );
});

self.addEventListener('notificationclick', (event) => {
    const data = event.notification?.data;
    const actionCandidate = safeString(event.action);
    const actionUrls = isObject(data?.actionUrls) ? data.actionUrls : {};
    const actionUrl = actionCandidate
        ? safeString(actionUrls[actionCandidate])
        : undefined;
    const targetUrl =
        normalizeUrl(actionUrl) ??
        normalizeUrl(data?.url) ??
        self.location.origin;
    event.notification.close();

    event.waitUntil(
        (async () => {
            await emitAnalytics('clicked', data, actionCandidate);
            const allClients = await clients.matchAll({
                type: 'window',
                includeUncontrolled: true,
            });
            for (const client of allClients) {
                if (
                    'focus' in client &&
                    normalizeUrl(client.url) === normalizeUrl(targetUrl)
                ) {
                    await client.focus();
                    return;
                }
            }
            if (clients.openWindow) {
                await clients.openWindow(targetUrl);
            }
        })(),
    );
});

self.addEventListener('notificationclose', (event) => {
    event.waitUntil(emitAnalytics('dismissed', event.notification?.data));
});
