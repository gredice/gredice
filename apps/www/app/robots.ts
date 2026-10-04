import type { MetadataRoute } from 'next';
import { PUBLIC_SITE_ORIGIN } from '../lib/seo/publicMetadata';

/**
 * Pages kept out of the sitemap stay crawlable so robots can read their
 * `noindex` directive; a disallow would hide the directive instead of applying
 * it. Only personalised tracking links are disallowed.
 */
export default function robots(): MetadataRoute.Robots {
    const rules = ['Googlebot', 'OAI-SearchBot', '*'].map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: ['/trag/'],
    }));

    return {
        rules,
        sitemap: `${PUBLIC_SITE_ORIGIN}/sitemap.xml`,
    };
}
