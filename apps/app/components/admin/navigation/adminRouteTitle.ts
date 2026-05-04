import { adminBreadcrumbPages } from './adminPages';
import type { NavContextType } from './NavContext';

const idRouteTitlePrefixes = new Map([
    ['/admin/accounts', 'Račun'],
    ['/admin/communication/emails', 'Email'],
    ['/admin/farms', 'Farma'],
    ['/admin/gardens', 'Vrt'],
    ['/admin/inventory', 'Zaliha'],
    ['/admin/invoices', 'Ponuda'],
    ['/admin/operations', 'Radnja'],
    ['/admin/raised-beds', 'Gredica'],
    ['/admin/receipts', 'Fiskalni račun'],
    ['/admin/shopping-carts', 'Košarica'],
    ['/admin/transactions', 'Transakcija'],
    ['/admin/users', 'Korisnik'],
]);

function decodePathSegment(segment: string) {
    try {
        return decodeURIComponent(segment);
    } catch {
        return segment;
    }
}

function getEntityTypeLabel(
    navContext: NavContextType | undefined,
    entityTypeName: string,
) {
    const decodedEntityTypeName = decodePathSegment(entityTypeName);
    const categorizedTypes =
        navContext?.categorizedTypes.flatMap(
            (category) => category.entityTypes,
        ) ?? [];
    const entityTypes = [
        ...categorizedTypes,
        ...(navContext?.uncategorizedTypes ?? []),
        ...(navContext?.shadowTypes ?? []),
    ];

    return (
        entityTypes.find(
            (entityType) => entityType.name === decodedEntityTypeName,
        )?.label ?? decodedEntityTypeName
    );
}

function resolveDirectoryTitle(
    pathname: string,
    navContext: NavContextType | undefined,
) {
    if (pathname === '/admin/directories/entity-types/create') {
        return 'Novi direktorij';
    }

    if (pathname === '/admin/directories/categories/create') {
        return 'Nova kategorija';
    }

    if (/^\/admin\/directories\/categories\/[^/]+\/edit$/.test(pathname)) {
        return 'Uredi kategoriju';
    }

    const directoryMatch = pathname.match(
        /^\/admin\/directories\/([^/]+)(?:\/(.+))?$/,
    );
    if (!directoryMatch) {
        return null;
    }

    const entityTypeName = directoryMatch[1];
    if (!entityTypeName) {
        return null;
    }

    const entityTypeLabel = getEntityTypeLabel(navContext, entityTypeName);
    const suffix = directoryMatch[2];

    if (!suffix) {
        return entityTypeLabel;
    }

    if (suffix === 'edit') {
        return `Uredi ${entityTypeLabel}`;
    }

    if (suffix === 'attribute-definitions') {
        return `Atributi - ${entityTypeLabel}`;
    }

    if (suffix === 'attribute-definitions/categories') {
        return `Kategorije atributa - ${entityTypeLabel}`;
    }

    if (/^attribute-definitions\/categories\/[^/]+$/.test(suffix)) {
        return `Kategorija atributa - ${entityTypeLabel}`;
    }

    if (/^attribute-definitions\/[^/]+$/.test(suffix)) {
        return `Atribut - ${entityTypeLabel}`;
    }

    if (/^[^/]+$/.test(suffix)) {
        return `${entityTypeLabel} ${decodePathSegment(suffix)}`;
    }

    return null;
}

function resolveInventoryTitle(pathname: string) {
    if (pathname === '/admin/inventory/create') {
        return 'Nova zaliha';
    }

    const inventoryEditMatch = pathname.match(
        /^\/admin\/inventory\/([^/]+)\/edit$/,
    );
    if (inventoryEditMatch?.[1]) {
        return `Uredi zalihu ${decodePathSegment(inventoryEditMatch[1])}`;
    }

    const inventoryItemCreateMatch = pathname.match(
        /^\/admin\/inventory\/([^/]+)\/items\/create$/,
    );
    if (inventoryItemCreateMatch?.[1]) {
        return `Nova stavka zalihe ${decodePathSegment(
            inventoryItemCreateMatch[1],
        )}`;
    }

    const inventoryItemMatch = pathname.match(
        /^\/admin\/inventory\/([^/]+)\/items\/([^/]+)$/,
    );
    if (inventoryItemMatch?.[2]) {
        return `Stavka zalihe ${decodePathSegment(inventoryItemMatch[2])}`;
    }

    return null;
}

function resolveInvoiceTitle(pathname: string) {
    if (pathname === '/admin/invoices/create') {
        return 'Nova ponuda';
    }

    const invoiceEditMatch = pathname.match(
        /^\/admin\/invoices\/([^/]+)\/edit$/,
    );
    if (invoiceEditMatch?.[1]) {
        return `Uredi ponudu ${decodePathSegment(invoiceEditMatch[1])}`;
    }

    return null;
}

export function resolveAdminRouteTitle(
    pathname: string,
    navContext: NavContextType | undefined,
) {
    const exactPage = adminBreadcrumbPages.find(
        (page) => page.href === pathname,
    );
    if (exactPage) {
        return exactPage.label;
    }

    if (pathname === '/admin/logout') {
        return 'Odjava';
    }

    const directoryTitle = resolveDirectoryTitle(pathname, navContext);
    if (directoryTitle) {
        return directoryTitle;
    }

    const inventoryTitle = resolveInventoryTitle(pathname);
    if (inventoryTitle) {
        return inventoryTitle;
    }

    const invoiceTitle = resolveInvoiceTitle(pathname);
    if (invoiceTitle) {
        return invoiceTitle;
    }

    const idSeparatorIndex = pathname.lastIndexOf('/');
    if (idSeparatorIndex > 0) {
        const routePrefix = pathname.slice(0, idSeparatorIndex);
        const routeId = pathname.slice(idSeparatorIndex + 1);
        const titlePrefix = idRouteTitlePrefixes.get(routePrefix);
        if (titlePrefix && routeId) {
            return `${titlePrefix} ${decodePathSegment(routeId)}`;
        }
    }

    return null;
}
