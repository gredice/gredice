export type GrediceAppOrigin =
    | 'api'
    | 'app'
    | 'farm'
    | 'delivery'
    | 'garden'
    | 'news'
    | 'www';

const localHostnames: Record<GrediceAppOrigin, string> = {
    api: 'api.gredice.test',
    app: 'app.gredice.test',
    farm: 'farma.gredice.test',
    delivery: 'dostava.gredice.test',
    garden: 'vrt.gredice.test',
    news: 'novosti.gredice.test',
    www: 'www.gredice.test',
};

const localPorts: Record<GrediceAppOrigin, number> = {
    api: 3005,
    app: 3003,
    farm: 3002,
    delivery: 3008,
    garden: 3001,
    news: 3007,
    www: 3000,
};

const productionOrigins: Record<GrediceAppOrigin, string> = {
    api: 'https://api.gredice.com',
    app: 'https://app.gredice.com',
    farm: 'https://farma.gredice.com',
    delivery: 'https://dostava.gredice.com',
    garden: 'https://vrt.gredice.com',
    news: 'https://www.gredice.com/novosti',
    www: 'https://www.gredice.com',
};

function configuredPublicOrigin(app: GrediceAppOrigin) {
    switch (app) {
        case 'api':
            return process.env.NEXT_PUBLIC_GREDICE_API_ORIGIN;
        case 'app':
            return process.env.NEXT_PUBLIC_GREDICE_APP_ORIGIN;
        case 'farm':
            return process.env.NEXT_PUBLIC_GREDICE_FARM_ORIGIN;
        case 'delivery':
            return process.env.NEXT_PUBLIC_GREDICE_DELIVERY_ORIGIN;
        case 'garden':
            return process.env.NEXT_PUBLIC_GREDICE_GARDEN_ORIGIN;
        case 'news':
            return process.env.NEXT_PUBLIC_GREDICE_NEWS_ORIGIN;
        case 'www':
            return process.env.NEXT_PUBLIC_GREDICE_WWW_ORIGIN;
    }
}

function trimTrailingSlash(value: string) {
    return value.replace(/\/+$/, '');
}

function isLocalhost(hostname: string) {
    return hostname === 'localhost' || hostname === '127.0.0.1';
}

function isLocalGrediceHostname(hostname: string) {
    return hostname === 'gredice.test' || hostname.endsWith('.gredice.test');
}

export function getGrediceAppOrigin(
    app: GrediceAppOrigin,
    currentOrigin?: string,
) {
    const configured = configuredPublicOrigin(app)?.trim();
    if (configured) {
        return trimTrailingSlash(configured);
    }

    if (!currentOrigin) {
        return productionOrigins[app];
    }

    const currentUrl = new URL(currentOrigin);
    if (isLocalGrediceHostname(currentUrl.hostname)) {
        currentUrl.hostname = localHostnames[app];
        return currentUrl.origin;
    }

    if (isLocalhost(currentUrl.hostname)) {
        return `http://localhost:${localPorts[app]}`;
    }

    return productionOrigins[app];
}

export function getBrowserGrediceAppOrigin(app: GrediceAppOrigin) {
    return getGrediceAppOrigin(
        app,
        typeof window === 'undefined' ? undefined : window.location.origin,
    );
}
