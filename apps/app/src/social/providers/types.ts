export type SocialProviderName = 'reddit';

export type SocialPostInput = {
    title: string;
    body?: string;
    url?: string;
    destination?: string;
};

export type SocialPublishSuccess = {
    ok: true;
    providerPostId: string;
    permalink: string;
    metadata?: Record<string, unknown>;
};

export type SocialPublishErrorCode =
    | 'provider_disabled'
    | 'missing_credentials'
    | 'invalid_destination'
    | 'auth_failed'
    | 'rate_limited'
    | 'invalid_request'
    | 'provider_unavailable'
    | 'unknown_error';

export type SocialPublishError = {
    ok: false;
    code: SocialPublishErrorCode;
    message: string;
    retriable: boolean;
    details?: Record<string, unknown>;
};

export type SocialPublishResult = SocialPublishSuccess | SocialPublishError;

export interface SocialProviderAdapter {
    readonly name: SocialProviderName;
    validateConfig(): SocialPublishError | null;
    publishPost(input: SocialPostInput): Promise<SocialPublishResult>;
}
