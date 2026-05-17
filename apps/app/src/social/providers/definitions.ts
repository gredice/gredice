import type { SocialPostType, SocialProvider } from '@gredice/storage';

export type SocialProviderDefinition = {
    name: SocialProvider;
    label: string;
    accountLabel: string;
    destinationLabel: string;
    destinationPlaceholder: string;
    supportedPostTypes: SocialPostType[];
    requiresTitle: boolean;
    requiresMedia: boolean;
};

export const socialProviderDefinitions = [
    {
        name: 'reddit',
        label: 'Reddit',
        accountLabel: 'Reddit račun',
        destinationLabel: 'Subreddit',
        destinationPlaceholder: 'gardening',
        supportedPostTypes: ['text', 'link'],
        requiresTitle: true,
        requiresMedia: false,
    },
    {
        name: 'instagram',
        label: 'Instagram',
        accountLabel: 'Instagram račun',
        destinationLabel: 'Profil',
        destinationPlaceholder: '@gredice',
        supportedPostTypes: ['image', 'video', 'reel', 'story', 'carousel'],
        requiresTitle: false,
        requiresMedia: true,
    },
    {
        name: 'facebook',
        label: 'Facebook',
        accountLabel: 'Facebook račun',
        destinationLabel: 'Stranica ili grupa',
        destinationPlaceholder: 'Gredice',
        supportedPostTypes: [
            'text',
            'link',
            'image',
            'video',
            'reel',
            'story',
            'carousel',
        ],
        requiresTitle: false,
        requiresMedia: false,
    },
    {
        name: 'google_business',
        label: 'Google Business',
        accountLabel: 'Google Business račun',
        destinationLabel: 'Lokacija',
        destinationPlaceholder: 'Gredice Zagreb',
        supportedPostTypes: ['text', 'link', 'image'],
        requiresTitle: false,
        requiresMedia: false,
    },
    {
        name: 'x',
        label: 'X',
        accountLabel: 'X račun',
        destinationLabel: 'Profil',
        destinationPlaceholder: '@gredice',
        supportedPostTypes: ['text', 'link', 'image', 'video'],
        requiresTitle: false,
        requiresMedia: false,
    },
    {
        name: 'tiktok',
        label: 'TikTok',
        accountLabel: 'TikTok račun',
        destinationLabel: 'Profil',
        destinationPlaceholder: '@gredice',
        supportedPostTypes: ['video', 'reel'],
        requiresTitle: false,
        requiresMedia: true,
    },
    {
        name: 'threads',
        label: 'Threads',
        accountLabel: 'Threads račun',
        destinationLabel: 'Profil',
        destinationPlaceholder: '@gredice',
        supportedPostTypes: ['text', 'link', 'image', 'video'],
        requiresTitle: false,
        requiresMedia: false,
    },
    {
        name: 'linkedin',
        label: 'LinkedIn',
        accountLabel: 'LinkedIn račun',
        destinationLabel: 'Stranica ili profil',
        destinationPlaceholder: 'Gredice',
        supportedPostTypes: ['text', 'link', 'image', 'video'],
        requiresTitle: false,
        requiresMedia: false,
    },
    {
        name: 'whatsapp',
        label: 'WhatsApp',
        accountLabel: 'WhatsApp račun',
        destinationLabel: 'Kanal ili status profil',
        destinationPlaceholder: 'Gredice',
        supportedPostTypes: ['story', 'image', 'video'],
        requiresTitle: false,
        requiresMedia: true,
    },
] satisfies SocialProviderDefinition[];

export const socialPostTypeLabels: Record<SocialPostType, string> = {
    text: 'Tekst',
    link: 'Link',
    image: 'Slika',
    video: 'Video',
    reel: 'Reel',
    story: 'Story',
    carousel: 'Carousel',
    other: 'Ostalo',
};

export function getSocialProviderDefinition(provider: SocialProvider) {
    return socialProviderDefinitions.find(
        (definition) => definition.name === provider,
    );
}

export function isSocialProvider(provider: string): provider is SocialProvider {
    return socialProviderDefinitions.some(
        (definition) => definition.name === provider,
    );
}

export function isSocialPostType(postType: string): postType is SocialPostType {
    return Object.hasOwn(socialPostTypeLabels, postType);
}

export function isPostTypeSupportedByProvider(
    provider: SocialProvider,
    postType: SocialPostType,
) {
    return (
        getSocialProviderDefinition(provider)?.supportedPostTypes.some(
            (supportedPostType) => supportedPostType === postType,
        ) ?? false
    );
}
