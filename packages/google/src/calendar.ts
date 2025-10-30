import 'server-only';
import { createSign } from 'node:crypto';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';
const CALENDAR_BASE_URL = 'https://www.googleapis.com/calendar/v3';

type GoogleCalendarConfig = {
    clientEmail: string;
    privateKey: string;
    calendarId: string;
    timeZone: string;
};

type CachedToken = {
    accessToken: string;
    expiresAt: number;
    configHash: string;
};

let cachedToken: CachedToken | undefined;

function normalizePrivateKey(key: string): string {
    return key.replace(/\\n/g, '\n');
}

function getCalendarConfig(): GoogleCalendarConfig | undefined {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    const calendarId = process.env.GOOGLE_CALENDAR_ID;

    if (!clientEmail || !privateKey || !calendarId) {
        return undefined;
    }

    return {
        clientEmail,
        privateKey: normalizePrivateKey(privateKey),
        calendarId,
        timeZone: process.env.GOOGLE_CALENDAR_TIMEZONE ?? 'UTC',
    };
}

function base64UrlEncode(value: string | Buffer): string {
    return Buffer.from(value)
        .toString('base64')
        .replace(/=+$/u, '')
        .replace(/\+/gu, '-')
        .replace(/\//gu, '_');
}

function createJwtAssertion(config: GoogleCalendarConfig): string {
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + 3600; // 1 hour lifetime

    const header = {
        alg: 'RS256',
        typ: 'JWT',
    } satisfies Record<string, string>;

    const claimSet = {
        iss: config.clientEmail,
        scope: CALENDAR_SCOPE,
        aud: TOKEN_ENDPOINT,
        iat: issuedAt,
        exp: expiresAt,
    } satisfies Record<string, string | number>;

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedClaims = base64UrlEncode(JSON.stringify(claimSet));
    const unsignedToken = `${encodedHeader}.${encodedClaims}`;

    const signer = createSign('RSA-SHA256');
    signer.update(unsignedToken);
    signer.end();

    const signature = signer.sign(config.privateKey);
    const encodedSignature = base64UrlEncode(signature);

    return `${unsignedToken}.${encodedSignature}`;
}

function getConfigHash(config: GoogleCalendarConfig): string {
    return `${config.clientEmail}:${config.calendarId}:${config.privateKey}`;
}

async function fetchAccessToken(
    config: GoogleCalendarConfig,
): Promise<CachedToken> {
    const assertion = createJwtAssertion(config);
    const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion,
        }),
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(
            `Failed to obtain Google access token (${response.status}): ${message}`,
        );
    }

    const result = (await response.json()) as {
        access_token: string;
        expires_in: number;
    };

    const expiresAt = Date.now() + Math.max(result.expires_in - 60, 0) * 1000;

    return {
        accessToken: result.access_token,
        expiresAt,
        configHash: getConfigHash(config),
    };
}

async function getAccessToken(
    config: GoogleCalendarConfig,
): Promise<string> {
    if (
        cachedToken &&
        cachedToken.configHash === getConfigHash(config) &&
        cachedToken.expiresAt > Date.now() + 30 * 1000
    ) {
        return cachedToken.accessToken;
    }

    cachedToken = await fetchAccessToken(config);
    return cachedToken.accessToken;
}

async function authorizedFetch(
    config: GoogleCalendarConfig,
    input: RequestInfo,
    init: RequestInit,
): Promise<Response> {
    const token = await getAccessToken(config);
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);

    return fetch(input, {
        ...init,
        headers,
    });
}

export function isGoogleCalendarConfigured(): boolean {
    return getCalendarConfig() !== undefined;
}

export type CalendarEventDateTime = {
    date: Date;
    timeZone?: string;
};

export type CreateCalendarEventInput = {
    id: string;
    summary: string;
    description?: string;
    location?: string;
    start: CalendarEventDateTime;
    end: CalendarEventDateTime;
};

export async function createCalendarEvent(
    input: CreateCalendarEventInput,
): Promise<Record<string, unknown> | undefined> {
    const config = getCalendarConfig();

    if (!config) {
        return undefined;
    }

    const payload = {
        id: input.id,
        summary: input.summary,
        description: input.description,
        location: input.location,
        start: {
            dateTime: input.start.date.toISOString(),
            timeZone: input.start.timeZone ?? config.timeZone,
        },
        end: {
            dateTime: input.end.date.toISOString(),
            timeZone: input.end.timeZone ?? config.timeZone,
        },
    } satisfies Record<string, unknown>;

    const createResponse = await authorizedFetch(
        config,
        `${CALENDAR_BASE_URL}/calendars/${encodeURIComponent(config.calendarId)}/events`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        },
    );

    if (createResponse.status === 409) {
        const patchResponse = await authorizedFetch(
            config,
            `${CALENDAR_BASE_URL}/calendars/${encodeURIComponent(config.calendarId)}/events/${encodeURIComponent(input.id)}`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            },
        );

        if (!patchResponse.ok) {
            const message = await patchResponse.text();
            throw new Error(
                `Failed to update existing Google Calendar event (${patchResponse.status}): ${message}`,
            );
        }

        return (await patchResponse.json()) as Record<string, unknown>;
    }

    if (!createResponse.ok) {
        const message = await createResponse.text();
        throw new Error(
            `Failed to create Google Calendar event (${createResponse.status}): ${message}`,
        );
    }

    return (await createResponse.json()) as Record<string, unknown>;
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
    const config = getCalendarConfig();

    if (!config) {
        return;
    }

    const response = await authorizedFetch(
        config,
        `${CALENDAR_BASE_URL}/calendars/${encodeURIComponent(config.calendarId)}/events/${encodeURIComponent(eventId)}`,
        {
            method: 'DELETE',
        },
    );

    if (response.status === 404) {
        return;
    }

    if (!response.ok) {
        const message = await response.text();
        throw new Error(
            `Failed to delete Google Calendar event (${response.status}): ${message}`,
        );
    }
}

export function getCalendarEventIdFromRequestId(requestId: string): string {
    return `delivery-${requestId}`;
}
