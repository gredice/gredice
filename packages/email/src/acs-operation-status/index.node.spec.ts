import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createHttpHeaders,
    type HttpClient,
    type PipelineRequest,
    type PipelineResponse,
} from '@azure/core-rest-pipeline';
import {
    AcsEmailOperationStatusAbortedError,
    AcsEmailOperationStatusConfigError,
    AcsEmailOperationStatusHttpError,
    AcsEmailOperationStatusParseError,
    getAcsEmailOperationStatus,
    isAcsEmailOperationStatus,
    isAcsEmailOperationStatusAbortedError,
    isAcsEmailOperationStatusConfigError,
    isAcsEmailOperationStatusHttpError,
    isAcsEmailOperationStatusParseError,
} from './index';

const operationId = '018F0D12-2EC4-7FAB-9D91-91F890AD5D73';
const normalizedOperationId = operationId.toLowerCase();
const accessKey = Buffer.alloc(32, 7).toString('base64');
const connectionString = `endpoint=https://email.example.test/;accesskey=${accessKey}`;

function responseFor(
    request: PipelineRequest,
    {
        bodyAsText,
        status = 200,
    }: { bodyAsText?: string | null; status?: number } = {},
): PipelineResponse {
    return {
        bodyAsText,
        headers: createHttpHeaders(),
        request,
        status,
    };
}

function createFakeHttpClient(
    sendRequest: HttpClient['sendRequest'],
): HttpClient {
    return { sendRequest };
}

function lookup(
    httpClient: HttpClient,
    overrides: {
        abortSignal?: AbortSignal;
        connectionString?: string;
        operationId?: string;
    } = {},
) {
    return getAcsEmailOperationStatus(overrides.operationId ?? operationId, {
        abortSignal: overrides.abortSignal,
        connectionString: overrides.connectionString ?? connectionString,
        httpClient,
    });
}

test('sends one authenticated GET to the canonical ACS operation endpoint', async () => {
    const requests: PipelineRequest[] = [];
    const httpClient = createFakeHttpClient(async (request) => {
        requests.push(request);
        return responseFor(request, {
            bodyAsText: JSON.stringify({
                id: normalizedOperationId,
                status: 'Succeeded',
            }),
        });
    });

    assert.equal(await lookup(httpClient), 'Succeeded');
    assert.equal(requests.length, 1);

    const request = requests[0];
    assert.ok(request);
    assert.equal(request.method, 'GET');
    assert.equal(request.body, undefined);
    assert.equal(
        request.url,
        `https://email.example.test/emails/operations/${normalizedOperationId}?api-version=2025-09-01`,
    );
    assert.equal(request.timeout, 10_000);
    assert.equal(request.headers.get('host'), 'email.example.test');
    assert.match(request.headers.get('x-ms-date') ?? '', /GMT$/u);
    assert.equal(
        request.headers.get('x-ms-content-sha256'),
        '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
    );
    assert.match(
        request.headers.get('authorization') ?? '',
        /^HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=[A-Za-z0-9+/=]+$/u,
    );
});

test('accepts every documented bounded operation status', async (t) => {
    for (const status of [
        'Succeeded',
        'Failed',
        'Canceled',
        'Running',
        'NotStarted',
    ] as const) {
        await t.test(status, async () => {
            let requests = 0;
            const httpClient = createFakeHttpClient(async (request) => {
                requests += 1;
                return responseFor(request, {
                    bodyAsText: JSON.stringify({
                        id: normalizedOperationId,
                        ignoredProviderData: 'must-not-escape',
                        status,
                    }),
                });
            });

            assert.equal(await lookup(httpClient), status);
            assert.equal(isAcsEmailOperationStatus(status), true);
            assert.equal(requests, 1);
        });
    }
    assert.equal(isAcsEmailOperationStatus('completed'), false);
});

