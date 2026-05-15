const DEFAULT_ICON = '/icon.svg';
const DEFAULT_BADGE = '/badge.svg';
const ALLOWED_PROTOCOLS = new Set(['https:', 'http:']);

function isObject(value) {
  return typeof value === 'object' && value !== null;
}

function safeString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
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
  if (!Array.isArray(actions)) return undefined;
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

  return normalized.length > 0 ? normalized : undefined;
}

function createPayload(rawData) {
  const source = isObject(rawData) ? rawData : {};
  const data = isObject(source.data) ? source.data : {};

  const title = safeString(source.title) ?? 'Gredice';
  const body = safeString(source.body) ?? '';
  const icon = normalizeUrl(source.icon) ?? normalizeUrl(source.image) ?? DEFAULT_ICON;
  const image = normalizeUrl(source.image);
  const badge = normalizeUrl(source.badge) ?? DEFAULT_BADGE;
  const url = normalizeUrl(source.url) ?? self.location.origin;
  const tag = safeString(source.tag) ?? safeString(source.collapseKey) ?? safeString(source.threadKey);
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
      actions,
      data: {
        url,
        analytics: {
          notificationId: safeString(source.notificationId),
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
  const raw = event.data ? event.data.json() : {};
  const payload = createPayload(raw);
  event.waitUntil(self.registration.showNotification(payload.title, payload.options));
});

self.addEventListener('notificationclick', (event) => {
  const data = event.notification?.data;
  const actionCandidate = safeString(event.action);
  const actionMatch = event.notification?.actions?.find((action) => action.action === actionCandidate);
  const targetUrl = actionMatch?.url ?? data?.url ?? self.location.origin;
  event.notification.close();

  event.waitUntil((async () => {
    await emitAnalytics('clicked', data, actionCandidate);
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      if ('focus' in client && normalizeUrl(client.url) === normalizeUrl(targetUrl)) {
        await client.focus();
        return;
      }
    }
    if (clients.openWindow) {
      await clients.openWindow(targetUrl);
    }
  })());
});

self.addEventListener('notificationclose', (event) => {
  event.waitUntil(emitAnalytics('dismissed', event.notification?.data));
});
