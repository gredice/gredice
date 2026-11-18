import { setTimeout as delay } from 'node:timers/promises';
import { signalcoClient } from '@gredice/signalco';

const attemptTimeoutMs = 2_000;
const retryDelaysMs = [200, 400];
const retryableStatuses = new Set([502, 503, 504]);
const retryableTransportCodes = new Set([
    'ECONNRESET',
    'EPIPE',
    'ETIMEDOUT',
    'EAI_AGAIN',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_HEADERS_TIMEOUT',
    'UND_ERR_BODY_TIMEOUT',
    'UND_ERR_SOCKET',
]);

function transientTransportCode(error: unknown) {
    for (let depth = 0; depth < 4 && error instanceof Error; depth++) {
        if (
            'code' in error &&
            typeof error.code === 'string' &&
            retryableTransportCodes.has(error.code)
        ) {
            return error.code;
        }
        error = error.cause;
    }
}

function isSignalcoReading(reading: unknown) {
    return (
        typeof reading === 'object' &&
        reading !== null &&
        !Array.isArray(reading) &&
        (!('timeStamp' in reading) || typeof reading.timeStamp === 'string') &&
        (!('valueSerialized' in reading) ||
            reading.valueSerialized === null ||
            typeof reading.valueSerialized === 'string')
    );
}

async function readAttempt(
    client: ReturnType<typeof signalcoClient>,
    query: Record<
        'entityId' | 'channelName' | 'contactName' | 'duration',
        string
    >,
    requestSignal: AbortSignal,
) {
    requestSignal.throwIfAborted();
    const deadline = AbortSignal.timeout(attemptTimeoutMs);
    const signal = AbortSignal.any([requestSignal, deadline]);

    try {
        const { data, response } = await client.GET('/contact/history', {
            // Signalco's generated contract omits the server's query parameters.
            querySerializer: () => new URLSearchParams(query).toString(),
            cache: 'no-store',
            signal,
            fetch: async (request) => {
                // An explicit signal opts out of Next.js fetch deduplication.
                const upstream = await fetch(request, { signal });
                if (upstream.ok) return upstream;

                // Only the status and Retry-After matter for error responses.
                // Skip openapi-fetch's error-body read so it cannot delay classification.
                void upstream.body?.cancel().catch(() => {});
                return new Response(null, {
                    status: upstream.status,
                    headers: upstream.headers,
                });
            },
        });
        signal.throwIfAborted();
        if (!response.ok) {
            const transient = retryableStatuses.has(response.status);
            return {
                status:
                    transient || response.status === 429
                        ? (503 as const)
                        : (502 as const),
                retryable: transient && !response.headers.has('Retry-After'),
                reason: response.status,
            };
        }
        if (
            response.status !== 200 ||
            !Array.isArray(data?.values) ||
            !data.values.every(isSignalcoReading)
        ) {
            return { status: 502 as const, reason: 'invalid-response' };
        }
        return { values: data.values };
    } catch (error) {
        requestSignal.throwIfAborted();
        const code = deadline.aborted
            ? 'timeout'
            : transientTransportCode(error);
        return code
            ? { status: 503 as const, retryable: true, reason: code }
            : { status: 502 as const, reason: 'invalid-response-or-transport' };
    }
}

export async function readRaisedBedSensorHistory(
    entityId: string,
    type: string,
    duration: string,
    requestSignal: AbortSignal,
) {
    const client = signalcoClient();
    const query = {
        entityId,
        channelName: 'zigbee2mqtt',
        contactName: type === 'soil_moisture' ? 'soil_moisture' : 'temperature',
        duration: `${duration}.00:00`,
    };

    for (let attempt = 1; ; attempt++) {
        const result = await readAttempt(client, query, requestSignal);
        if (result.values) {
            if (attempt > 1) {
                console.warn('Signalco sensor history recovered', { attempt });
            }
            return { values: result.values };
        }

        const waitMs = retryDelaysMs[attempt - 1];
        if (!result.retryable || waitMs === undefined) {
            console.error('Signalco sensor history read failed', {
                attempts: attempt,
                reason: result.reason,
            });
            return { status: result.status };
        }
        await delay(waitMs * (1 + Math.random() / 2), undefined, {
            signal: requestSignal,
        });
    }
}
