import type {
    Requester,
    UpstashRequest,
    UpstashResponse,
} from '@upstash/redis';
import { request as undiciRequest } from 'undici';

type RetryConfig =
    | false
    | {
          retries?: number;
          backoff?: (retryCount: number) => number;
      };

type UpstashRedisRequesterOptions = {
    url: string;
    token: string;
    retry?: RetryConfig;
};

const defaultRetryCount = 5;
const defaultBackoff = (retryCount: number) => Math.exp(retryCount) * 50;

function responseSyncToken(
    headers: Record<string, string | string[] | undefined>,
) {
    const value = headers['upstash-sync-token'];
    return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function isResponsePayload(
    value: unknown,
): value is UpstashResponse<unknown> | UpstashResponse<unknown>[] {
    return typeof value === 'object' && value !== null;
}

function isAborted(
    signal: NonNullable<Parameters<typeof undiciRequest>[1]>['signal'],
) {
    return (
        typeof signal === 'object' &&
        signal !== null &&
        'aborted' in signal &&
        signal.aborted === true
    );
}

class UndiciUpstashRedisRequester implements Requester {
    readonly readYourWrites = true;
    upstashSyncToken = '';

    private readonly baseUrl: string;
    private readonly token: string;
    private readonly retries: number;
    private readonly backoff: (retryCount: number) => number;

    constructor({ url, token, retry }: UpstashRedisRequesterOptions) {
        this.baseUrl = url.replace(/\/+$/u, '');
        this.token = token;
        this.retries =
            retry === false
                ? 0
                : Math.max(0, Math.trunc(retry?.retries ?? defaultRetryCount));
        this.backoff =
            retry === false ? () => 0 : (retry?.backoff ?? defaultBackoff);
    }

    async request<TResult = unknown>(
        request: UpstashRequest,
    ): Promise<UpstashResponse<TResult>> {
        if (request.isStreaming) {
            throw new Error(
                'Streaming Redis requests are not supported by the storage cache transport.',
            );
        }

        const headers: Record<string, string> = {
            authorization: `Bearer ${this.token}`,
            'content-type': 'application/json',
            ...request.headers,
        };
        const syncToken = request.upstashSyncToken || this.upstashSyncToken;
        if (this.readYourWrites && syncToken) {
            headers['upstash-sync-token'] = syncToken;
        }

        const response = await this.sendWithRetry(
            [this.baseUrl, ...(request.path ?? [])].join('/'),
            {
                body: JSON.stringify(request.body),
                headers,
                method: 'POST',
                signal: request.signal,
            },
        );
        const rawBody = await response.body.text();

        if (response.statusCode < 200 || response.statusCode >= 300) {
            throw new Error(
                `Upstash Redis REST request failed with status ${response.statusCode}.`,
            );
        }

        let parsedBody: unknown;
        try {
            parsedBody = JSON.parse(rawBody);
        } catch (error) {
            throw new Error('Upstash Redis REST response was not valid JSON.', {
                cause: error,
            });
        }

        if (!isResponsePayload(parsedBody)) {
            throw new Error(
                'Upstash Redis REST response had an unexpected payload.',
            );
        }

        if (this.readYourWrites) {
            this.upstashSyncToken = responseSyncToken(response.headers);
        }

        // Upstash's public Requester type describes a single-command response,
        // while automatic pipelines return an array through the same method.
        return parsedBody as UpstashResponse<TResult>;
    }

    private async sendWithRetry(
        url: string,
        options: NonNullable<Parameters<typeof undiciRequest>[1]>,
    ) {
        let lastError: unknown;

        for (let retryCount = 0; retryCount <= this.retries; retryCount += 1) {
            try {
                return await undiciRequest(url, options);
            } catch (error) {
                lastError = error;
                if (
                    (options.signal && isAborted(options.signal)) ||
                    retryCount === this.retries
                ) {
                    throw error;
                }
                await new Promise((resolve) =>
                    setTimeout(resolve, this.backoff(retryCount)),
                );
            }
        }

        throw lastError ?? new Error('Upstash Redis REST request failed.');
    }
}

export function createUpstashRedisRequester(
    options: UpstashRedisRequesterOptions,
): Requester {
    return new UndiciUpstashRedisRequester(options);
}
