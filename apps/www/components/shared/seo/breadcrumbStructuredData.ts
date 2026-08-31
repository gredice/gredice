import { PUBLIC_SITE_ORIGIN } from '../../../lib/seo/publicMetadata.ts';

export type PublicBreadcrumbLink = {
    href: string;
    label: string;
};

export type PublicBreadcrumbCurrentItem = {
    href?: never;
    label: string;
};

export type PublicBreadcrumbItems = readonly [
    PublicBreadcrumbLink,
    ...PublicBreadcrumbLink[],
    PublicBreadcrumbCurrentItem,
];

export function createPublicBreadcrumbStructuredData(
    items: PublicBreadcrumbItems,
) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.label,
            ...(index < items.length - 1 && item.href
                ? { item: new URL(item.href, PUBLIC_SITE_ORIGIN).toString() }
                : {}),
        })),
    };
}
