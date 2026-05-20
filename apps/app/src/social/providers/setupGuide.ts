import type { SocialProvider } from '@gredice/storage';

export type SocialProviderSetupGuide = {
    provider: SocialProvider;
    setupSummary: string;
    destinationFormat: string;
    requiredAccess: string[];
    envVars: string[];
    mediaNotes: string[];
    docsUrl: string;
};

export const socialProviderSetupGuides = [
    {
        provider: 'reddit',
        setupSummary:
            'Create a Reddit app for the team account, approve OAuth API access, and authorize a user token with submit scope.',
        destinationFormat: 'Subreddit name without r/, for example gredice.',
        requiredAccess: [
            'Reddit app client ID and secret',
            'Refresh token or short-lived access token with submit scope',
            'User-Agent that identifies Gredice and a contact',
        ],
        envVars: [
            'SOCIAL_PROVIDER_REDDIT_ENABLED',
            'SOCIAL_PROVIDER_REDDIT_CLIENT_ID',
            'SOCIAL_PROVIDER_REDDIT_CLIENT_SECRET',
            'SOCIAL_PROVIDER_REDDIT_REFRESH_TOKEN',
            'SOCIAL_PROVIDER_REDDIT_USER_AGENT',
            'SOCIAL_PROVIDER_REDDIT_DEFAULT_DESTINATION',
            'SOCIAL_PROVIDER_REDDIT_ALLOWED_DESTINATIONS',
        ],
        mediaNotes: [
            'Direct adapter supports Reddit text and link submissions.',
        ],
        docsUrl: 'https://www.reddit.com/dev/api/',
    },
    {
        provider: 'instagram',
        setupSummary:
            'Use Meta Graph API content publishing for an Instagram professional account connected to the Meta app.',
        destinationFormat:
            'Instagram professional account ID, for example 17841400000000000.',
        requiredAccess: [
            'Meta app with Instagram API access',
            'Access token approved for Instagram content publishing',
            'Public media URLs that Meta can fetch without redirects or auth',
        ],
        envVars: [
            'SOCIAL_PROVIDER_INSTAGRAM_ENABLED',
            'SOCIAL_PROVIDER_INSTAGRAM_ACCESS_TOKEN',
            'SOCIAL_PROVIDER_INSTAGRAM_GRAPH_VERSION',
            'SOCIAL_PROVIDER_INSTAGRAM_DEFAULT_DESTINATION',
            'SOCIAL_PROVIDER_INSTAGRAM_ALLOWED_DESTINATIONS',
        ],
        mediaNotes: [
            'Images, videos, reels, stories, and carousels are published through the media container then media_publish flow.',
            'Video containers may remain processing on Meta before appearing publicly.',
        ],
        docsUrl:
            'https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/content-publishing/',
    },
    {
        provider: 'facebook',
        setupSummary:
            'Use Meta Pages publishing with a Page access token for the target Facebook Page.',
        destinationFormat: 'Facebook Page ID, for example 1234567890.',
        requiredAccess: [
            'Meta app with Facebook Pages product',
            'Page access token with Pages publishing permissions',
            'Page role that is allowed to publish',
        ],
        envVars: [
            'SOCIAL_PROVIDER_FACEBOOK_ENABLED',
            'SOCIAL_PROVIDER_FACEBOOK_ACCESS_TOKEN',
            'SOCIAL_PROVIDER_FACEBOOK_GRAPH_VERSION',
            'SOCIAL_PROVIDER_FACEBOOK_DEFAULT_DESTINATION',
            'SOCIAL_PROVIDER_FACEBOOK_ALLOWED_DESTINATIONS',
        ],
        mediaNotes: [
            'Text and links use the Page feed endpoint.',
            'Images use Page photos; multiple images are attached through unpublished photo IDs.',
            'Videos, reels, and stories are sent through Page video upload and tracked as provider submissions.',
        ],
        docsUrl: 'https://developers.facebook.com/docs/pages-api/posts/',
    },
    {
        provider: 'google_business',
        setupSummary:
            'Use the Google Business Profile Local Posts API for the verified Gredice location.',
        destinationFormat: 'accounts/{accountId}/locations/{locationId}.',
        requiredAccess: [
            'Google Cloud OAuth client with Business Profile API access',
            'business.manage or plus.business.manage OAuth scope',
            'Access token or refresh-token credentials for the profile owner',
        ],
        envVars: [
            'SOCIAL_PROVIDER_GOOGLE_BUSINESS_ENABLED',
            'SOCIAL_PROVIDER_GOOGLE_BUSINESS_ACCESS_TOKEN',
            'SOCIAL_PROVIDER_GOOGLE_BUSINESS_CLIENT_ID',
            'SOCIAL_PROVIDER_GOOGLE_BUSINESS_CLIENT_SECRET',
            'SOCIAL_PROVIDER_GOOGLE_BUSINESS_REFRESH_TOKEN',
            'SOCIAL_PROVIDER_GOOGLE_BUSINESS_LANGUAGE_CODE',
            'SOCIAL_PROVIDER_GOOGLE_BUSINESS_DEFAULT_DESTINATION',
            'SOCIAL_PROVIDER_GOOGLE_BUSINESS_ALLOWED_DESTINATIONS',
        ],
        mediaNotes: [
            'LocalPost media supports sourceUrl photos; videos are not attached by this adapter.',
            'URL posts add a LEARN_MORE call to action.',
        ],
        docsUrl:
            'https://developers.google.com/my-business/reference/rest/v4/accounts.locations.localPosts/create',
    },
    {
        provider: 'x',
        setupSummary:
            'Use X API v2 Manage Posts and Media Upload with a user OAuth token for the Gredice profile.',
        destinationFormat:
            'Profile handle for permalink creation, for example @gredice.',
        requiredAccess: [
            'X developer project and app with write access',
            'OAuth 2.0 user access token with tweet.write and media.write capabilities',
            'API plan that includes Manage Posts and media upload',
        ],
        envVars: [
            'SOCIAL_PROVIDER_X_ENABLED',
            'SOCIAL_PROVIDER_X_ACCESS_TOKEN',
            'SOCIAL_PROVIDER_X_DEFAULT_DESTINATION',
            'SOCIAL_PROVIDER_X_ALLOWED_DESTINATIONS',
        ],
        mediaNotes: [
            'Images and videos are downloaded by apps/app, uploaded to X media upload, finalized, then attached to the post.',
            'Large media processing can leave the post retriable if X does not finish processing in time.',
        ],
        docsUrl: 'https://docs.x.com/x-api/posts/create-post',
    },
    {
        provider: 'tiktok',
        setupSummary:
            'Use TikTok Content Posting API Direct Post for the authorized creator account.',
        destinationFormat: 'Operational label or handle, for example @gredice.',
        requiredAccess: [
            'TikTok developer app with Content Posting API product',
            'Direct Post enabled and audited for public visibility',
            'User access token authorized for video.publish and photo publishing where needed',
            'Verified media domain or URL prefix for PULL_FROM_URL',
        ],
        envVars: [
            'SOCIAL_PROVIDER_TIKTOK_ENABLED',
            'SOCIAL_PROVIDER_TIKTOK_ACCESS_TOKEN',
            'SOCIAL_PROVIDER_TIKTOK_PRIVACY_LEVEL',
            'SOCIAL_PROVIDER_TIKTOK_DISABLE_DUET',
            'SOCIAL_PROVIDER_TIKTOK_DISABLE_COMMENT',
            'SOCIAL_PROVIDER_TIKTOK_DISABLE_STITCH',
            'SOCIAL_PROVIDER_TIKTOK_AUTO_ADD_MUSIC',
            'SOCIAL_PROVIDER_TIKTOK_DEFAULT_DESTINATION',
            'SOCIAL_PROVIDER_TIKTOK_ALLOWED_DESTINATIONS',
        ],
        mediaNotes: [
            'Video and reel posts use video/init with PULL_FROM_URL.',
            'Image and carousel posts use content/init with DIRECT_POST and PHOTO.',
            'Unaudited TikTok clients are restricted to private visibility.',
        ],
        docsUrl:
            'https://developers.tiktok.com/doc/content-posting-api-get-started/',
    },
    {
        provider: 'threads',
        setupSummary:
            'Use Threads API container creation and threads_publish for the authorized Threads profile.',
        destinationFormat: 'Threads user ID or me for the token owner.',
        requiredAccess: [
            'Meta app with Threads API access',
            'Access token with threads_basic and threads_content_publish',
            'Public image or video URLs when media is attached',
        ],
        envVars: [
            'SOCIAL_PROVIDER_THREADS_ENABLED',
            'SOCIAL_PROVIDER_THREADS_ACCESS_TOKEN',
            'SOCIAL_PROVIDER_THREADS_DEFAULT_DESTINATION',
            'SOCIAL_PROVIDER_THREADS_ALLOWED_DESTINATIONS',
        ],
        mediaNotes: [
            'Text, link, image, video, and carousel posts use the Threads container then publish flow.',
            'Threads scheduling is handled by Gredice queueing, not by Threads API.',
        ],
        docsUrl: 'https://developers.facebook.com/docs/threads/posts',
    },
    {
        provider: 'linkedin',
        setupSummary:
            'Use LinkedIn versioned Posts API with Images API or Videos API uploads for media.',
        destinationFormat:
            'Author URN, for example urn:li:organization:123456 or urn:li:person:abc.',
        requiredAccess: [
            'LinkedIn app with approved Community Management access',
            'w_organization_social for organization pages or w_member_social for member posts',
            'LinkedIn-Version header value in YYYYMM format',
        ],
        envVars: [
            'SOCIAL_PROVIDER_LINKEDIN_ENABLED',
            'SOCIAL_PROVIDER_LINKEDIN_ACCESS_TOKEN',
            'SOCIAL_PROVIDER_LINKEDIN_API_VERSION',
            'SOCIAL_PROVIDER_LINKEDIN_DEFAULT_DESTINATION',
            'SOCIAL_PROVIDER_LINKEDIN_ALLOWED_DESTINATIONS',
        ],
        mediaNotes: [
            'Text and link posts go directly to /rest/posts.',
            'One image or one video can be uploaded and attached to an organic post.',
            'Organic carousel publishing is not enabled by this adapter because LinkedIn documents carousel as sponsored-only.',
        ],
        docsUrl:
            'https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-01',
    },
    {
        provider: 'whatsapp',
        setupSummary:
            'Use WhatsApp Cloud API Messages to send direct business messages from the configured phone number.',
        destinationFormat:
            'Recipient WhatsApp phone number in international format without +.',
        requiredAccess: [
            'Meta app with WhatsApp Business Platform Cloud API',
            'Permanent or long-lived access token',
            'WhatsApp Business phone number ID',
            'Approved templates for proactive marketing messages outside the customer-service window',
        ],
        envVars: [
            'SOCIAL_PROVIDER_WHATSAPP_ENABLED',
            'SOCIAL_PROVIDER_WHATSAPP_ACCESS_TOKEN',
            'SOCIAL_PROVIDER_WHATSAPP_PHONE_NUMBER_ID',
            'SOCIAL_PROVIDER_WHATSAPP_GRAPH_VERSION',
            'SOCIAL_PROVIDER_WHATSAPP_DEFAULT_DESTINATION',
            'SOCIAL_PROVIDER_WHATSAPP_ALLOWED_DESTINATIONS',
        ],
        mediaNotes: [
            'This is direct WhatsApp Cloud API messaging, not public Status or Channel publishing.',
            'One image or video URL can be sent per message; text-only messages are supported for service-window communication.',
        ],
        docsUrl:
            'https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages',
    },
] satisfies SocialProviderSetupGuide[];

export function getSocialProviderSetupGuide(provider: SocialProvider) {
    return socialProviderSetupGuides.find(
        (guide) => guide.provider === provider,
    );
}
