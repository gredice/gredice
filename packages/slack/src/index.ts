export interface SlackPostMessageInput {
    abortSignal?: AbortSignal;
    beforeProviderSubmission?: () => Promise<void>;
    token?: string;
    channel?: string;
    text: string;
    blocks?: unknown;
    iconEmoji?: string;
    username?: string;
    threadTs?: string;
    unfurlLinks?: boolean;
    unfurlMedia?: boolean;
}

export type SlackPostMessageSkippedReason = 'missing_token' | 'missing_channel';

export interface SlackPostMessageResult {
    ok: boolean;
    outcome: 'accepted' | 'not_started' | 'rejected' | 'uncertain';
    status?: number;
    error?: string;
    skipped?: SlackPostMessageSkippedReason;
    response?: unknown;
}

const SLACK_API_URL = 'https://slack.com/api/chat.postMessage';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function postMessage({
    abortSignal,
    beforeProviderSubmission,
    token,
    channel,
    text,
    blocks,
    iconEmoji,
    username,
    threadTs,
    unfurlLinks,
    unfurlMedia,
}: SlackPostMessageInput): Promise<SlackPostMessageResult> {
    if (!token) {
        return {
            ok: false,
            outcome: 'not_started',
            skipped: 'missing_token',
        };
    }
    if (!channel) {
        return {
            ok: false,
            outcome: 'not_started',
            skipped: 'missing_channel',
        };
    }

    abortSignal?.throwIfAborted();
    await beforeProviderSubmission?.();
    try {
        const response = await fetch(SLACK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                channel,
                text,
                blocks,
                icon_emoji: iconEmoji,
                username,
                thread_ts: threadTs,
                unfurl_links: unfurlLinks ?? false,
                unfurl_media: unfurlMedia ?? false,
            }),
            signal: abortSignal,
        });

        const parsedResponseBody: unknown = await response
            .json()
            .catch(() => undefined);
        const responseBody = isRecord(parsedResponseBody)
            ? parsedResponseBody
            : undefined;
        if (!response.ok) {
            return {
                ok: false,
                outcome: response.status >= 500 ? 'uncertain' : 'rejected',
                status: response.status,
                error:
                    typeof responseBody?.error === 'string'
                        ? responseBody.error
                        : `HTTP ${response.status}`,
                response: responseBody,
            };
        }

        if (typeof responseBody?.ok !== 'boolean') {
            return {
                ok: false,
                outcome: 'uncertain',
                status: response.status,
                error: 'invalid_response',
                response: responseBody,
            };
        }

        if (!responseBody.ok) {
            return {
                ok: false,
                outcome: 'rejected',
                status: response.status,
                error:
                    typeof responseBody.error === 'string'
                        ? responseBody.error
                        : 'unknown_error',
                response: responseBody,
            };
        }

        return {
            ok: true,
            outcome: 'accepted',
            status: response.status,
            response: responseBody,
        };
    } catch (error) {
        return {
            ok: false,
            outcome: 'uncertain',
            error: error instanceof Error ? error.message : 'unknown_error',
        };
    }
}
