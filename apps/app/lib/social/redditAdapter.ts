import 'server-only';

const REDDIT_OAUTH_BASE_URL = 'https://oauth.reddit.com';

export type RedditPostInput = {
    subreddit: string;
    title: string;
    kind: 'self' | 'link';
    text?: string;
    url?: string;
};

export type RedditPublishResult =
    | {
          ok: true;
          redditId: string;
          permalink: string;
      }
    | {
          ok: false;
          code:
              | 'CONFIG_INVALID'
              | 'SUBREDDIT_NOT_ALLOWED'
              | 'VALIDATION_ERROR'
              | 'AUTH_ERROR'
              | 'API_ERROR';
          message: string;
      };

type FetchFn = typeof fetch;

type RedditConfig = {
    oauthToken: string;
    allowedSubreddits: Set<string>;
};

export function readRedditConfigFromEnv():
    | RedditPublishResult
    | { ok: true; config: RedditConfig } {
    const oauthToken = process.env.REDDIT_OAUTH_TOKEN?.trim();
    const allowedRaw = process.env.REDDIT_ALLOWED_SUBREDDITS?.trim();

    if (!oauthToken) {
        return {
            ok: false,
            code: 'CONFIG_INVALID',
            message:
                'Reddit publishing is not configured (missing REDDIT_OAUTH_TOKEN).',
        };
    }

    if (!allowedRaw) {
        return {
            ok: false,
            code: 'CONFIG_INVALID',
            message:
                'Reddit publishing is not configured (missing REDDIT_ALLOWED_SUBREDDITS).',
        };
    }

    const allowedSubreddits = new Set(
        allowedRaw
            .split(',')
            .map((value) => normalizeSubreddit(value))
            .filter((value) => value.length > 0),
    );

    if (allowedSubreddits.size === 0) {
        return {
            ok: false,
            code: 'CONFIG_INVALID',
            message:
                'Reddit publishing is not configured (no valid allowed subreddits).',
        };
    }

    return { ok: true, config: { oauthToken, allowedSubreddits } };
}

export async function publishRedditPost(
    input: RedditPostInput,
    options?: { fetchFn?: FetchFn },
): Promise<RedditPublishResult> {
    const configResult = readRedditConfigFromEnv();
    if (!configResult.ok) {
        return configResult;
    }

    const subreddit = normalizeSubreddit(input.subreddit);
    if (!configResult.config.allowedSubreddits.has(subreddit)) {
        return {
            ok: false,
            code: 'SUBREDDIT_NOT_ALLOWED',
            message: `Subreddit r/${subreddit} is not allowed by server configuration.`,
        };
    }

    const validationError = validateRedditPostInput(input);
    if (validationError) {
        return {
            ok: false,
            code: 'VALIDATION_ERROR',
            message: validationError,
        };
    }

    const body = new URLSearchParams();
    body.set('api_type', 'json');
    body.set('sr', subreddit);
    body.set('title', input.title);
    body.set('kind', input.kind);
    if (input.kind === 'self') {
        body.set('text', input.text?.trim() ?? '');
    }
    if (input.kind === 'link') {
        body.set('url', input.url?.trim() ?? '');
    }

    try {
        const runFetch = options?.fetchFn ?? fetch;
        const response = await runFetch(`${REDDIT_OAUTH_BASE_URL}/api/submit`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${configResult.config.oauthToken}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'GrediceAdmin/1.0',
            },
            body,
        });

        if (response.status === 401 || response.status === 403) {
            return {
                ok: false,
                code: 'AUTH_ERROR',
                message:
                    'Reddit authorization failed. Check account permissions and OAuth token.',
            };
        }

        const payload: unknown = await response.json();
        return mapRedditSubmitResponse(payload, response.ok);
    } catch {
        return {
            ok: false,
            code: 'API_ERROR',
            message: 'Unable to reach Reddit API. Please try again later.',
        };
    }
}

function mapRedditSubmitResponse(
    payload: unknown,
    responseOk: boolean,
): RedditPublishResult {
    if (
        isRedditSubmitSuccess(payload) &&
        payload.json.data?.id &&
        payload.json.data?.url
    ) {
        return {
            ok: true,
            redditId: payload.json.data.id,
            permalink: payload.json.data.url,
        };
    }

    if (isRedditSubmitFailure(payload)) {
        const firstError = payload.json.errors[0];
        if (firstError?.[0] === 'SUBREDDIT_NOTALLOWED') {
            return {
                ok: false,
                code: 'SUBREDDIT_NOT_ALLOWED',
                message: 'Reddit account cannot post to this subreddit.',
            };
        }

        return {
            ok: false,
            code: 'API_ERROR',
            message: firstError
                ? `Reddit rejected the post: ${firstError[0]}.`
                : 'Reddit rejected the post.',
        };
    }

    return {
        ok: false,
        code: 'API_ERROR',
        message: responseOk
            ? 'Reddit returned an unexpected response while publishing.'
            : 'Reddit API returned an error while publishing.',
    };
}

function normalizeSubreddit(value: string): string {
    return value.trim().replace(/^r\//i, '').toLowerCase();
}

function validateRedditPostInput(input: RedditPostInput): string | null {
    if (!input.title.trim()) {
        return 'Reddit title is required.';
    }

    if (input.kind === 'self' && !input.text?.trim()) {
        return 'Text post content is required for Reddit self posts.';
    }

    if (input.kind === 'link' && !input.url?.trim()) {
        return 'Link URL is required for Reddit link posts.';
    }

    return null;
}

function isRedditSubmitSuccess(value: unknown): value is {
    json: { data?: { id?: string; url?: string } };
} {
    return Boolean(value && typeof value === 'object' && 'json' in value);
}

function isRedditSubmitFailure(value: unknown): value is {
    json: { errors: [string, string, string][] };
} {
    if (!value || typeof value !== 'object' || !('json' in value)) {
        return false;
    }

    const maybeJson = (value as { json: unknown }).json;
    if (
        !maybeJson ||
        typeof maybeJson !== 'object' ||
        !('errors' in maybeJson)
    ) {
        return false;
    }

    const errors = (maybeJson as { errors: unknown }).errors;
    return Array.isArray(errors);
}