test('classifies bounded HTTP failures without exposing response data or retrying', async (t) => {
    for (const { retryable, statusCode } of [
        { retryable: false, statusCode: 400 },
        { retryable: false, statusCode: 401 },
        { retryable: true, statusCode: 408 },
        { retryable: true, statusCode: 429 },
        { retryable: true, statusCode: 500 },
        { retryable: true, statusCode: 599 },
    ]) {
        await t.test(String(statusCode), async () => {
            let requests = 0;
            const httpClient = createFakeHttpClient(async (request) => {
                requests += 1;
                return responseFor(request, {
                    bodyAsText:
                        '{"error":{"message":"sensitive provider data"}}',
                    status: statusCode,
                });
            });

            await assert.rejects(lookup(httpClient), (error: unknown) => {
                assert.equal(isAcsEmailOperationStatusHttpError(error), true);
                assert.ok(error instanceof AcsEmailOperationStatusHttpError);
                assert.equal(error.reason, 'response');
                assert.equal(error.retryable, retryable);
                assert.equal(error.statusCode, statusCode);
                assert.doesNotMatch(error.message, /sensitive|provider data/u);
                return true;
            });
            assert.equal(requests, 1);
        });
    }
});

test('classifies invalid response status and transport failure without retrying', async () => {
    let invalidStatusRequests = 0;
    const invalidStatusClient = createFakeHttpClient(async (request) => {
        invalidStatusRequests += 1;
        return responseFor(request, { status: 0 });
    });
    await assert.rejects(lookup(invalidStatusClient), (error: unknown) => {
        assert.equal(isAcsEmailOperationStatusHttpError(error), true);
        assert.ok(error instanceof AcsEmailOperationStatusHttpError);
        assert.equal(error.reason, 'invalid_response_status');
        assert.equal(error.retryable, false);
        assert.equal(error.statusCode, null);
        return true;
    });
    assert.equal(invalidStatusRequests, 1);

    let transportRequests = 0;
    const transportClient = createFakeHttpClient(async () => {
        transportRequests += 1;
        throw new Error('sensitive socket address and provider response');
    });
    await assert.rejects(lookup(transportClient), (error: unknown) => {
        assert.equal(isAcsEmailOperationStatusHttpError(error), true);
        assert.ok(error instanceof AcsEmailOperationStatusHttpError);
        assert.equal(error.reason, 'transport');
        assert.equal(error.retryable, true);
        assert.equal(error.statusCode, null);
        assert.doesNotMatch(error.message, /sensitive|socket address/u);
        return true;
    });
    assert.equal(transportRequests, 1);
});

test('classifies response parsing failures without exposing provider payloads', async (t) => {
    const cases: Array<{
        bodyAsText?: string | null;
        reason:
            | 'body_too_large'
            | 'empty_body'
            | 'invalid_json'
            | 'invalid_payload'
            | 'mismatched_operation_id'
            | 'unknown_status';
    }> = [
        { bodyAsText: undefined, reason: 'empty_body' },
        { bodyAsText: null, reason: 'empty_body' },
        { bodyAsText: '', reason: 'empty_body' },
        { bodyAsText: '{secret invalid json', reason: 'invalid_json' },
        { bodyAsText: '[]', reason: 'invalid_payload' },
        { bodyAsText: '{"status":7}', reason: 'invalid_payload' },
        {
            bodyAsText: '{"status":"Succeeded"}',
            reason: 'invalid_payload',
        },
        {
            bodyAsText: '{"id":"not-an-operation-id","status":"Succeeded"}',
            reason: 'invalid_payload',
        },
        {
            bodyAsText:
                '{"id":"118f0d12-2ec4-7fab-9d91-91f890ad5d73","status":"Succeeded"}',
            reason: 'mismatched_operation_id',
        },
        {
            bodyAsText:
                '{"id":"018f0d12-2ec4-7fab-9d91-91f890ad5d73","status":"Completed","secret":"provider detail"}',
            reason: 'unknown_status',
        },
        { bodyAsText: 'x'.repeat(16_385), reason: 'body_too_large' },
    ];

    for (const { bodyAsText, reason } of cases) {
        await t.test(reason, async () => {
            const httpClient = createFakeHttpClient(async (request) =>
                responseFor(request, { bodyAsText }),
            );

            await assert.rejects(lookup(httpClient), (error: unknown) => {
                assert.equal(isAcsEmailOperationStatusParseError(error), true);
                assert.ok(error instanceof AcsEmailOperationStatusParseError);
                assert.equal(error.reason, reason);
                assert.doesNotMatch(
                    error.message,
                    /provider detail|secret invalid/u,
                );
                return true;
            });
        });
    }
});

