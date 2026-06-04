export type PublicChromeLinkMode = 'relative' | 'www-origin';

export const PublicPagePaths = {
    Landing: '/',

    Delivery: '/dostava',
    DeliverySlots: '/dostava/termini',
    Plants: '/biljke',
    Blocks: '/blokovi',
    Sunflowers: '/suncokreti',
    RaisedBeds: '/podignuta-gredica',
    Sowing: '/sjetva',
    Operations: '/radnje',
    FAQ: '/cesta-pitanja',
    QualityHarvestSafety: '/kvaliteta-i-sigurnost-uroda',
    Contact: '/kontakt',
    Pricing: '/cjenik',
    AboutUs: '/o-nama',
    News: '/novosti',
    WhatsNew: '/novosti/sto-je-novo',

    LegalPrivacy: '/legalno/politika-privatnosti',
    LegalTerms: '/legalno/uvjeti-koristenja',
    LegalCookies: '/legalno/politika-kolacica',
    LegalLicense: '/legalno/licenca',
    LegalOccasions: '/legalno/natjecaji',

    GardenApp: 'https://vrt.gredice.com',
    Status: 'https://status.gredice.com',
} as const;

function trimTrailingSlash(value: string) {
    return value.replace(/\/+$/, '');
}

function isLocalhost(hostname: string) {
    return hostname === 'localhost' || hostname === '127.0.0.1';
}

function isLocalGrediceHostname(hostname: string) {
    return hostname === 'gredice.test' || hostname.endsWith('.gredice.test');
}

function configuredWwwOrigin() {
    return process.env.NEXT_PUBLIC_GREDICE_WWW_ORIGIN?.trim();
}

function getBrowserWwwOrigin() {
    const configured = configuredWwwOrigin();
    if (configured) {
        return trimTrailingSlash(configured);
    }

    if (typeof window === 'undefined') {
        return 'https://www.gredice.com';
    }

    const currentUrl = new URL(window.location.origin);
    if (isLocalGrediceHostname(currentUrl.hostname)) {
        currentUrl.hostname = 'www.gredice.test';
        return currentUrl.origin;
    }

    if (isLocalhost(currentUrl.hostname)) {
        return 'http://localhost:3000';
    }

    return 'https://www.gredice.com';
}

export function publicChromeHref(
    href: string,
    mode: PublicChromeLinkMode = 'relative',
) {
    if (href.startsWith('http://') || href.startsWith('https://')) {
        return href;
    }

    if (mode === 'relative') {
        return href;
    }

    return `${getBrowserWwwOrigin()}${href}`;
}
