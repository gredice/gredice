import type { SocialProvider } from '@gredice/storage';
import { getSocialProviderDefinition } from '../../../../../../src/social/providers/definitions';

const socialProviderDomains: Record<SocialProvider, string> = {
    reddit: 'reddit.com',
    instagram: 'instagram.com',
    facebook: 'facebook.com',
    google_business: 'business.google.com',
    x: 'x.com',
    tiktok: 'tiktok.com',
    threads: 'threads.net',
    linkedin: 'linkedin.com',
    whatsapp: 'whatsapp.com',
};

function faviconUrl(provider: SocialProvider) {
    const domain = socialProviderDomains[provider];

    return `https://www.google.com/s2/favicons?sz=64&domain_url=https://${domain}`;
}

export function SocialIntegrationIcon({
    provider,
    className = 'size-8',
}: {
    provider: SocialProvider;
    className?: string;
}) {
    const label = getSocialProviderDefinition(provider)?.label ?? provider;

    return (
        <span
            role="img"
            aria-label={`${label} favicon`}
            className={`inline-block rounded-md bg-contain bg-center bg-no-repeat ${className}`}
            style={{ backgroundImage: `url("${faviconUrl(provider)}")` }}
        />
    );
}
