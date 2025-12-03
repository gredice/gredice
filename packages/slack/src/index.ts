export interface SlackPostMessageInput {
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
    status?: number;
    error?: string;
    skipped?: SlackPostMessageSkippedReason;
    response?: unknown;
}

const SLACK_API_URL = 'https://slack.com/api/chat.postMessage';

export async function postMessage({
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
        return { ok: false, skipped: 'missing_token' };
    }
    if (!channel) {
        return { ok: false, skipped: 'missing_channel' };
    }

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
        });

        const responseBody = await response.json().catch(() => undefined);
        if (!response.ok) {
            return {
                ok: false,
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
                status: response.status,
                error: 'invalid_response',
                response: responseBody,
            };
        }

        if (!responseBody.ok) {
            return {
                ok: false,
                status: response.status,
                error:
                    typeof responseBody.error === 'string'
                        ? responseBody.error
                        : 'unknown_error',
                response: responseBody,
            };
        }

        return { ok: true, status: response.status, response: responseBody };
    } catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : 'unknown_error',
        };
    }
}
