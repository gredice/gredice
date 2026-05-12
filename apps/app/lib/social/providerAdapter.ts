import 'server-only';

export type SocialProvider = 'reddit';

export type SocialPostInput =
    | {
          title: string;
          kind: 'text';
          subreddit: string;
          text: string;
      }
    | {
          title: string;
          kind: 'link';
          subreddit: string;
          url: string;
      };

export type ProviderPublishSuccess = {
    permalink: string;
    providerPostId: string;
    providerSubmissionId?: string;
};

export type ProviderPublishErrorCode =
    | 'INVALID_CONFIG'
    | 'SUBREDDIT_NOT_ALLOWED'
    | 'INVALID_INPUT'
    | 'PROVIDER_UNAVAILABLE'
    | 'AUTH_FAILED'
    | 'RATE_LIMITED'
    | 'REQUEST_REJECTED'
    | 'UNKNOWN';

export type ProviderPublishError = {
    code: ProviderPublishErrorCode;
    message: string;
    retryable: boolean;
};

export type ProviderPublishResult =
    | {
          ok: true;
          provider: SocialProvider;
          post: ProviderPublishSuccess;
      }
    | {
          ok: false;
          provider: SocialProvider;
          error: ProviderPublishError;
      };

export interface SocialProviderAdapter {
    readonly provider: SocialProvider;
    validateConfig(): ProviderPublishResult | null;
    publishNow(input: SocialPostInput): Promise<ProviderPublishResult>;
}