test('classifies connection and operation configuration without leaking credentials', async (t) => {
    const unusedClient = createFakeHttpClient(async (request) =>
        responseFor(request),
    );
    const cases: Array<{
        connectionString?: string;
        operationId?: string;
        reason:
            | 'invalid_connection_string'
            | 'invalid_endpoint'
            | 'invalid_operation_id'
            | 'missing_connection_string';
    }> = [
        { connectionString: '', reason: 'missing_connection_string' },
        {
            connectionString: 'secret-invalid-connection-string',
            reason: 'invalid_connection_string',
        },
        {
            connectionString:
                'endpoint=https://email.example.test/;accesskey=not-base64!',
            reason: 'invalid_connection_string',
        },
        {
            connectionString: `endpoint=http://email.example.test/;accesskey=${accessKey}`,
            reason: 'invalid_endpoint',
        },
        { operationId: '../not-a-uuid', reason: 'invalid_operation_id' },
    ];

    for (const {
        connectionString: candidate,
        operationId: id,
        reason,
    } of cases) {
        await t.test(reason, async () => {
            await assert.rejects(
                getAcsEmailOperationStatus(id ?? operationId, {
                    connectionString: candidate,
                    httpClient: unusedClient,
                }),
                (error: unknown) => {
                    assert.equal(
                        isAcsEmailOperationStatusConfigError(error),
                        true,
                    );
                    assert.ok(
                        error instanceof AcsEmailOperationStatusConfigError,
                    );
                    assert.equal(error.reason, reason);
                    assert.doesNotMatch(
                        error.message,
                        /secret-invalid|accesskey/u,
                    );
                    return true;
                },
            );
        });
    }
});

test('passes the AbortSignal to transport and returns a bounded abort error', async () => {
    const abortController = new AbortController();
    let releaseTransportStart: (() => void) | undefined;
    const transportStarted = new Promise<void>((resolve) => {
        releaseTransportStart = resolve;
    });
    let requests = 0;
    const httpClient = createFakeHttpClient(async (request) => {
        requests += 1;
        assert.equal(request.abortSignal, abortController.signal);
        releaseTransportStart?.();
        return new Promise<PipelineResponse>((_resolve, reject) => {
            request.abortSignal?.addEventListener(
                'abort',
                () => {
                    reject(
                        Object.assign(
                            new Error('sensitive provider abort details'),
                            { name: 'AbortError' },
                        ),
                    );
                },
                { once: true },
            );
        });
    });

    const result = lookup(httpClient, {
        abortSignal: abortController.signal,
    });
    await transportStarted;
    abortController.abort();

    await assert.rejects(result, (error: unknown) => {
        assert.equal(isAcsEmailOperationStatusAbortedError(error), true);
        assert.ok(error instanceof AcsEmailOperationStatusAbortedError);
        assert.doesNotMatch(error.message, /sensitive|provider abort/u);
        return true;
    });
    assert.equal(requests, 1);
});

test('does not enter the HTTP pipeline when already aborted', async () => {
    const abortController = new AbortController();
    abortController.abort();
    let requests = 0;
    const httpClient = createFakeHttpClient(async (request) => {
        requests += 1;
        return responseFor(request);
    });

    await assert.rejects(
        lookup(httpClient, { abortSignal: abortController.signal }),
        (error: unknown) => {
            assert.equal(isAcsEmailOperationStatusAbortedError(error), true);
            return true;
        },
    );
    assert.equal(requests, 0);
});

test('typed guards accept bounded serialized errors and reject malformed ones', () => {
    assert.equal(
        isAcsEmailOperationStatusConfigError({
            code: 'acs_email_operation_status_configuration_error',
            reason: 'missing_connection_string',
        }),
        true,
    );
    assert.equal(
        isAcsEmailOperationStatusHttpError({
            code: 'acs_email_operation_status_http_error',
            reason: 'response',
            retryable: true,
            statusCode: 429,
        }),
        true,
    );
    assert.equal(
        isAcsEmailOperationStatusHttpError({
            code: 'acs_email_operation_status_http_error',
            reason: 'response',
            retryable: true,
            statusCode: 999,
        }),
        false,
    );
    assert.equal(
        isAcsEmailOperationStatusParseError({
            code: 'acs_email_operation_status_parse_error',
            reason: 'unknown_status',
        }),
        true,
    );
    assert.equal(
        isAcsEmailOperationStatusAbortedError({
            code: 'acs_email_operation_status_aborted',
        }),
        true,
    );
});
